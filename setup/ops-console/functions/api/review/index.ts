/** GET: the review queue. Every candidate with its draft contacts, sources, enrichment,
 *  fit breakdown and a signed mobile-screenshot thumbnail. */
import type { Env, Who } from "../../../server/env";
import { GOOD_SNAPSHOT, listCompanies, snapshotUrl } from "../../../server/db";
import { json } from "../../../server/http";
import { universe } from "../../../server/leadgen";

export const onRequestGet: PagesFunction<Env, string, { who: Who }> = async ({ env, data }) => {
  const t = data.who.tenant;
  const cands = await listCompanies(env, t, "c.stage = 'candidate'");
  const ids = cands.map((c) => c.id);
  const inIds = ids.length ? ids.join(",") : "0";
  const [contacts, sources, snaps, uni] = await Promise.all([
    env.DB.prepare(`SELECT * FROM contacts WHERE tenant = ?1 AND company_id IN (${inIds}) ORDER BY id`).bind(t).all<Record<string, unknown> & { company_id: number }>(),
    env.DB.prepare(`SELECT company_id, source, source_ref, attribution FROM company_sources WHERE tenant = ?1 AND company_id IN (${inIds})`).bind(t).all<Record<string, unknown> & { company_id: number }>(),
    env.DB.prepare(`SELECT s.id, s.company_id, s.mobile_key FROM site_snapshots s WHERE s.tenant = ?1 AND s.company_id IN (${inIds}) AND ${GOOD_SNAPSHOT}
      AND s.id = (SELECT max(id) FROM site_snapshots x WHERE x.company_id = s.company_id AND ${GOOD_SNAPSHOT})`).bind(t).all<{ id: number; company_id: number; mobile_key: string | null }>(),
    universe(env, t),
  ]);
  const thumb = new Map<number, string | null>();
  for (const s of snaps.results) thumb.set(s.company_id, s.mobile_key ? await snapshotUrl(env, s.id, "mobile") : null);
  return json(200, {
    universe: uni,
    candidates: cands.map((c) => ({
      ...c,
      enrichment: c.enrichment_json ? JSON.parse(String(c.enrichment_json)) : {},
      enrichment_json: undefined,
      contacts: contacts.results.filter((k) => k.company_id === c.id),
      // Google content is never stored: only the place_id, turned into a Maps link at render time.
      sources: sources.results.filter((s) => s.company_id === c.id),
      thumb: thumb.get(c.id) ?? null,
    })),
  });
};
