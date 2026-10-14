#!/usr/bin/env node
/**
 * Lead-search runner (launchd every 2 min). Claims ONE queued job from the console and runs it:
 *   1. discover firms from the job's sources (OSM, Google Places if keyed, pasted URLs)
 *   2. merge duplicates across sources (domain, phone)
 *   3. ask the console which firms are already known, rejected or suppressed, and skip those
 *   4. enrich the rest from their own websites (enrich.mjs: robots, 1 req / 2 s, ≤ 4 pages)
 *   5. send candidates (stage "candidate", draft CASL fields) and snapshot each new one
 * Nothing found here is sendable: the operator approves each company in the review queue.
 */
import { discoverManual } from "./sources/manual.mjs";
import { discoverOsm } from "./sources/overpass.mjs";
import { discoverPlaces } from "./sources/places.mjs";
import { enrichSite, politeFetcher } from "./enrich.mjs";
import { loadConfig, log, opsClient, skipList } from "./lib.mjs";

const domainOf = (u) => { try { return new URL(/^https?:\/\//.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; } };
const phoneOf = (p) => { const d = String(p ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, ""); return /^[2-9]\d{2}[2-9]\d{6}$/.test(d) ? `+1${d}` : null; };

/** Merge firms found by several sources into one, keyed by domain, else phone, else source ref. */
export function mergeFirms(list) {
  const out = [];
  const byKey = new Map();
  for (const f of list) {
    const d = f.website ? domainOf(f.website) : null;
    const p = phoneOf(f.phone);
    const keys = [d && `d:${d}`, p && `p:${p}`].filter(Boolean);
    const hit = keys.map((k) => byKey.get(k)).find(Boolean);
    if (hit) {
      hit.refs.push(...f.refs);
      hit.name ??= f.name; hit.website ??= f.website; hit.phone ??= f.phone; hit.city ??= f.city;
      for (const k of keys) byKey.set(k, hit);
    } else {
      const n = { ...f, refs: [...f.refs] };
      out.push(n);
      for (const k of keys.length ? keys : [`r:${f.refs[0]?.ref}`]) byKey.set(k, n);
    }
  }
  return out;
}

export async function runJob(api, job, { placesKey, fetcher = politeFetcher(), snapshot } = {}) {
  const counts = { found: 0, known: 0, rejected_skipped: 0, suppressed_dropped: 0, new_candidates: 0, no_website: 0, unreachable: 0, robots_blocked: 0, skip_list: 0 };
  const sources = String(job.sources).split(",").map((s) => s.trim()).filter(Boolean);
  let raw = [], placesCalls = 0;

  if (sources.includes("osm")) raw.push(...(await discoverOsm(job)));
  if (sources.includes("places")) {
    const r = await discoverPlaces(job, { key: placesKey, reserve: async () => (await api("/api/runner/places-usage", { method: "POST", json: {} })).ok });
    raw.push(...r.firms); placesCalls = r.calls;
    if (r.stopped) counts[`places_${r.stopped}`] = 1;
  }
  if (sources.includes("manual")) raw.push(...discoverManual(job.manual_urls));

  const firms = mergeFirms(raw);
  counts.found = firms.length;

  // Ask the console what it already knows, so known/rejected/suppressed sites aren't visited again.
  const keys = firms.map((f) => ({
    domain: f.website ? domainOf(f.website) : null, phone: phoneOf(f.phone),
    place_ids: f.refs.filter((r) => r.source === "places").map((r) => r.ref), osm_refs: f.refs.filter((r) => r.source === "osm").map((r) => r.ref),
  }));
  const verdicts = [];
  for (let i = 0; i < keys.length; i += 300) verdicts.push(...(await api("/api/runner/known", { method: "POST", json: { firms: keys.slice(i, i + 300) } })).verdicts);
  const skip = skipList();
  const fresh = [];
  firms.forEach((f, i) => {
    const v = verdicts[i];
    if (v === "known") counts.known++;
    else if (v === "rejected") counts.rejected_skipped++;
    else if (v === "suppressed") counts.suppressed_dropped++;
    else if (f.website && skip.has(domainOf(f.website))) counts.skip_list++;
    else fresh.push(f);
  });
  log(`job ${job.id}: ${firms.length} firms, ${fresh.length} new`);

  const created = [];
  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    const r = await api(`/api/runner/jobs/${job.id}/candidates`, { method: "POST", json: { candidates: batch } });
    created.push(...r.created);
    counts.new_candidates += r.counts.new_candidates; counts.known += r.counts.known;
    counts.rejected_skipped += r.counts.rejected_skipped; counts.suppressed_dropped += r.counts.suppressed_dropped;
    batch = [];
  };
  for (const f of fresh) {
    // Places gives no name we may keep; without a website there is nothing of the firm's own to show.
    if (!f.website && !f.name) { counts.no_website++; continue; }
    let e = null;
    if (f.website) {
      e = await enrichSite(f.website, { trade: job.trade, city: job.city, fetcher });
      if (!e.ok) { counts[e.error === "robots_disallowed" ? "robots_blocked" : "unreachable"]++; e = null; }
    } else counts.no_website++;
    batch.push({
      name: e?.name ?? f.name, domain: f.website ? domainOf(f.website) : null, phone: e?.phone ?? phoneOf(f.phone),
      city: e?.city ?? f.city, segment: e?.segment ?? "unknown", sources: f.refs,
      enrichment: e ? e.enrichment : { note: f.website ? "site not reachable for enrichment" : "no website listed" },
      contacts: e?.contacts ?? [],
    });
    if (batch.length >= 10) await flush();
  }
  await flush();

  if (snapshot && created.some((c) => c.domain)) await snapshot(created.filter((c) => c.domain));
  return { counts, placesCalls };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = loadConfig();
  const api = opsClient(cfg);
  const { job } = await api("/api/runner/jobs/claim", { method: "POST", json: {} });
  if (!job) process.exit(0);
  log(`claimed job ${job.id}: ${job.trade} · ${job.city} · ${job.sources}`);
  try {
    const { snapshotTargets } = await import("./snapshot.mjs");
    const { counts, placesCalls } = await runJob(api, job, { placesKey: cfg.placesKey, snapshot: (t) => snapshotTargets(api, t, cfg.delaySec) });
    await api(`/api/runner/jobs/${job.id}/finish`, { method: "POST", json: { status: "done", counts, places_calls: placesCalls } });
    log(`job ${job.id} done`, JSON.stringify(counts));
  } catch (e) {
    log(`job ${job.id} failed`, e.message);
    await api(`/api/runner/jobs/${job.id}/finish`, { method: "POST", json: { status: "error", error: e.message } }).catch(() => {});
    process.exitCode = 1;
  }
}
