/**
 * POST (runner only): claim the oldest queued search job, atomically, so two runners can never
 * take the same job. First: enqueue saved searches whose monthly schedule is due, and fail jobs
 * left "running" for over 2 hours (runner crashed or the Mac slept).
 */
import type { Env, Who } from "../../../../server/env";
import { bad, json } from "../../../../server/http";

export const onRequestPost: PagesFunction<Env, string, { who: Who }> = async ({ env, data }) => {
  if (data.who.kind !== "runner") return bad("forbidden", 403);
  const t = data.who.tenant;
  await env.DB.batch([
    env.DB.prepare(`UPDATE search_jobs SET status = 'error', error = 'runner stopped mid-job; re-run it', finished_at = datetime('now')
      WHERE tenant = ?1 AND status = 'running' AND claimed_at < datetime('now','-2 hours')`).bind(t),
    env.DB.prepare(`INSERT INTO search_jobs (tenant, saved_search_id, trade, city, radius_km, keywords, sources)
      SELECT tenant, id, trade, city, radius_km, keywords, replace(sources, 'manual', '') FROM saved_searches s
      WHERE s.tenant = ?1 AND s.schedule = 'monthly' AND (s.last_run_at IS NULL OR s.last_run_at < datetime('now','-30 days'))
        AND NOT EXISTS (SELECT 1 FROM search_jobs j WHERE j.saved_search_id = s.id AND j.status IN ('queued','running'))`).bind(t),
    env.DB.prepare(`UPDATE saved_searches SET last_run_at = datetime('now') WHERE tenant = ?1 AND schedule = 'monthly'
      AND (last_run_at IS NULL OR last_run_at < datetime('now','-30 days'))`).bind(t),
  ]);
  const job = await env.DB.prepare(
    `UPDATE search_jobs SET status = 'running', claimed_at = datetime('now')
     WHERE id = (SELECT id FROM search_jobs WHERE tenant = ?1 AND status = 'queued' ORDER BY id LIMIT 1) AND status = 'queued'
     RETURNING id, trade, city, radius_km, keywords, sources, manual_urls`,
  ).bind(t).first<Record<string, unknown>>();
  return json(200, { job: job ? { ...job, manual_urls: job.manual_urls ? JSON.parse(String(job.manual_urls)) : [] } : null });
};
