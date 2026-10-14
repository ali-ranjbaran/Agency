/**
 * CSV import of manual prospect rows. Per row:
 *   - suppressed (email, its domain, company domain or phone) → dropped, counted, never stored
 *   - a contact email without all 4 CASL fields → quarantined (fix in the UI, then promote)
 *   - company already known (domain or phone) → reused; a contact email already there → skipped
 * Imported contacts are never ready: the operator still ticks "I checked the source page".
 */
import { caslMissing } from "../shared/casl";
import { emailDomain, normEmail, toDomain, toE164 } from "../shared/normalize";
import { NEXT_ACTION_TYPES, SEGMENTS, isStage } from "../shared/stages";
import type { Env } from "./env";

export type ImportResult = { companies_created: number; companies_matched: number; contacts_created: number; contacts_skipped_duplicate: number; quarantined: number; suppressed_dropped: number; invalid: number; errors: string[] };

export async function importRow(env: Env, tenant: string, batch: string, r: Record<string, string>, out: ImportResult, fromQuarantine = false) {
  const name = (r.company ?? "").trim().slice(0, 160);
  const domain = toDomain(r.domain) ?? null;
  const phone = toE164(r.phone);
  const email = r.email ? normEmail(r.email) : null;
  if (!name) { out.invalid++; out.errors.push(`row without company name skipped`); return; }

  const sup = await env.DB.prepare(
    `SELECT 1 FROM suppression WHERE tenant = ?1 AND ((kind = 'email' AND value = ?2) OR (kind = 'domain' AND value IN (?3, ?4)) OR (kind = 'phone' AND value = ?5)) LIMIT 1`,
  ).bind(tenant, email ?? "", domain ?? "", email ? emailDomain(email) : "", phone ?? "").first();
  if (sup) { out.suppressed_dropped++; return; }

  const hasContact = !!(r.email || r.contact_name || r.source_url);
  if (hasContact) {
    const missing = caslMissing({ email: email ?? r.email, source_url: r.source_url, capture_date: r.capture_date,
      no_refusal_checked_where: r.no_refusal_checked_where, relevance_rationale: r.relevance_rationale });
    if (missing.length) {
      if (fromQuarantine) throw new Error(`still missing: ${missing.join(", ")}`);
      await env.DB.prepare("INSERT INTO import_quarantine (tenant, batch, row_json, missing) VALUES (?1, ?2, ?3, ?4)")
        .bind(tenant, batch, JSON.stringify(r), missing.join(", ")).run();
      out.quarantined++;
      return;
    }
  }

  let company = await env.DB.prepare(
    "SELECT id FROM companies WHERE tenant = ?1 AND ((?2 IS NOT NULL AND domain = ?2) OR (?3 IS NOT NULL AND phone_e164 = ?3)) LIMIT 1",
  ).bind(tenant, domain, phone).first<{ id: number }>();
  if (company) out.companies_matched++;
  else {
    const stage = isStage(r.stage) && r.stage !== "candidate" ? r.stage : "prospect";
    const segment = (SEGMENTS as readonly string[]).includes(r.segment) ? r.segment : "unknown";
    const nat = (NEXT_ACTION_TYPES as readonly string[]).includes(r.next_action_type) ? r.next_action_type : null;
    company = await env.DB.prepare(
      `INSERT INTO companies (tenant, name, domain, phone_e164, city, segment, source, stage, next_action, next_action_type, next_action_due)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'import', ?7, ?8, ?9, ?10) RETURNING id`,
    ).bind(tenant, name, domain, phone, r.city || null, segment, stage, r.next_action || null, nat,
      /^\d{4}-\d{2}-\d{2}$/.test(r.next_action_due ?? "") ? r.next_action_due : null).first<{ id: number }>();
    out.companies_created++;
  }

  if (hasContact && email) {
    const dup = await env.DB.prepare("SELECT 1 FROM contacts WHERE tenant = ?1 AND lower(email) = ?2").bind(tenant, email).first();
    if (dup) { out.contacts_skipped_duplicate++; return; }
    await env.DB.prepare(
      `INSERT INTO contacts (tenant, company_id, name, title, email, source_url, capture_date, no_refusal_checked_where, relevance_rationale)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    ).bind(tenant, company!.id, r.contact_name || null, r.contact_title || null, email, r.source_url, r.capture_date.slice(0, 10),
      r.no_refusal_checked_where, r.relevance_rationale).run();
    out.contacts_created++;
  }
}

export const emptyResult = (): ImportResult => ({ companies_created: 0, companies_matched: 0, contacts_created: 0, contacts_skipped_duplicate: 0, quarantined: 0, suppressed_dropped: 0, invalid: 0, errors: [] });
