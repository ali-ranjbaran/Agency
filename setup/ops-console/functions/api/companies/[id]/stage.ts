/** POST { stage, note? }: move a company (board drag or dropdown). Always logs a stage_change touch.
 *  Leaving 'candidate' goes through the review queue's approve route, not here. */
import type { Env, Who } from "../../../../server/env";
import { bad, json, optStr, readJson } from "../../../../server/http";
import { STAGE_LABEL, isStage } from "../../../../shared/stages";

export const onRequestPost: PagesFunction<Env, "id", { who: Who }> = async ({ request, env, data, params }) => {
  const id = Number.parseInt(String(params.id), 10);
  const b = await readJson(request);
  if (!b || !isStage(b.stage) || b.stage === "candidate") return bad("bad stage");
  const cur = await env.DB.prepare("SELECT stage FROM companies WHERE id = ?1 AND tenant = ?2").bind(id, data.who.tenant).first<{ stage: string }>();
  if (!cur) return bad("not found", 404);
  if (cur.stage === "candidate") return bad("Approve this company in the review queue first.", 409);
  if (cur.stage === b.stage) return json(200, { ok: true, unchanged: true });
  await env.DB.batch([
    env.DB.prepare("UPDATE companies SET stage = ?1, updated_at = datetime('now') WHERE id = ?2 AND tenant = ?3").bind(b.stage, id, data.who.tenant),
    env.DB.prepare("INSERT INTO touches (tenant, company_id, type, outcome, notes) VALUES (?1, ?2, 'stage_change', ?3, ?4)")
      .bind(data.who.tenant, id, `${STAGE_LABEL[cur.stage as keyof typeof STAGE_LABEL] ?? cur.stage} → ${STAGE_LABEL[b.stage]}`, optStr(b.note, 1000)),
  ]);
  return json(200, { ok: true });
};
