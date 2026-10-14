/** GET: the suppression list. POST { kind, value, reason }: append. There is no edit or delete
 *  (the table refuses both); a new row immediately un-readies matching contacts. */
import type { Env, Who } from "../../server/env";
import { bad, json, readJson, str } from "../../server/http";
import { normEmail, toDomain, toE164 } from "../../shared/normalize";

type F = PagesFunction<Env, string, { who: Who }>;

export const onRequestGet: F = async ({ env, data }) => {
  const { results } = await env.DB.prepare("SELECT kind, value, reason, at FROM suppression WHERE tenant = ?1 ORDER BY at DESC LIMIT 2000").bind(data.who.tenant).all();
  return json(200, { suppression: results });
};

export const onRequestPost: F = async ({ request, env, data }) => {
  const b = await readJson(request);
  if (!b) return bad("bad json");
  const kind = String(b.kind);
  const value = kind === "email" ? normEmail(str(b.value)) : kind === "domain" ? toDomain(str(b.value)) : kind === "phone" ? toE164(str(b.value)) : null;
  const reason = str(b.reason, 300);
  if (!value) return bad("kind must be email, domain or phone, with a valid value");
  if (!reason) return bad("a reason is required");
  const dup = await env.DB.prepare("SELECT 1 FROM suppression WHERE tenant = ?1 AND kind = ?2 AND value = ?3").bind(data.who.tenant, kind, value).first();
  if (!dup) await env.DB.prepare("INSERT INTO suppression (tenant, kind, value, reason) VALUES (?1, ?2, ?3, ?4)").bind(data.who.tenant, kind, value, reason).run();
  return json(201, { ok: true, kind, value, already: !!dup });
};
