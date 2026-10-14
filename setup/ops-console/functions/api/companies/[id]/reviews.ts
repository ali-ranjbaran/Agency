/** POST { review_count, competitor_review_count, competitor_name }: manual review counts (v1),
 *  stored on the latest snapshot row. The snapshot runner carries them forward to newer rows. */
import type { Env, Who } from "../../../../server/env";
import { GOOD_SNAPSHOT } from "../../../../server/db";
import { bad, intOrNull, json, optStr, readJson } from "../../../../server/http";

export const onRequestPost: PagesFunction<Env, "id", { who: Who }> = async ({ request, env, data, params }) => {
  const id = Number.parseInt(String(params.id), 10);
  const b = await readJson(request);
  if (!b) return bad("bad json");
  const t = data.who.tenant;
  const ok = await env.DB.prepare("SELECT 1 FROM companies WHERE id = ?1 AND tenant = ?2").bind(id, t).first();
  if (!ok) return bad("not found", 404);
  const latest = await env.DB.prepare(`SELECT id FROM site_snapshots WHERE company_id = ?1 AND tenant = ?2 AND ${GOOD_SNAPSHOT}
    ORDER BY captured_at DESC, id DESC LIMIT 1`).bind(id, t).first<{ id: number }>();
  const vals = [intOrNull(b.review_count), intOrNull(b.competitor_review_count), optStr(b.competitor_name, 120)];
  if (latest) {
    await env.DB.prepare("UPDATE site_snapshots SET review_count = ?1, competitor_review_count = ?2, competitor_name = ?3 WHERE id = ?4").bind(...vals, latest.id).run();
  } else {
    await env.DB.prepare("INSERT INTO site_snapshots (tenant, company_id, review_count, competitor_review_count, competitor_name, error) VALUES (?1, ?2, ?3, ?4, ?5, 'manual_only')")
      .bind(t, id, ...vals).run();
  }
  return json(200, { ok: true });
};
