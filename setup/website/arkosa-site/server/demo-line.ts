/**
 * Demo line logic shared by functions/api/twilio/voice.ts and sms.ts.
 *
 * Caps are hard: each check and the slot it reserves are one SQL statement, so two
 * calls arriving together can't both squeeze under a cap. Every text counts, text-backs
 * and canned replies alike. Days and months are Saskatoon time (UTC−6 all year).
 *
 * Callers are stored as HMAC-SHA256(PHONE_HASH_KEY, E.164) plus the last 4 digits.
 * The full number exists only in memory, long enough to send the text.
 */
import type { Env } from "./env";
import { int } from "./env";

export const textBackBody = (business: string) =>
  `Sorry we missed you, this is ${business}. What's going on with your furnace? Reply STOP to opt out.`;

export const replyBody = (business: string, minutes: number) =>
  `${business}: thanks, a tech will call you back within ${minutes} min. ` +
  `(Demo: on a real line the owner sees your message instantly.) Reply STOP to opt out.`;

export const business = (env: Env) => env.DEMO_BUSINESS_NAME || "Northgate Heating";

export async function hashCaller(key: string, phone: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(phone));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const last4 = (phone: string) => phone.slice(-4);

const caps = (env: Env) => ({
  windowMin: int(env.DEMO_SMS_CALLER_WINDOW_MIN, 10),
  perDay: int(env.DEMO_SMS_PER_DAY, 50),
  perMonth: int(env.DEMO_SMS_PER_MONTH, 300),
});

// Start of the current Saskatoon day / month, as a UTC 'YYYY-MM-DD HH:MM:SS' string.
const DAY_START = "datetime(date('now','-6 hours'),'+6 hours')";
const MONTH_START = "datetime(date('now','-6 hours','start of month'),'+6 hours')";
const used = (since: string) =>
  `((SELECT COALESCE(SUM(sms_sent),0) FROM demo_calls WHERE created_at >= ${since}) +
    (SELECT COUNT(*) FROM demo_calls WHERE replied_at >= ${since}))`;

/** Labels for the alert dedupe row, in Saskatoon time. */
export function periods(now = Date.now()) {
  const sk = new Date(now - 6 * 3600_000).toISOString();
  return { day: sk.slice(0, 10), month: sk.slice(0, 7) };
}

export type SkipReason = "opted_out" | "recent" | "daily_cap" | "monthly_cap";

/** Logs the call and reserves a text-back slot in one statement. sms_sent = 1 means: send it now. */
export async function reserveTextBack(env: Env, callerHash: string, callerLast4: string, callSid: string) {
  const c = caps(env);
  return env.DB.prepare(
    `INSERT INTO demo_calls (caller_hash, caller_last4, call_sid, sms_sent, skip_reason)
     SELECT ?1, ?2, ?3, reason IS NULL, reason FROM (SELECT CASE
       WHEN EXISTS (SELECT 1 FROM demo_opt_outs WHERE caller_hash = ?1) THEN 'opted_out'
       WHEN EXISTS (SELECT 1 FROM demo_calls WHERE caller_hash = ?1 AND sms_sent = 1
                      AND created_at > datetime('now', ?4)) THEN 'recent'
       WHEN ${used(MONTH_START)} >= ?6 THEN 'monthly_cap'
       WHEN ${used(DAY_START)} >= ?5 THEN 'daily_cap'
     END AS reason)
     RETURNING id, sms_sent, skip_reason`,
  ).bind(callerHash, callerLast4, callSid || null, `-${c.windowMin} minutes`, c.perDay, c.perMonth)
    .first<{ id: number; sms_sent: number; skip_reason: SkipReason | null }>();
}

export const markSendFailed = (env: Env, id: number, status: number) =>
  env.DB.prepare("UPDATE demo_calls SET sms_sent = 0, skip_reason = ?2 WHERE id = ?1").bind(id, `error:${status}`).run();

/**
 * Reserves the one canned reply: only for a caller who got a text-back in the last 24 h
 * that hasn't been replied to, isn't opted out, and only while under both caps.
 * Returns true when the reply should go out.
 */
export async function reserveReply(env: Env, callerHash: string): Promise<boolean> {
  const c = caps(env);
  const row = await env.DB.prepare(
    `UPDATE demo_calls SET reply_sent = 1, replied_at = datetime('now')
     WHERE id = (SELECT id FROM demo_calls WHERE caller_hash = ?1 AND sms_sent = 1 AND reply_sent = 0
                   AND created_at > datetime('now','-1 day') ORDER BY id DESC LIMIT 1)
       AND NOT EXISTS (SELECT 1 FROM demo_opt_outs WHERE caller_hash = ?1)
       AND ${used(MONTH_START)} < ?3
       AND ${used(DAY_START)} < ?2
     RETURNING id`,
  ).bind(callerHash, c.perDay, c.perMonth).first<{ id: number }>();
  return !!row;
}

/** After a reply was refused: was it a cap? (Only used to decide whether to alert.) */
export async function capHit(env: Env): Promise<"daily_cap" | "monthly_cap" | null> {
  const c = caps(env);
  const r = await env.DB.prepare(`SELECT ${used(MONTH_START)} AS month, ${used(DAY_START)} AS day`)
    .first<{ month: number; day: number }>();
  if (!r) return null;
  return r.month >= c.perMonth ? "monthly_cap" : r.day >= c.perDay ? "daily_cap" : null;
}

export const setOptOut = (env: Env, callerHash: string, out: boolean) =>
  out
    ? env.DB.prepare("INSERT OR IGNORE INTO demo_opt_outs (caller_hash) VALUES (?1)").bind(callerHash).run()
    : env.DB.prepare("DELETE FROM demo_opt_outs WHERE caller_hash = ?1").bind(callerHash).run();

/** One email per cap per period. If the email fails, the dedupe row is removed so the next hit retries. */
export async function alertOnce(env: Env, kind: "daily_cap" | "monthly_cap") {
  const c = caps(env);
  const p = periods();
  const period = kind === "daily_cap" ? p.day : p.month;
  const ins = await env.DB.prepare("INSERT OR IGNORE INTO demo_alerts (kind, period) VALUES (?1, ?2)").bind(kind, period).run();
  if (!ins.meta.changes) return;
  const limit = kind === "daily_cap" ? `${c.perDay}/day` : `${c.perMonth}/month`;
  let ok = false;
  try {
    const res = await env.ALERTS?.fetch("https://arkosa-alerts/notify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        subject: `Demo line: ${kind.replace("_", " ")} hit (${period})`,
        text:
          `The demo line reached its ${limit} SMS cap for ${period}. ` +
          `Further text-backs are skipped until the period ends.\n\n` +
          `Check demo_calls in D1 for who called (last 4 digits only). ` +
          `To raise the cap, change DEMO_SMS_PER_${kind === "daily_cap" ? "DAY" : "MONTH"} in wrangler.toml and redeploy.`,
      }),
    });
    ok = !!res?.ok;
  } catch {
    ok = false;
  }
  if (!ok) await env.DB.prepare("DELETE FROM demo_alerts WHERE kind = ?1 AND period = ?2").bind(kind, period).run();
}
