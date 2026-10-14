/**
 * POST { checked: { [contactId]: true } }: approve ONE candidate. There is deliberately no bulk
 * approve: one company per request, by design.
 *   - the company moves to 'prospect'
 *   - every contact stops being a draft
 *   - a contact becomes ready to send ONLY if all 4 CASL fields are present, no refusal statement
 *     was found, nothing is suppressed, AND the operator ticked "I checked the source page" for it
 *     (the database enforces all of that again)
 */
import type { Env, Who } from "../../../../server/env";
import { constraintMessage } from "../../../../server/db";
import { bad, json, readJson } from "../../../../server/http";
import { caslMissing } from "../../../../shared/casl";

export const onRequestPost: PagesFunction<Env, "id", { who: Who }> = async ({ request, env, data, params }) => {
  const id = Number.parseInt(String(params.id), 10);
  const t = data.who.tenant;
  const b = (await readJson<{ checked?: Record<string, boolean> }>(request)) ?? {};
  const c = await env.DB.prepare("SELECT stage FROM companies WHERE id = ?1 AND tenant = ?2").bind(id, t).first<{ stage: string }>();
  if (!c) return bad("not found", 404);
  if (c.stage !== "candidate") return bad("not in the review queue", 409);

  await env.DB.batch([
    env.DB.prepare("UPDATE companies SET stage = 'prospect', updated_at = datetime('now') WHERE id = ?1 AND tenant = ?2").bind(id, t),
    env.DB.prepare("UPDATE contacts SET casl_draft = 0, updated_at = datetime('now') WHERE company_id = ?1 AND tenant = ?2").bind(id, t),
    env.DB.prepare("INSERT INTO touches (tenant, company_id, type, outcome) VALUES (?1, ?2, 'stage_change', 'Candidate → Prospect (approved in review)')").bind(t, id),
  ]);

  const { results } = await env.DB.prepare("SELECT * FROM contacts WHERE company_id = ?1 AND tenant = ?2").bind(id, t).all<{ id: number; email: string | null; source_url: string | null; capture_date: string | null; no_refusal_checked_where: string | null; relevance_rationale: string | null; refusal_found: string | null }>();
  const outcome: { id: number; ready: boolean; why?: string }[] = [];
  for (const k of results) {
    if (b.checked?.[String(k.id)] !== true) { outcome.push({ id: k.id, ready: false, why: "source page not ticked" }); continue; }
    const missing = caslMissing(k);
    if (missing.length) { outcome.push({ id: k.id, ready: false, why: `missing ${missing.join(", ")}` }); continue; }
    if (k.refusal_found) { outcome.push({ id: k.id, ready: false, why: "refusal statement on the source page" }); continue; }
    try {
      await env.DB.prepare("UPDATE contacts SET casl_verified_at = datetime('now'), ready_to_send = 1 WHERE id = ?1 AND tenant = ?2").bind(k.id, t).run();
      outcome.push({ id: k.id, ready: true });
    } catch (e) {
      outcome.push({ id: k.id, ready: false, why: constraintMessage(e) ?? "refused by the database" });
    }
  }
  return json(200, { ok: true, contacts: outcome });
};
