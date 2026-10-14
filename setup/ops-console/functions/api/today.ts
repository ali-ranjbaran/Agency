/** Today: calls due, follow-ups due, new inbound leads, demo-line calls (last 7 days). */
import type { Env, Who } from "../../server/env";
import { demoCalls, listCompanies, phoneHashes } from "../../server/db";
import { json, today } from "../../server/http";
import { newLeads } from "./leads/index";

export const onRequestGet: PagesFunction<Env, string, { who: Who }> = async ({ env, data }) => {
  const t = data.who.tenant;
  const d = today();
  const companies = await listCompanies(env, t, "c.stage NOT IN ('candidate','won','lost')");
  const due = companies.filter((c) => c.next_action_due && String(c.next_action_due) <= d && !c.suppressed);
  const [leads, calls, hashes] = await Promise.all([newLeads(env, t), demoCalls(env, "-7 days"), phoneHashes(env, companies as never)]);
  return json(200, {
    date: d,
    calls_due: due.filter((c) => c.next_action_type === "call"),
    follow_ups_due: due.filter((c) => c.next_action_type !== "call"),
    new_leads: leads,
    demo_calls: calls.map((c) => ({ at: c.created_at, last4: c.caller_last4, sms_sent: c.sms_sent, reply_sent: c.reply_sent, company: hashes.get(c.caller_hash) ?? null })),
  });
};
