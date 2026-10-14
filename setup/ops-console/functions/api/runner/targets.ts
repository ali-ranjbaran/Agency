/** GET (runner only): sites to snapshot. ?company=ID for one; otherwise companies with a domain
 *  and no good snapshot in 30 days, oldest first, max 25 a night. Suppressed companies are skipped. */
import type { Env, Who } from "../../../server/env";
import { COMPANY_SUPPRESSED_SQL } from "../../../server/db";
import { json } from "../../../server/http";

export const onRequestGet: PagesFunction<Env, string, { who: Who }> = async ({ request, env, data }) => {
  const u = new URL(request.url);
  const one = Number.parseInt(u.searchParams.get("company") ?? "", 10);
  const t = data.who.tenant;
  const stmt = Number.isFinite(one)
    ? env.DB.prepare(`SELECT c.id, c.domain FROM companies c WHERE c.tenant = ?1 AND c.id = ?2 AND c.domain IS NOT NULL AND NOT ${COMPANY_SUPPRESSED_SQL("c")}`).bind(t, one)
    : env.DB.prepare(
      `SELECT c.id, c.domain, (SELECT max(captured_at) FROM site_snapshots s WHERE s.company_id = c.id AND s.error IS NULL) AS last
       FROM companies c WHERE c.tenant = ?1 AND c.domain IS NOT NULL AND c.stage NOT IN ('won','lost') AND NOT ${COMPANY_SUPPRESSED_SQL("c")}
         AND NOT EXISTS (SELECT 1 FROM site_snapshots s WHERE s.company_id = c.id AND s.captured_at > datetime('now','-1 day'))
         AND (last IS NULL OR last < datetime('now','-30 days'))
       ORDER BY last IS NOT NULL, last LIMIT 25`).bind(t);
  const { results } = await stmt.all<{ id: number; domain: string }>();
  return json(200, { targets: results.map((r) => ({ id: r.id, domain: r.domain })) });
};
