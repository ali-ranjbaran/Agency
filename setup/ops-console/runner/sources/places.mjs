/**
 * Discovery source: Google Places API (New), Text Search. OFF unless GOOGLE_PLACES_KEY is set.
 *
 * TERMS NOTE (Google Maps Platform Places policies, checked 2026-10-13):
 *   - Only the place_id may be stored ("You can store place ID values indefinitely").
 *     Name, address, phone, rating and website from Google are NEVER persisted. websiteUri is used
 *     in memory, only to know which site to visit; everything stored comes from the firm's own site.
 *   - Places content shown without a Google map needs the Google logo; the console shows nothing
 *     from Google except an "Open in Google Maps" link built from the place_id.
 * COST (pricing list updated 2026-10-08): field mask places.id,places.websiteUri,nextPageToken
 * triggers Text Search Enterprise: 1,000 free calls/month, then US$35 per 1,000. One call returns up
 * to 20 places; a query returns at most 60 (3 calls). Every call is reserved first against the
 * console's hard monthly cap (PLACES_MONTHLY_CAP, default 500); at the cap the source stops.
 */
const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = "places.id,places.websiteUri,nextPageToken";

const TRADE_QUERIES = { hvac: ["HVAC contractor", "furnace repair", "heating and air conditioning", "furnace installation"] };

/** reserve(): async () => boolean, asks the console for one call under the cap. */
export async function discoverPlaces({ trade, city, keywords }, { key, reserve }) {
  if (!key) return { firms: [], calls: 0, stopped: "no_key" };
  const queries = [...new Set([...(TRADE_QUERIES[trade] ?? [trade]), ...String(keywords ?? "").split(",").map((k) => k.trim()).filter(Boolean)])];
  const firms = [];
  let calls = 0;
  for (const q of queries) {
    let pageToken;
    for (let page = 0; page < 3; page++) {
      if (!(await reserve())) return { firms, calls, stopped: "monthly_cap" };
      calls++;
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK },
        body: JSON.stringify({ textQuery: `${q} in ${city}`, pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`Places HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      for (const p of data.places ?? []) {
        // In memory only: the website tells us where to look. Only the id is ever sent to the console.
        firms.push({ name: null, website: p.websiteUri ?? null, phone: null, city: null, refs: [{ source: "places", ref: p.id, attribution: null }] });
      }
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
  }
  return { firms, calls, stopped: null };
}
