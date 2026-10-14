/** POST { reason }: suppress a candidate. Its domain, phone and every email go on the
 *  (append-only) suppression list, and the candidate is removed. */
import type { Env, Who } from "../../../../server/env";
import { bad, json, readJson, str } from "../../../../server/http";

export const onRequestPost: PagesFunction<Env, "id", { who: Who }> = async ({ request, env, data, params }) => {
  const id = Number.parseInt(String(params.id), 10);
  const t = data.who.tenant;
  const reason = str((await readJson(request))?.reason, 300);
  if (!reason) return bad("a reason is required");
  const c = await env.DB.prepare("SELECT domain, phone_e164 FROM companies WHERE id = ?1 AND tenant = ?2 AND stage = 'candidate'").bind(id, t).first<{ domain: string | null; phone_e164: string | null }>();
  if (!c) return bad("not in the review queue", 404);
  const emails = await env.DB.prepare("SELECT DISTINCT lower(email) AS e FROM contacts WHERE company_id = ?1 AND email IS NOT NULL").bind(id).all<{ e: string }>();
  const rows: [string, string][] = [
    ...(c.domain ? [["domain", c.domain] as [string, string]] : []),
    ...(c.phone_e164 ? [["phone", c.phone_e164] as [string, string]] : []),
    ...emails.results.map((r) => ["email", r.e] as [string, string]),
  ];
  await env.DB.batch([
    ...rows.map(([kind, value]) => env.DB.prepare(
      "INSERT INTO suppression (tenant, kind, value, reason) SELECT ?1, ?2, ?3, ?4 WHERE NOT EXISTS (SELECT 1 FROM suppression WHERE tenant = ?1 AND kind = ?2 AND value = ?3)",
    ).bind(t, kind, value, reason)),
    env.DB.prepare("DELETE FROM companies WHERE id = ?1 AND tenant = ?2 AND stage = 'candidate'").bind(id, t),
  ]);
  return json(200, { suppressed: rows.length });
};
