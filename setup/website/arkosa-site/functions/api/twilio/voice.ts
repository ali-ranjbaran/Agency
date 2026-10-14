/**
 * POST /api/twilio/voice — Twilio "A call comes in" webhook for the demo line.
 *
 * The call is never answered: <Reject reason="busy"> as the first verb means
 * Twilio doesn't pick up and doesn't bill the call (docs: TwiML <Reject>). The
 * caller hears busy and gets the text-back a few seconds later, like a missed call.
 *
 * Gates before any SMS goes out: valid Twilio signature, a call TO the demo number
 * FROM a +1 number, then one SQL statement that logs the call to demo_calls and
 * reserves a slot only if the caller isn't opted out, hasn't had a text in the last
 * DEMO_SMS_CALLER_WINDOW_MIN minutes, and the day and month caps have room.
 */
import type { Env } from "../../../server/env";
import { twiml } from "../../../server/http";
import { isNanp, readVerifiedTwilioForm, sendSms } from "../../../server/twilio";
import { alertOnce, business, hashCaller, last4, markSendFailed, reserveTextBack, textBackBody } from "../../../server/demo-line";

const REJECT = '<Reject reason="busy"/>';

async function textBack(env: Env, from: string, callSid: string) {
  if (!env.PHONE_HASH_KEY) return; // fail closed: no key, no log, no text
  const row = await reserveTextBack(env, await hashCaller(env.PHONE_HASH_KEY, from), last4(from), callSid);
  if (!row) return;
  if (row.skip_reason === "daily_cap" || row.skip_reason === "monthly_cap") return alertOnce(env, row.skip_reason);
  if (!row.sms_sent) return;
  const res = await sendSms(env, from, textBackBody(business(env)));
  if (!res.ok) await markSendFailed(env, row.id, res.status);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const p = await readVerifiedTwilioForm(request, env.TWILIO_AUTH_TOKEN);
  if (!p) return new Response("forbidden", { status: 403 });

  if (p.To === env.TWILIO_DEMO_NUMBER && isNanp(p.From)) {
    waitUntil(textBack(env, p.From, p.CallSid ?? "").catch(() => undefined));
  }
  return twiml(REJECT);
};
