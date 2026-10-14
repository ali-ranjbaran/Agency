/**
 * POST (runner only): reserve ONE Google Places call before making it. One atomic upsert:
 * it only increments while under PLACES_MONTHLY_CAP (default 500), so the cap is hard even with
 * concurrent calls. At the cap: { ok: false }, and the operator gets one email per month.
 */
import type { Env, Who } from "../../../server/env";
import { bad, json } from "../../../server/http";
import { alert } from "../../../server/leadgen";

export const onRequestPost: PagesFunction<Env, string, { who: Who }> = async ({ env, data }) => {
  if (data.who.kind !== "runner") return bad("forbidden", 403);
  const t = data.who.tenant;
  const cap = Number.parseInt(env.PLACES_MONTHLY_CAP || "500", 10) || 500;
  const month = new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 7);
  const row = await env.DB.prepare(
    `INSERT INTO places_usage (tenant, month, calls) VALUES (?1, ?2, 1)
     ON CONFLICT (tenant, month) DO UPDATE SET calls = calls + 1 WHERE calls < ?3 RETURNING calls`,
  ).bind(t, month, cap).first<{ calls: number }>();
  if (row && cap >= 1) return json(200, { ok: true, used: row.calls, cap });

  const first = await env.DB.prepare("UPDATE places_usage SET alerted = 1 WHERE tenant = ?1 AND month = ?2 AND alerted = 0").bind(t, month).run();
  if (first.meta.changes) {
    const sent = await alert(env, `Google Places cap hit (${month})`,
      `The lead generator reached its Google Places cap of ${cap} calls for ${month} and stopped calling Places. ` +
      `OSM and manual sources keep working. Raise PLACES_MONTHLY_CAP in setup/ops-console/wrangler.toml if you mean to.`);
    if (!sent) await env.DB.prepare("UPDATE places_usage SET alerted = 0 WHERE tenant = ?1 AND month = ?2").bind(t, month).run();
  }
  return json(200, { ok: false, used: cap, cap });
};
