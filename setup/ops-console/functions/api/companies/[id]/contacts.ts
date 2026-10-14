/** POST: add a contact. Contacts are always created not-ready; the operator marks them ready
 *  later, after checking the source page (PATCH /api/contacts/:id). */
import type { Env, Who } from "../../../../server/env";
import { constraintMessage } from "../../../../server/db";
import { bad, json, optStr, readJson } from "../../../../server/http";
import { normEmail } from "../../../../shared/normalize";

export const onRequestPost: PagesFunction<Env, "id", { who: Who }> = async ({ request, env, data, params }) => {
  const id = Number.parseInt(String(params.id), 10);
  const b = await readJson(request);
  if (!b) return bad("bad json");
  const email = b.email ? normEmail(String(b.email)) : null;
  if (b.email && !email) return bad("invalid email");
  const ok = await env.DB.prepare("SELECT 1 FROM companies WHERE id = ?1 AND tenant = ?2").bind(id, data.who.tenant).first();
  if (!ok) return bad("not found", 404);
  try {
    const r = await env.DB.prepare(
      `INSERT INTO contacts (tenant, company_id, name, title, email, source_url, capture_date, no_refusal_checked_where, relevance_rationale)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) RETURNING id`,
    ).bind(data.who.tenant, id, optStr(b.name, 120), optStr(b.title, 120), email, optStr(b.source_url, 500),
      optStr(b.capture_date, 10), optStr(b.no_refusal_checked_where, 500), optStr(b.relevance_rationale, 1000)).first<{ id: number }>();
    return json(201, { id: r!.id });
  } catch (e) {
    return bad(constraintMessage(e) ?? "could not save", 409);
  }
};
