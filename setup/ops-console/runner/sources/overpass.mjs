/**
 * Discovery source: OpenStreetMap via the public Overpass API.
 *
 * TERMS NOTE. OSM data is © OpenStreetMap contributors, under the Open Database License (ODbL).
 * It may be stored, with attribution: every company_sources row records
 * "© OpenStreetMap contributors (ODbL)" and the console shows it. Overpass public-instance
 * guidance (dev.overpass-api.de "commons"): roughly 10,000 queries/day max, no parallel scripts,
 * identify yourself, wait 30 s after a 429. We send 1–2 queries per search, sequentially, with an
 * honest user agent. If usage ever grows, switch to a Geofabrik extract (same licence).
 */
import { UA_ENRICH, sleep } from "../lib.mjs";

export const ATTRIBUTION = "© OpenStreetMap contributors (ODbL)";
const ENDPOINT = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

const TRADE_TERMS = {
  hvac: { craft: "hvac|heating|air_condition|refrigeration|plumb", name: ["heat", "heating", "furnace", "hvac", "air", "cooling", "mechanical", "refrigeration", "comfort", "climate"] },
};

const escQ = (s) => String(s).replace(/[\\"]/g, "\\$&");                       // inside "…" (exact match)
const escRe = (s) => escQ(String(s).replace(/[|()[\]{}.*+?^$]/g, "\\$&"));   // inside a regex value

async function overpass(query) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST", headers: { "user-agent": UA_ENRICH, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(90_000),
    });
    if (res.status === 429 || res.status === 504) { await sleep(30_000); continue; }
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
    return (await res.json()).elements ?? [];
  }
  throw new Error("Overpass busy (429/504 three times)");
}

/** City centre from OSM, for radius searches. */
async function cityCentre(city) {
  const els = await overpass(`[out:json][timeout:30];node["place"~"^(city|town)$"]["name"="${escQ(city)}"];out tags 1;`);
  return els[0] ? { lat: els[0].lat, lon: els[0].lon } : null;
}

/** Returns firms: { name, website, phone, city, refs: [{ source: 'osm', ref, attribution }] } */
export async function discoverOsm({ trade, city, radius_km, keywords }) {
  const t = TRADE_TERMS[trade] ?? { craft: escRe(trade), name: [trade] };
  const words = [...new Set([...t.name, ...String(keywords ?? "").split(",").map((k) => k.trim().toLowerCase()).filter(Boolean)])].map(escRe).join("|");
  let scope, head;
  if (radius_km) {
    const c = await cityCentre(city);
    if (!c) throw new Error(`OSM has no city node named ${city}`);
    scope = `(around:${radius_km * 1000},${c.lat},${c.lon})`;
    head = "";
  } else {
    head = `area["name"="${escQ(city)}"]["boundary"="administrative"]->.a;`;
    scope = "(area.a)";
  }
  const q = `[out:json][timeout:60];${head}(
    nwr${scope}["craft"~"${t.craft}",i];
    nwr${scope}["name"~"${words}",i][~"^(craft|shop|office|company)$"~"."];
  );out center tags;`;
  const els = await overpass(q);
  return els.filter((e) => e.tags?.name).map((e) => ({
    name: e.tags.name,
    website: e.tags.website ?? e.tags["contact:website"] ?? e.tags.url ?? null,
    phone: e.tags.phone ?? e.tags["contact:phone"] ?? null,
    city: e.tags["addr:city"] ?? null,
    refs: [{ source: "osm", ref: `${e.type}/${e.id}`, attribution: ATTRIBUTION }],
  }));
}
