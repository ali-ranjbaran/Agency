/**
 * POST /api/twilio/sms — Twilio "A message comes in" webhook for the demo line.
 *
 * STOP / START: Twilio handles the opt-out itself on long codes, sends the carrier
 * confirmation, and still forwards the message here with OptOutType set (docs:
 * Advanced Opt-Out). We keep our own copy in demo_opt_outs, checked before every send.
 * HELP is left to Twilio.
 *
 * Anything else: one canned reply showing what the owner would see, only to a caller
 * who got a text-back in the last 24 h and hasn't had the reply yet. After that,
 * silence. No AI, no thread. The message text is never stored.
 */
import type { Env } from "../../../server/env";
import { int } from "../../../server/env";
import { twiml, xmlEscape } from "../../../server/http";
import { isNanp, keyword, readVerifiedTwilioForm } from "../../../server/twilio";
import { alertOnce, business, capHit, hashCaller, replyBody, reserveReply, setOptOut } from "../../../server/demo-line";

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const p = await readVerifiedTwilioForm(request, env.TWILIO_AUTH_TOKEN);
  if (!p) return new Response("forbidden", { status: 403 });
  if (p.To !== env.TWILIO_DEMO_NUMBER || !isNanp(p.From) || !env.PHONE_HASH_KEY) return twiml();

  const caller = await hashCaller(env.PHONE_HASH_KEY, p.From);
  const kw = keyword(p.Body, p.OptOutType);
  if (kw === "stop" || kw === "start") {
    await setOptOut(env, caller, kw === "stop");
    return twiml(); // Twilio sends the confirmation itself
  }
  if (kw === "help") return twiml();

  if (await reserveReply(env, caller)) {
    return twiml(`<Message>${xmlEscape(replyBody(business(env), int(env.DEMO_CALLBACK_MIN, 15)))}</Message>`);
  }
  waitUntil(capHit(env).then((cap) => (cap ? alertOnce(env, cap) : undefined)).catch(() => undefined));
  return twiml();
};
