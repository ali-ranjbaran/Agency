/** Shared queries. Every query is scoped to the caller's tenant. */
import { fitScore } from "../shared/fit-score";
import type { Env } from "./env";

export const CASL_COMPLETE_SQL = (k: string) => `(
  trim(coalesce(${k}.email,'')) <> '' AND trim(coalesce(${k}.source_url,'')) <> '' AND
  trim(coalesce(${k}.capture_date,'')) <> '' AND trim(coalesce(${k}.no_refusal_checked_where,'')) <> '' AND
  trim(coalesce(${k}.relevance_rationale,'')) <> '')`;

export const COMPANY_SUPPRESSED_SQL = (c: string) => `EXISTS (SELECT 1 FROM suppression x WHERE x.tenant = ${c}.tenant AND (
  (x.kind = 'domain' AND x.value = ${c}.domain) OR (x.kind = 'phone' AND x.value = ${c}.phone_e164)))`;

export const CONTACT_SUPPRESSED_SQL = (k: string) => `EXISTS (SELECT 1 FROM suppression x WHERE x.tenant = ${k}.tenant AND (
  (x.kind = 'email' AND x.value = lower(${k}.email)) OR
  (x.kind = 'domain' AND x.value = lower(substr(${k}.email, instr(${k}.email,'@') + 1)))))`;

/** A failed capture is logged as its own row with `error`; it never hides the last good one. */
export const GOOD_SNAPSHOT = "(error IS NULL OR error = 'manual_only')";

const LATEST_SNAPSHOT = `LEFT JOIN site_snapshots s ON s.id = (
  SELECT id FROM site_snapshots WHERE company_id = c.id AND ${GOOD_SNAPSHOT} ORDER BY captured_at DESC, id DESC LIMIT 1)`;

export type CompanyRow = Record<string, unknown> & {
  id: number; name: string; segment: string; source: string; stage: string; lead_id: number | null; fit_override: number | null;
  tel_link: number | null; phone_above_fold_mobile: number | null; lh_mobile_perf: number | null; form: number | null;
  https: number | null; review_count: number | null; competitor_review_count: number | null;
};

export const withFit = <T extends CompanyRow>(r: T) => ({
  ...r,
  fit: fitScore({
    segment: r.segment, source: r.source, lead_id: r.lead_id,
    snapshot: r.snap_id ? {
      tel_link: r.tel_link, phone_above_fold_mobile: r.phone_above_fold_mobile, lh_mobile_perf: r.lh_mobile_perf,
      form: r.form, https: r.https, review_count: r.review_count, competitor_review_count: r.competitor_review_count,
    } : null,
  }, r.fit_override),
});

export async function listCompanies(env: Env, tenant: string, where = "c.stage <> 'candidate'", binds: unknown[] = []) {
  const { results } = await env.DB.prepare(
    `SELECT c.*, s.id AS snap_id, s.captured_at AS snap_at, s.tel_link, s.phone_above_fold_mobile, s.lh_mobile_perf,
            s.form, s.https, s.review_count, s.competitor_review_count,
            (SELECT max(at) FROM touches t WHERE t.company_id = c.id) AS last_touch_at,
            EXISTS (SELECT 1 FROM contacts k WHERE k.company_id = c.id AND ${CASL_COMPLETE_SQL("k")}
                      AND NOT ${CONTACT_SUPPRESSED_SQL("k")}) AS casl_complete,
            (SELECT count(*) FROM contacts k WHERE k.company_id = c.id AND k.ready_to_send = 1) AS ready_contacts,
            ${COMPANY_SUPPRESSED_SQL("c")} AS suppressed
     FROM companies c ${LATEST_SNAPSHOT}
     WHERE c.tenant = ?1 AND ${where}
     ORDER BY c.next_action_due IS NULL, c.next_action_due, c.name`,
  ).bind(tenant, ...binds).all<CompanyRow>();
  return results.map(withFit);
}

/** HMAC-SHA256 hex, the same scheme the website uses for demo_calls.caller_hash. */
export async function hmacHex(key: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** demo_calls is the website's table and may not exist yet (demo line not deployed). Read-only. */
export async function demoCalls(env: Env, sinceSql = "-7 days"): Promise<{ created_at: string; caller_hash: string; caller_last4: string; sms_sent: number; reply_sent: number }[]> {
  try {
    const { results } = await env.DB.prepare(
      "SELECT created_at, caller_hash, caller_last4, sms_sent, reply_sent FROM demo_calls WHERE created_at > datetime('now', ?1) ORDER BY created_at DESC LIMIT 200",
    ).bind(sinceSql).all<{ created_at: string; caller_hash: string; caller_last4: string; sms_sent: number; reply_sent: number }>();
    return results;
  } catch (e) {
    if (/no such table/i.test(String(e))) return [];
    throw e;
  }
}

/** Matches demo calls to companies by hashing each company phone with PHONE_HASH_KEY. */
export async function phoneHashes(env: Env, companies: { id: number; name: string; phone_e164: string | null }[]) {
  const map = new Map<string, { id: number; name: string }>();
  if (!env.PHONE_HASH_KEY) return map;
  for (const c of companies) if (c.phone_e164) map.set(await hmacHex(env.PHONE_HASH_KEY, c.phone_e164), { id: c.id, name: c.name });
  return map;
}

/** Signed, short-lived screenshot URL: /api/snapshots/:id/:view?exp=&sig= (still behind Access). */
export async function snapshotUrl(env: Env, id: number, view: "desktop" | "mobile" | `qa-${number}`, ttlSec = 300) {
  if (!env.SNAPSHOT_URL_KEY) return null;
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = await hmacHex(env.SNAPSHOT_URL_KEY, `${id}:${view}:${exp}`);
  return `/api/snapshots/${id}/${view}?exp=${exp}&sig=${sig}`;
}

export async function checkSnapshotSig(env: Env, id: number, view: string, exp: number, sig: string) {
  if (!env.SNAPSHOT_URL_KEY || !(exp > Date.now() / 1000) || exp > Date.now() / 1000 + 3600) return false;
  const want = await hmacHex(env.SNAPSHOT_URL_KEY, `${id}:${view}:${exp}`);
  if (want.length !== sig.length) return false;
  let d = 0;
  for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return d === 0;
}

/** D1 surfaces trigger/CHECK failures as error text; map the ones the UI should explain. */
export function constraintMessage(e: unknown): string | null {
  const m = String((e as Error)?.message ?? e);
  if (m.includes("suppressed")) return "Suppressed: this email, domain or phone is on the suppression list.";
  if (m.includes("company not approved")) return "This company is still in the review queue. Approve it first.";
  if (m.includes("CHECK constraint failed")) return "All 4 CASL fields, a valid email and the source-page tick are required.";
  if (m.includes("UNIQUE constraint failed")) return "A company with this domain already exists.";
  if (m.includes("append-only")) return "The suppression list is append-only.";
  return null;
}
