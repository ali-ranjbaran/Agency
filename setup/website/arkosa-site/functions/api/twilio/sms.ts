/**
 * POST /api/twilio/sms — Twilio "A message comes in" webhook for the demo line.
 *
 * STOP / START are recorded in opt_outs. Twilio's own opt-out handling sends
 * the carrier confirmation and blocks further sends on its side too; this
 * table is our copy, checked before every text-back.
 *
 * Any other reply gets one fixed explanation per number per day. Nothing a
 * prospect texts here is stored.
 */
import type { Env } from "../../../server/env";
import { twiml, xmlEscape } from "../../../server/http";
import { isNanp, keyword, readVerifiedTwilioForm } from "../../../server/twilio";

export const DEMO_REPLY =
  "This is an Arkosa demo line. On a real setup, your reply goes straight to the owner's phone so they can call you back. Reply STOP to opt out.";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const p = await readVerifiedTwilioForm(request, env.TWILIO_AUTH_TOKEN);
  if (!p) return new Response("forbidden", { status: 403 });
  const from = p.From;
  if (!isNanp(from)) return twiml();

  const kw = keyword(p.Body);
  if (kw === "stop") {
    await env.DB.prepare("INSERT OR IGNORE INTO opt_outs (phone) VALUES (?1)").bind(from).run();
    return twiml(); // Twilio sends the opt-out confirmation itself
  }
  if (kw === "start") {
    await env.DB.prepare("DELETE FROM opt_outs WHERE phone = ?1").bind(from).run();
    return twiml();
  }

  const row = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM opt_outs WHERE phone = ?1) AS opted_out,
       (SELECT COUNT(*) FROM demo_sms WHERE phone = ?1 AND kind = 'reply'
          AND created_at > datetime('now','-1 day')) AS recent`,
  ).bind(from).first<{ opted_out: number; recent: number }>();
  if (row?.opted_out || row?.recent) return twiml();

  await env.DB.prepare("INSERT INTO demo_sms (phone, kind, result) VALUES (?1, 'reply', 'sent')").bind(from).run();
  return twiml(`<Message>${xmlEscape(DEMO_REPLY)}</Message>`);
};
