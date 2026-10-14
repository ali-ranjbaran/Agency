/** GET: one company with contacts, timeline (touches + matched demo calls), latest snapshot
 *  (signed screenshot URLs) and the fit breakdown. PATCH: edit company fields. */
import type { Env, Who } from "../../../../server/env";
import { CONTACT_SUPPRESSED_SQL, GOOD_SNAPSHOT, constraintMessage, demoCalls, hmacHex, listCompanies, snapshotUrl } from "../../../../server/db";
import { bad, json, optStr, readJson, str } from "../../../../server/http";
import { toDomain, toE164 } from "../../../../shared/normalize";
import { NEXT_ACTION_TYPES, SEGMENTS } from "../../../../shared/stages";

type F = PagesFunction<Env, "id", { who: Who }>;
const idOf = (p: string | string[]) => Number.parseInt(String(p), 10);

export const onRequestGet: F = async ({ env, data, params }) => {
  const id = idOf(params.id);
  const t = data.who.tenant;
  const [company] = await listCompanies(env, t, "c.id = ?2", [id]);
  if (!company) return bad("not found", 404);

  const [contacts, touches, snapshot, sources] = await Promise.all([
    env.DB.prepare(`SELECT k.*, ${CONTACT_SUPPRESSED_SQL("k")} AS suppressed FROM contacts k WHERE k.company_id = ?1 AND k.tenant = ?2 ORDER BY k.id`).bind(id, t).all(),
    env.DB.prepare("SELECT * FROM touches WHERE company_id = ?1 AND tenant = ?2 ORDER BY at DESC LIMIT 200").bind(id, t).all(),
    env.DB.prepare(`SELECT *, (SELECT error || ' (' || captured_at || ')' FROM site_snapshots e WHERE e.company_id = ?1 AND e.error IS NOT NULL
                      AND e.error <> 'manual_only' ORDER BY e.captured_at DESC LIMIT 1) AS last_error
                    FROM site_snapshots WHERE company_id = ?1 AND tenant = ?2 AND ${GOOD_SNAPSHOT} ORDER BY captured_at DESC, id DESC LIMIT 1`)
      .bind(id, t).first<Record<string, unknown> & { id: number; desktop_key: string | null; mobile_key: string | null }>(),
    env.DB.prepare("SELECT * FROM company_sources WHERE company_id = ?1 ORDER BY id").bind(id).all().catch(() => ({ results: [] })),
  ]);

  // Demo calls attach on read: hash the company phone the way the demo line hashes callers.
  let demo: { at: string; last4: string; sms_sent: number; reply_sent: number }[] = [];
  if (company.phone_e164 && env.PHONE_HASH_KEY) {
    const h = await hmacHex(env.PHONE_HASH_KEY, String(company.phone_e164));
    demo = (await demoCalls(env, "-365 days")).filter((d) => d.caller_hash === h)
      .map((d) => ({ at: d.created_at, last4: d.caller_last4, sms_sent: d.sms_sent, reply_sent: d.reply_sent }));
  }

  const shots = snapshot ? {
    ...snapshot,
    desktop_url: snapshot.desktop_key ? await snapshotUrl(env, snapshot.id, "desktop") : null,
    mobile_url: snapshot.mobile_key ? await snapshotUrl(env, snapshot.id, "mobile") : null,
  } : null;

  return json(200, { company, contacts: contacts.results, touches: touches.results, demo_calls: demo, snapshot: shots, sources: sources.results });
};

export const onRequestPatch: F = async ({ request, env, data, params }) => {
  const id = idOf(params.id);
  const b = await readJson(request);
  if (!b) return bad("bad json");
  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = ?${vals.length + 2}`); };
  if ("name" in b) { const n = str(b.name, 160); if (!n) return bad("name is required"); set("name", n); }
  if ("domain" in b) set("domain", toDomain(str(b.domain)));
  if ("phone" in b) set("phone_e164", toE164(str(b.phone)));
  if ("city" in b) set("city", optStr(b.city, 80));
  if ("segment" in b) { if (!(SEGMENTS as readonly string[]).includes(String(b.segment))) return bad("bad segment"); set("segment", b.segment); }
  if ("next_action" in b) set("next_action", optStr(b.next_action, 200));
  if ("next_action_type" in b) set("next_action_type", (NEXT_ACTION_TYPES as readonly string[]).includes(String(b.next_action_type)) ? b.next_action_type : null);
  if ("next_action_due" in b) set("next_action_due", /^\d{4}-\d{2}-\d{2}$/.test(String(b.next_action_due)) ? b.next_action_due : null);
  if ("fit_override" in b) set("fit_override", Number.isFinite(Number(b.fit_override)) && b.fit_override !== null && b.fit_override !== "" ? Number(b.fit_override) : null);
  if ("notes" in b) set("notes", optStr(b.notes, 4000));
  if (!sets.length) return bad("nothing to change");
  try {
    const r = await env.DB.prepare(`UPDATE companies SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?1 AND tenant = ?2`)
      .bind(id, data.who.tenant, ...vals).run();
    return r.meta.changes ? json(200, { ok: true }) : bad("not found", 404);
  } catch (e) {
    return bad(constraintMessage(e) ?? "could not save", 409);
  }
};
