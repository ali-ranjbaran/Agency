/** GET: CSV export of AGGREGATES ONLY: counts by stage, segment, source and CASL-complete.
 *  No names, emails, phones or domains ever leave through this route. */
import type { Env, Who } from "../../server/env";
import { listCompanies } from "../../server/db";
import { SECURITY_HEADERS } from "../../server/http";
import { toCsv } from "../../shared/csv";

export const onRequestGet: PagesFunction<Env, string, { who: Who }> = async ({ env, data }) => {
  const rows = await listCompanies(env, data.who.tenant, "1=1");
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = [r.stage, r.segment, r.source, r.casl_complete ? "yes" : "no", r.suppressed ? "yes" : "no"].join("|");
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const body = toCsv(["stage", "segment", "source", "casl_complete", "suppressed", "companies"],
    [...counts].sort().map(([k, n]) => [...k.split("|"), n]));
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, { headers: { ...SECURITY_HEADERS, "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="arkosa-pipeline-${date}.csv"` } });
};
