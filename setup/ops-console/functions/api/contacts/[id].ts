/**
 * PATCH: edit a contact, and/or mark it ready to send.
 *   { ready: true, checked_source: true }  sets casl_verified_at + ready_to_send in one statement.
 *   The database refuses it unless all 4 CASL fields and the email are present, the contact
 *   isn't a machine draft, nothing is suppressed, and the company has left the review queue.
 *   Editing any CASL field after the tick clears the tick (trigger), so a change needs a re-check.
 * DELETE: remove a contact.
 */
import type { Env, Who } from "../../../server/env";
import { constraintMessage } from "../../../server/db";
import { bad, json, optStr, readJson } from "../../../server/http";
import { caslMissing } from "../../../shared/casl";
import { normEmail } from "../../../shared/normalize";

type F = PagesFunction<Env, "id", { who: Who }>;
const FIELDS = { name: 120, title: 120, source_url: 500, capture_date: 10, no_refusal_checked_where: 500, relevance_rationale: 1000 } as const;

export const onRequestPatch: F = async ({ request, env, data, params }) => {
  const id = Number.parseInt(String(params.id), 10);
  const t = data.who.tenant;
  const b = await readJson(request);
  if (!b) return bad("bad json");

  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = ?${vals.length + 2}`); };
  for (const [k, max] of Object.entries(FIELDS)) if (k in b) set(k, optStr(b[k], max));
  if ("email" in b) {
    const e = b.email ? normEmail(String(b.email)) : null;
    if (b.email && !e) return bad("invalid email");
    set("email", e);
  }
  try {
    if (sets.length) {
      const r = await env.DB.prepare(`UPDATE contacts SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?1 AND tenant = ?2`).bind(id, t, ...vals).run();
      if (!r.meta.changes) return bad("not found", 404);
    }
    if (b.ready === true) {
      if (b.checked_source !== true) return bad("Tick \"I checked the source page\" first.", 409);
      const c = await env.DB.prepare("SELECT * FROM contacts WHERE id = ?1 AND tenant = ?2").bind(id, t).first<Record<string, string>>();
      if (!c) return bad("not found", 404);
      const missing = caslMissing(c);
      if (missing.length) return bad(`Missing: ${missing.join(", ")}`, 409);
      await env.DB.prepare("UPDATE contacts SET casl_verified_at = datetime('now'), casl_draft = 0, ready_to_send = 1, updated_at = datetime('now') WHERE id = ?1 AND tenant = ?2").bind(id, t).run();
    } else if (b.ready === false) {
      await env.DB.prepare("UPDATE contacts SET ready_to_send = 0, updated_at = datetime('now') WHERE id = ?1 AND tenant = ?2").bind(id, t).run();
    }
    return json(200, { ok: true });
  } catch (e) {
    return bad(constraintMessage(e) ?? "could not save", 409);
  }
};

export const onRequestDelete: F = async ({ env, data, params }) => {
  const r = await env.DB.prepare("DELETE FROM contacts WHERE id = ?1 AND tenant = ?2").bind(Number.parseInt(String(params.id), 10), data.who.tenant).run();
  return r.meta.changes ? json(200, { ok: true }) : bad("not found", 404);
};
