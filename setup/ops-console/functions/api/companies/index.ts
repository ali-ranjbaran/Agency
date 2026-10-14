/** GET: every company outside the review queue, with fit, last touch, CASL and suppression flags.
 *  The market is small (hundreds of rows), so the UI sorts, filters and searches client-side.
 *  POST: add one company by hand. */
import type { Env, Who } from "../../../server/env";
import { constraintMessage, listCompanies } from "../../../server/db";
import { bad, json, optStr, readJson, str } from "../../../server/http";
import { toDomain, toE164 } from "../../../shared/normalize";
import { NEXT_ACTION_TYPES, SEGMENTS, isStage } from "../../../shared/stages";

type F = PagesFunction<Env, string, { who: Who }>;

export const onRequestGet: F = async ({ env, data }) => json(200, { companies: await listCompanies(env, data.who.tenant) });

export const onRequestPost: F = async ({ request, env, data }) => {
  const b = await readJson(request);
  if (!b) return bad("bad json");
  const name = str(b.name, 160);
  if (!name) return bad("name is required");
  const stage = isStage(b.stage) && b.stage !== "candidate" ? b.stage : "prospect";
  const segment = (SEGMENTS as readonly string[]).includes(String(b.segment)) ? String(b.segment) : "unknown";
  const nat = (NEXT_ACTION_TYPES as readonly string[]).includes(String(b.next_action_type)) ? String(b.next_action_type) : null;
  try {
    const row = await env.DB.prepare(
      `INSERT INTO companies (tenant, name, domain, phone_e164, city, segment, source, stage, next_action, next_action_type, next_action_due, notes)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'manual', ?7, ?8, ?9, ?10, ?11) RETURNING id`,
    ).bind(data.who.tenant, name, toDomain(str(b.domain)), toE164(str(b.phone)), optStr(b.city, 80), segment, stage,
      optStr(b.next_action, 200), nat, optStr(b.next_action_due, 10), optStr(b.notes, 2000)).first<{ id: number }>();
    return json(201, { id: row!.id });
  } catch (e) {
    return bad(constraintMessage(e) ?? "could not save", 409);
  }
};
