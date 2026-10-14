/**
 * Lead generator, server side. The Mac runner finds and enriches firms; this module is the
 * authority on what becomes a candidate:
 *   - suppressed (domain, phone, any email) → dropped and counted, never stored or shown
 *   - already known (a company with the same domain, phone, place_id or osm ref) → counted, skipped
 *   - previously rejected (any key) → counted, skipped
 *   - otherwise → company with stage 'candidate' + draft contacts (casl_draft = 1, never ready)
 */
import type { Env } from "./env";
import { emailDomain, normEmail, toDomain, toE164 } from "../shared/normalize";

export const searchKey = (trade: string, city: string) => `${trade.trim().toLowerCase()}|${city.trim().toLowerCase()}`;

export type FirmKeys = { domain?: string | null; phone?: string | null; place_ids?: string[]; osm_refs?: string[]; emails?: string[] };

/** What do we already know about this firm? Checked in the order that matters. */
export async function classify(env: Env, tenant: string, k: FirmKeys): Promise<"suppressed" | "known" | "rejected" | "new"> {
  const domain = toDomain(k.domain) ?? "";
  const phone = toE164(k.phone) ?? "";
  const emails = (k.emails ?? []).map((e) => normEmail(e)).filter((e): e is string => !!e);
  const emailDomains = emails.map(emailDomain);
  const places = k.place_ids ?? [], osm = k.osm_refs ?? [];
  // Scraped values are untrusted: quotes are escaped, and lists are capped (D1 limits bound params).
  const inList = (arr: string[]) => (arr.length ? arr.slice(0, 50).map((v) => `'${String(v).slice(0, 600).replace(/'/g, "''")}'`).join(",") : "''");

  const sup = await env.DB.prepare(
    `SELECT 1 FROM suppression WHERE tenant = ?1 AND (
       (kind = 'domain' AND value IN (?2, ${inList(emailDomains)})) OR (kind = 'phone' AND value = ?3) OR (kind = 'email' AND value IN (${inList(emails)}))) LIMIT 1`,
  ).bind(tenant, domain, phone).first();
  if (sup) return "suppressed";

  const known = await env.DB.prepare(
    `SELECT 1 FROM companies c WHERE c.tenant = ?1 AND ((?2 <> '' AND c.domain = ?2) OR (?3 <> '' AND c.phone_e164 = ?3)
       OR EXISTS (SELECT 1 FROM company_sources s WHERE s.company_id = c.id AND s.source_ref IN (${inList([...places, ...osm])}))) LIMIT 1`,
  ).bind(tenant, domain, phone).first();
  if (known) return "known";

  const rej = await env.DB.prepare(
    `SELECT 1 FROM rejections WHERE tenant = ?1 AND ((?2 <> '' AND domain = ?2) OR (?3 <> '' AND phone_e164 = ?3)
       OR place_id IN (${inList(places)}) OR osm_ref IN (${inList(osm)})) LIMIT 1`,
  ).bind(tenant, domain, phone).first();
  return rej ? "rejected" : "new";
}

export type CandidateIn = {
  name: string; domain?: string | null; phone?: string | null; city?: string | null; segment?: string;
  enrichment?: Record<string, unknown>;
  sources: { source: "osm" | "places" | "manual"; ref: string; attribution?: string | null }[];
  contacts: {
    email: string; name?: string | null; title?: string | null; flags?: string[];
    source_url: string; capture_date: string; no_refusal_checked_where: string; relevance_rationale: string; refusal_found?: string | null;
  }[];
};

const SEGMENTS = new Set(["residential", "commercial", "mixed", "unknown"]);
const SOURCES = new Set(["osm", "places", "manual"]);

/** Inserts one candidate (after re-classifying it server-side). Returns the outcome. */
export async function addCandidate(env: Env, tenant: string, job: { id: number; trade: string; city: string }, c: CandidateIn) {
  const sources = (c.sources ?? []).filter((s) => SOURCES.has(s.source) && typeof s.ref === "string" && s.ref.length < 600);
  const keys: FirmKeys = {
    domain: c.domain, phone: c.phone, emails: (c.contacts ?? []).map((x) => x.email),
    place_ids: sources.filter((s) => s.source === "places").map((s) => s.ref),
    osm_refs: sources.filter((s) => s.source === "osm").map((s) => s.ref),
  };
  const verdict = await classify(env, tenant, keys);
  if (verdict !== "new") return { verdict, id: null as number | null, domain: null as string | null };

  const name = String(c.name ?? "").trim().slice(0, 160) || toDomain(c.domain) || "Unnamed firm";
  const domain = toDomain(c.domain);
  const row = await env.DB.prepare(
    `INSERT INTO companies (tenant, name, domain, phone_e164, city, trade, segment, source, stage, search_key, enrichment_json)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'candidate', ?9, ?10) RETURNING id`,
  ).bind(tenant, name, domain, toE164(c.phone), (c.city ?? job.city)?.slice(0, 80) ?? null, job.trade.toLowerCase(),
    SEGMENTS.has(String(c.segment)) ? c.segment : "unknown", sources[0]?.source ?? "manual", searchKey(job.trade, job.city),
    JSON.stringify(c.enrichment ?? {}).slice(0, 20_000)).first<{ id: number }>();
  const id = row!.id;

  const stmts: D1PreparedStatement[] = sources.map((s) =>
    env.DB.prepare("INSERT OR IGNORE INTO company_sources (tenant, company_id, source, source_ref, attribution, job_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
      .bind(tenant, id, s.source, s.ref, s.attribution ?? null, job.id));
  const seen = new Set<string>();
  for (const k of c.contacts ?? []) {
    const email = normEmail(k.email);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    stmts.push(env.DB.prepare(
      `INSERT INTO contacts (tenant, company_id, name, title, email, source_url, capture_date, no_refusal_checked_where, relevance_rationale,
         casl_draft, email_flags, refusal_found) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, ?10, ?11)`,
    ).bind(tenant, id, k.name?.slice(0, 120) ?? null, k.title?.slice(0, 120) ?? null, email, String(k.source_url).slice(0, 500),
      String(k.capture_date).slice(0, 10), String(k.no_refusal_checked_where).slice(0, 800), String(k.relevance_rationale).slice(0, 1000),
      (k.flags ?? []).filter((f) => ["role", "freemail", "isp"].includes(f)).join(","), k.refusal_found?.slice(0, 300) ?? null));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return { verdict, id, domain };
}

/** Universe counters per trade + city. "found" = everything a search ever surfaced (kept or rejected). */
export async function universe(env: Env, tenant: string) {
  const { results } = await env.DB.prepare(
    `SELECT k AS search_key,
       (SELECT count(*) FROM companies WHERE tenant = ?1 AND search_key = k) + (SELECT count(*) FROM rejections WHERE tenant = ?1 AND search_key = k) AS found,
       (SELECT count(*) FROM companies WHERE tenant = ?1 AND search_key = k AND stage = 'candidate') AS in_review,
       (SELECT count(*) FROM companies WHERE tenant = ?1 AND search_key = k AND stage <> 'candidate') AS approved,
       (SELECT count(*) FROM rejections WHERE tenant = ?1 AND search_key = k) AS rejected,
       (SELECT count(*) FROM companies WHERE tenant = ?1 AND search_key = k AND stage NOT IN ('candidate','prospect')) AS contacted
     FROM (SELECT DISTINCT search_key AS k FROM companies WHERE tenant = ?1 AND search_key IS NOT NULL
           UNION SELECT DISTINCT search_key FROM rejections WHERE tenant = ?1 AND search_key IS NOT NULL
           UNION SELECT lower(trade) || '|' || lower(city) FROM saved_searches WHERE tenant = ?1)
     ORDER BY k`,
  ).bind(tenant).all();
  return results;
}

/** Sends one operator email through the arkosa-alerts Worker. Never throws. */
export async function alert(env: Env, subject: string, text: string) {
  try {
    const r = await env.ALERTS?.fetch("https://arkosa-alerts/notify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject, text }) });
    return !!r?.ok;
  } catch { return false; }
}
