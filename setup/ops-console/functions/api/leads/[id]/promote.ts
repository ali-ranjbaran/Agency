/**
 * POST: turn an inbound lead into a company + contact in the pipeline (stage "conversation":
 * they reached out). Reads `leads`, writes only console tables. The CASL fields are pre-filled
 * from the inquiry, but the contact is not ready until the operator ticks the check.
 */
import type { Env, Who } from "../../../../server/env";
import { constraintMessage } from "../../../../server/db";
import { bad, json } from "../../../../server/http";
import { normEmail, toDomain, toE164 } from "../../../../shared/normalize";
import { readLeads } from "../index";

export const onRequestPost: PagesFunction<Env, "id", { who: Who }> = async ({ env, data, params }) => {
  const id = Number.parseInt(String(params.id), 10);
  const t = data.who.tenant;
  const [lead] = await readLeads(env, t, `l.id = ${Number.isFinite(id) ? id : -1}`);
  if (!lead) return bad("not found", 404);
  if (lead.company_id) return json(200, { id: lead.company_id, already: true });

  const email = normEmail(lead.email);
  const domain = email && !/@(gmail|hotmail|outlook|yahoo|icloud|live|sasktel|shaw)\./.test(email) ? toDomain(email) : null;
  const trade = String(lead.trade ?? "").toLowerCase() || "hvac";
  try {
    const c = await env.DB.prepare(
      `INSERT INTO companies (tenant, name, domain, phone_e164, city, trade, source, stage, lead_id, next_action, next_action_type, next_action_due)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'inbound', 'conversation', ?7, 'Reply to inbound inquiry', 'email', date('now','-6 hours')) RETURNING id`,
    ).bind(t, lead.company, domain, toE164(lead.phone), lead.city, trade, lead.id).first<{ id: number }>();
    if (email) {
      await env.DB.prepare(
        `INSERT INTO contacts (tenant, company_id, name, email, source_url, capture_date, no_refusal_checked_where, relevance_rationale)
         VALUES (?1, ?2, ?3, ?4, 'https://thearkosa.com/#start', substr(?5, 1, 10), 'Inbound inquiry: they contacted Arkosa through the website form', ?6)`,
      ).bind(t, c!.id, lead.name, email, lead.created_at, `They asked Arkosa about their ${lead.trade ?? "trade"} business through the website form.`).run();
    }
    return json(201, { id: c!.id });
  } catch (e) {
    return bad(constraintMessage(e) ?? "could not promote", 409);
  }
};
