/** POST { type, outcome?, at?, notes? }: log a touch. stage_change is reserved for the stage route. */
import type { Env, Who } from "../../../../server/env";
import { bad, json, optStr, readJson } from "../../../../server/http";
import { TOUCH_TYPES } from "../../../../shared/stages";

export const onRequestPost: PagesFunction<Env, "id", { who: Who }> = async ({ request, env, data, params }) => {
  const id = Number.parseInt(String(params.id), 10);
  const b = await readJson(request);
  if (!b || !(TOUCH_TYPES as readonly string[]).includes(String(b.type)) || b.type === "stage_change") return bad("bad touch type");
  const at = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(String(b.at ?? "")) ? String(b.at).replace("T", " ") : null;
  const ok = await env.DB.prepare("SELECT 1 FROM companies WHERE id = ?1 AND tenant = ?2").bind(id, data.who.tenant).first();
  if (!ok) return bad("not found", 404);
  await env.DB.prepare("INSERT INTO touches (tenant, company_id, type, outcome, at, notes) VALUES (?1, ?2, ?3, ?4, coalesce(?5, datetime('now')), ?6)")
    .bind(data.who.tenant, id, b.type, optStr(b.outcome, 200), at, optStr(b.notes, 4000)).run();
  return json(201, { ok: true });
};
