/** POST { ids: number[], reason }: reject candidates (bulk is fine). Each firm's keys (domain,
 *  phone, place_id, osm ref) go into `rejections` so future searches skip it, then the
 *  candidate and its draft contacts are deleted. */
import type { Env, Who } from "../../../server/env";
import { bad, json, readJson, str } from "../../../server/http";

export const onRequestPost: PagesFunction<Env, string, { who: Who }> = async ({ request, env, data }) => {
  const b = await readJson<{ ids?: unknown[]; reason?: string }>(request);
  const ids = (b?.ids ?? []).map(Number).filter(Number.isInteger).slice(0, 200);
  const reason = str(b?.reason, 300);
  if (!ids.length || !reason) return bad("send { ids: [...], reason }");
  const t = data.who.tenant;
  let n = 0;
  for (const id of ids) {
    const c = await env.DB.prepare("SELECT id, name, domain, phone_e164, search_key FROM companies WHERE id = ?1 AND tenant = ?2 AND stage = 'candidate'")
      .bind(id, t).first<{ id: number; name: string; domain: string | null; phone_e164: string | null; search_key: string | null }>();
    if (!c) continue;
    const refs = await env.DB.prepare("SELECT source, source_ref FROM company_sources WHERE company_id = ?1").bind(id).all<{ source: string; source_ref: string }>();
    const place = refs.results.find((r) => r.source === "places")?.source_ref ?? null;
    const osm = refs.results.find((r) => r.source === "osm")?.source_ref ?? null;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO rejections (tenant, search_key, name, domain, phone_e164, place_id, osm_ref, reason) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)")
        .bind(t, c.search_key, c.name, c.domain, c.phone_e164, place, osm, reason),
      env.DB.prepare("DELETE FROM companies WHERE id = ?1 AND tenant = ?2 AND stage = 'candidate'").bind(id, t),
    ]);
    n++;
  }
  return json(200, { rejected: n });
};
