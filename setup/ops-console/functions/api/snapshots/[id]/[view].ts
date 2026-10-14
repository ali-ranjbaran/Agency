/** GET ?exp=&sig=: one screenshot from the private R2 bucket (site snapshot desktop/mobile, or QA report shot qa-N). Needs the Access JWT (middleware)
 *  AND a valid signature that expires in minutes, so a copied link stops working quickly. */
import type { Env, Who } from "../../../../server/env";
import { checkSnapshotSig } from "../../../../server/db";
import { SECURITY_HEADERS, bad } from "../../../../server/http";

export const onRequestGet: PagesFunction<Env, "id" | "view", { who: Who }> = async ({ request, env, data, params }) => {
  const id = Number.parseInt(String(params.id), 10);
  const view = String(params.view);
  const qa = /^qa-(\d{1,2})$/.exec(view);
  if (view !== "desktop" && view !== "mobile" && !qa) return bad("not found", 404);
  const u = new URL(request.url);
  if (!(await checkSnapshotSig(env, id, view, Number(u.searchParams.get("exp")), u.searchParams.get("sig") ?? ""))) return bad("link expired", 403);
  if (qa) {
    const q = await env.DB.prepare("SELECT shots_json FROM qa_reports WHERE id = ?1 AND tenant = ?2").bind(id, data.who.tenant).first<{ shots_json: string }>();
    const k = q ? (JSON.parse(q.shots_json) as string[])[Number(qa[1])] : undefined;
    const o = k ? await env.SNAPSHOTS.get(k) : null;
    if (!o) return bad("not found", 404);
    return new Response(o.body, { headers: { ...SECURITY_HEADERS, "content-type": o.httpMetadata?.contentType ?? "image/png", "cache-control": "private, no-store" } });
  }
  const row = await env.DB.prepare("SELECT desktop_key, mobile_key FROM site_snapshots WHERE id = ?1 AND tenant = ?2").bind(id, data.who.tenant).first<{ desktop_key: string | null; mobile_key: string | null }>();
  const key = view === "desktop" ? row?.desktop_key : row?.mobile_key;
  if (!key) return bad("not found", 404);
  const obj = await env.SNAPSHOTS.get(key);
  if (!obj) return bad("not found", 404);
  return new Response(obj.body, { headers: { ...SECURITY_HEADERS, "content-type": obj.httpMetadata?.contentType ?? "image/jpeg", "cache-control": "private, no-store" } });
};
