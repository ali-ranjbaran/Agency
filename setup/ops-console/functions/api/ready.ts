/** GET: the send view. Contacts marked ready, with nothing suppressed, at companies outside
 *  the review queue. Nothing sends from the console; this is the list to load elsewhere. */
import type { Env, Who } from "../../server/env";
import { COMPANY_SUPPRESSED_SQL, CONTACT_SUPPRESSED_SQL } from "../../server/db";
import { json } from "../../server/http";

export const onRequestGet: PagesFunction<Env, string, { who: Who }> = async ({ env, data }) => {
  const { results } = await env.DB.prepare(
    `SELECT k.id, k.name, k.title, k.email, k.email_flags, k.casl_verified_at, c.id AS company_id, c.name AS company, c.stage
     FROM contacts k JOIN companies c ON c.id = k.company_id
     WHERE k.tenant = ?1 AND k.ready_to_send = 1 AND c.stage <> 'candidate'
       AND NOT ${CONTACT_SUPPRESSED_SQL("k")} AND NOT ${COMPANY_SUPPRESSED_SQL("c")}
     ORDER BY c.name`,
  ).bind(data.who.tenant).all();
  return json(200, { contacts: results });
};
