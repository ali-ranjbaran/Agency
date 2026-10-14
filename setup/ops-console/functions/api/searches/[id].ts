/** POST: re-run a saved search (dedupe means only firms new since the last run become candidates).
 *  PATCH { schedule: 'monthly' | null }. DELETE: remove the saved search (jobs and candidates stay). */
import type { Env, Who } from "../../../server/env";
import { bad, json, readJson } from "../../../server/http";

type F = PagesFunction<Env, "id", { who: Who }>;
const idOf = (p: string | string[]) => Number.parseInt(String(p), 10);

export const onRequestPost: F = async ({ env, data, params }) => {
  const t = data.who.tenant;
  const s = await env.DB.prepare("SELECT * FROM saved_searches WHERE id = ?1 AND tenant = ?2").bind(idOf(params.id), t).first<Record<string, unknown>>();
  if (!s) return bad("not found", 404);
  const busy = await env.DB.prepare("SELECT 1 FROM search_jobs WHERE saved_search_id = ?1 AND status IN ('queued','running')").bind(s.id).first();
  if (busy) return bad("This search is already queued or running.", 409);
  const job = await env.DB.prepare("INSERT INTO search_jobs (tenant, saved_search_id, trade, city, radius_km, keywords, sources) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) RETURNING id")
    .bind(t, s.id, s.trade, s.city, s.radius_km, s.keywords, s.sources).first<{ id: number }>();
  return json(201, { job_id: job!.id });
};

export const onRequestPatch: F = async ({ request, env, data, params }) => {
  const b = await readJson(request);
  const r = await env.DB.prepare("UPDATE saved_searches SET schedule = ?1 WHERE id = ?2 AND tenant = ?3")
    .bind(b?.schedule === "monthly" ? "monthly" : null, idOf(params.id), data.who.tenant).run();
  return r.meta.changes ? json(200, { ok: true }) : bad("not found", 404);
};

export const onRequestDelete: F = async ({ env, data, params }) => {
  await env.DB.prepare("DELETE FROM saved_searches WHERE id = ?1 AND tenant = ?2").bind(idOf(params.id), data.who.tenant).run();
  return json(200, { ok: true });
};
