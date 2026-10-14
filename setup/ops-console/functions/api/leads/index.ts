/** GET: inbound website leads, read straight from the website's `leads` table. Read-only:
 *  the console never writes or alters `leads`. A lead that's been promoted shows its company id. */
import type { Env, Who } from "../../../server/env";
import { json } from "../../../server/http";

export type Lead = { id: number; created_at: string; name: string; company: string; email: string; phone: string | null;
  trade: string | null; city: string | null; message: string | null; status: string; company_id: number | null };

export async function readLeads(env: Env, tenant: string, where = "1=1"): Promise<Lead[]> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT l.id, l.created_at, l.name, l.company, l.email, l.phone, l.trade, l.city, l.message, l.status,
              (SELECT c.id FROM companies c WHERE c.lead_id = l.id AND c.tenant = ?1) AS company_id
       FROM leads l WHERE ${where} ORDER BY l.created_at DESC LIMIT 500`,
    ).bind(tenant).all<Lead>();
    return results;
  } catch (e) {
    if (/no such table/i.test(String(e))) return [];
    throw e;
  }
}

export const newLeads = (env: Env, tenant: string) =>
  readLeads(env, tenant, "l.created_at > datetime('now','-14 days') AND l.status <> 'archived' AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.lead_id = l.id)");

export const onRequestGet: PagesFunction<Env, string, { who: Who }> = async ({ env, data }) => json(200, { leads: await readLeads(env, data.who.tenant) });
