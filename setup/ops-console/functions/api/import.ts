/** POST { csv }: import manual prospect rows (columns: shared/csv.ts IMPORT_COLUMNS). */
import type { Env, Who } from "../../server/env";
import { bad, json, readJson } from "../../server/http";
import { emptyResult, importRow } from "../../server/importer";
import { parseCsv } from "../../shared/csv";

export const onRequestPost: PagesFunction<Env, string, { who: Who }> = async ({ request, env, data }) => {
  const b = await readJson<{ csv?: string }>(request, 3_000_000);
  if (!b || typeof b.csv !== "string") return bad("send { csv: \"...\" }");
  const rows = parseCsv(b.csv);
  if (!rows.length) return bad("no rows");
  if (rows.length > 2000) return bad("max 2000 rows per import");
  if (!("company" in rows[0])) return bad("the header row needs a `company` column");
  const batch = new Date().toISOString();
  const out = emptyResult();
  for (const r of rows) {
    try { await importRow(env, data.who.tenant, batch, r, out); }
    catch (e) { out.invalid++; out.errors.push(String((e as Error).message).slice(0, 200)); }
  }
  return json(200, { batch, rows: rows.length, ...out, errors: out.errors.slice(0, 20) });
};
