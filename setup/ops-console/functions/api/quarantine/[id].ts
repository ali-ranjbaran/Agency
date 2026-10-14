/** POST { row }: retry a quarantined row with the fields filled in; it's re-validated exactly
 *  like a fresh import and only leaves quarantine when it passes. DELETE: discard it. */
import type { Env, Who } from "../../../server/env";
import { bad, json, readJson } from "../../../server/http";
import { emptyResult, importRow } from "../../../server/importer";

type F = PagesFunction<Env, "id", { who: Who }>;

export const onRequestPost: F = async ({ request, env, data, params }) => {
  const id = Number.parseInt(String(params.id), 10);
  const b = await readJson<{ row?: Record<string, string> }>(request);
  if (!b?.row) return bad("send { row }");
  const q = await env.DB.prepare("SELECT batch FROM import_quarantine WHERE id = ?1 AND tenant = ?2").bind(id, data.who.tenant).first<{ batch: string }>();
  if (!q) return bad("not found", 404);
  const row = Object.fromEntries(Object.entries(b.row).map(([k, v]) => [k, String(v ?? "").trim()]));
  const out = emptyResult();
  try {
    await importRow(env, data.who.tenant, q.batch, row, out, true);
  } catch (e) {
    return bad(String((e as Error).message), 409);
  }
  await env.DB.prepare("DELETE FROM import_quarantine WHERE id = ?1 AND tenant = ?2").bind(id, data.who.tenant).run();
  return json(200, out);
};

export const onRequestDelete: F = async ({ env, data, params }) => {
  await env.DB.prepare("DELETE FROM import_quarantine WHERE id = ?1 AND tenant = ?2").bind(Number.parseInt(String(params.id), 10), data.who.tenant).run();
  return json(200, { ok: true });
};
