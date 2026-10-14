/** POST { status: 'done'|'error', counts, places_calls, error? } (runner only). */
import type { Env, Who } from "../../../../../server/env";
import { bad, json, readJson } from "../../../../../server/http";

export const onRequestPost: PagesFunction<Env, "id", { who: Who }> = async ({ request, env, data, params }) => {
  if (data.who.kind !== "runner") return bad("forbidden", 403);
  const b = await readJson<{ status?: string; counts?: Record<string, number>; places_calls?: number; error?: string }>(request);
  if (!b || !["done", "error"].includes(String(b.status))) return bad("status must be done or error");
  const id = Number.parseInt(String(params.id), 10);
  const counts = Object.fromEntries(Object.entries(b.counts ?? {}).filter(([, v]) => Number.isFinite(v)).slice(0, 20));
  const r = await env.DB.prepare(
    `UPDATE search_jobs SET status = ?1, counts_json = ?2, places_calls = ?3, error = ?4, finished_at = datetime('now')
     WHERE id = ?5 AND tenant = ?6 AND status = 'running'`,
  ).bind(b.status, JSON.stringify(counts), Math.max(0, Math.round(Number(b.places_calls) || 0)), b.error ? String(b.error).slice(0, 500) : null, id, data.who.tenant).run();
  if (!r.meta.changes) return bad("job not running", 409);
  await env.DB.prepare("UPDATE saved_searches SET last_run_at = datetime('now') WHERE id = (SELECT saved_search_id FROM search_jobs WHERE id = ?1)").bind(id).run();
  return json(200, { ok: true });
};
