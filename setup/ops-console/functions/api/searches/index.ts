/**
 * GET: saved searches, job history (latest 50) and the universe counters.
 * POST { trade, city, radius_km?, keywords?, sources[], manual_urls?, save?, schedule? }:
 *   queue a search job (and optionally save it as a saved search).
 */
import type { Env, Who } from "../../../server/env";
import { bad, json, readJson, str } from "../../../server/http";
import { universe } from "../../../server/leadgen";

type F = PagesFunction<Env, string, { who: Who }>;
const SOURCES = ["osm", "places", "manual"];

export const onRequestGet: F = async ({ env, data }) => {
  const t = data.who.tenant;
  const [saved, jobs, uni, usage] = await Promise.all([
    env.DB.prepare("SELECT * FROM saved_searches WHERE tenant = ?1 ORDER BY id").bind(t).all(),
    env.DB.prepare("SELECT id, saved_search_id, trade, city, keywords, sources, status, counts_json, places_calls, error, created_at, finished_at FROM search_jobs WHERE tenant = ?1 ORDER BY id DESC LIMIT 50").bind(t).all(),
    universe(env, t),
    env.DB.prepare("SELECT month, calls FROM places_usage WHERE tenant = ?1 ORDER BY month DESC LIMIT 1").bind(t).first(),
  ]);
  return json(200, {
    saved: saved.results, universe: uni, places: { usage, cap: Number(env.PLACES_MONTHLY_CAP || 500) },
    jobs: jobs.results.map((j) => ({ ...j, counts: j.counts_json ? JSON.parse(String(j.counts_json)) : null, counts_json: undefined })),
  });
};

export const onRequestPost: F = async ({ request, env, data }) => {
  const b = await readJson(request);
  if (!b) return bad("bad json");
  const t = data.who.tenant;
  const trade = str(b.trade, 40).toLowerCase();
  const city = str(b.city, 80);
  if (!trade || !city) return bad("trade and city are required");
  const sources = (Array.isArray(b.sources) ? b.sources : []).map(String).filter((s) => SOURCES.includes(s));
  if (!sources.length) return bad("pick at least one source");
  const urls = sources.includes("manual")
    ? String(b.manual_urls ?? "").split(/[\s,]+/).map((u) => u.trim()).filter((u) => /^https?:\/\/[^\s/]+\.[a-z]{2,}/i.test(u)).slice(0, 300)
    : [];
  if (sources.includes("manual") && !urls.length && sources.length === 1) return bad("paste at least one website URL for the manual source");
  const radius = Number.isFinite(Number(b.radius_km)) && Number(b.radius_km) > 0 ? Math.min(100, Math.round(Number(b.radius_km))) : null;
  const keywords = str(b.keywords, 300);

  let savedId: number | null = null;
  if (b.save === true) {
    const s = await env.DB.prepare(
      "INSERT INTO saved_searches (tenant, trade, city, radius_km, keywords, sources, schedule, last_run_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now')) RETURNING id",
    ).bind(t, trade, city, radius, keywords, sources.filter((s) => s !== "manual").join(",") || "osm", b.schedule === "monthly" ? "monthly" : null).first<{ id: number }>();
    savedId = s!.id;
  }
  const job = await env.DB.prepare(
    "INSERT INTO search_jobs (tenant, saved_search_id, trade, city, radius_km, keywords, sources, manual_urls) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) RETURNING id",
  ).bind(t, savedId, trade, city, radius, keywords, sources.join(","), urls.length ? JSON.stringify(urls) : null).first<{ id: number }>();
  return json(201, { job_id: job!.id, saved_search_id: savedId });
};
