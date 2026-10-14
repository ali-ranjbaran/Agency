/** GET: import rows waiting for missing CASL fields. */
import type { Env, Who } from "../../../server/env";
import { json } from "../../../server/http";

export const onRequestGet: PagesFunction<Env, string, { who: Who }> = async ({ env, data }) => {
  const { results } = await env.DB.prepare("SELECT id, batch, row_json, missing, created_at FROM import_quarantine WHERE tenant = ?1 ORDER BY id DESC LIMIT 500")
    .bind(data.who.tenant).all<{ id: number; row_json: string }>();
  return json(200, { rows: results.map((r) => ({ ...r, row: JSON.parse(r.row_json), row_json: undefined })) });
};
