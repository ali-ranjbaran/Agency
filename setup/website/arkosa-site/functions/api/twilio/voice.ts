/**
 * POST /api/twilio/voice — Twilio "A call comes in" webhook for the demo line.
 *
 * The call is never answered: <Reject reason="busy"> as the first verb means
 * Twilio doesn't pick up and doesn't bill the call. The caller hears busy and
 * gets the text-back a few seconds later, exactly like a missed call.
 *
 * Gates before any SMS goes out: valid Twilio signature, +1 number only, not on
 * the STOP list, max one text-back per number per 24 h, global daily cap.
 */
import type { Env } from "../../../server/env";
import { int } from "../../../server/env";
import { twiml } from "../../../server/http";
import { isNanp, readVerifiedTwilioForm, sendSms } from "../../../server/twilio";

const REJECT = '<Reject reason="busy"/>';

export const textBackBody = (business: string) =>
  `Sorry we missed you, this is ${business}. What's going on with your furnace? ` +
  `(Arkosa demo line.) Reply STOP to opt out.`;

async function textBack(env: Env, from: string, callSid: string) {
  const log = (result: string) =>
    env.DB.prepare("INSERT INTO demo_sms (phone, kind, call_sid, result) VALUES (?1, 'textback', ?2, ?3)")
      .bind(from, callSid, result).run();

  const row = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM opt_outs WHERE phone = ?1) AS opted_out,
       (SELECT COUNT(*) FROM demo_sms WHERE phone = ?1 AND kind = 'textback' AND result = 'sent'
          AND created_at > datetime('now','-1 day')) AS recent,
       (SELECT COUNT(*) FROM demo_sms WHERE result = 'sent' AND created_at > datetime('now','-1 day')) AS day`,
  ).bind(from).first<{ opted_out: number; recent: number; day: number }>();

  if (row?.opted_out) return log("skipped:opted_out");
  if (row?.recent) return log("skipped:recent");
  if ((row?.day ?? 0) >= int(env.DEMO_SMS_PER_DAY, 30)) return log("skipped:daily_cap");

  const res = await sendSms(env, from, textBackBody(env.DEMO_BUSINESS_NAME || "Northgate Heating & Air"));
  return log(res.ok ? "sent" : `error:${res.status}`);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const p = await readVerifiedTwilioForm(request, env.TWILIO_AUTH_TOKEN);
  if (!p) return new Response("forbidden", { status: 403 });

  // Only calls placed TO the demo number, FROM a Canadian/US number.
  if (p.To === env.TWILIO_DEMO_NUMBER && isNanp(p.From)) {
    waitUntil(textBack(env, p.From, p.CallSid ?? "").catch(() => undefined));
  }
  return twiml(REJECT);
};
