/** POST { path, sha, anchor, body }: a comment on one heading of the version you are reading.
 *  PATCH { id, resolved: true }: resolve it. Comments are never edited or deleted. */
import type { Env, Who } from "../../../server/env";
import { findAnyDoc } from "../../../server/docs";
import { headings } from "../../../shared/docs";
import { bad, intOrNull, json, readJson, str } from "../../../server/http";

export const onRequestPost: PagesFunction<Env, string, { who: Who }> = async ({ request, env, data }) => {
  if (data.who.kind !== "operator") return bad("forbidden", 403);
  const body = await readJson(request);
  if (!body) return bad("JSON body expected");
  const doc = await findAnyDoc(env, data.who.tenant, str(body.path, 300));
  if (!doc) return bad("not found", 404);
  if (str(body.sha, 64) !== doc.sha256) return bad("this document changed since you opened it; reload", 409);
  const anchor = str(body.anchor, 200);
  if (anchor !== "top" && !headings(doc.content).some((h) => h.anchor === anchor)) return bad("no such heading");
  const text = str(body.body, 4000);
  if (!text) return bad("empty comment");
  const row = await env.DB.prepare("INSERT INTO doc_comments (tenant, doc_path, content_sha, anchor, body, reviewer) VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING id")
    .bind(data.who.tenant, doc.path, doc.sha256, anchor, text, data.who.email).first<{ id: number }>();
  return json(201, { id: row!.id });
};

export const onRequestPatch: PagesFunction<Env, string, { who: Who }> = async ({ request, env, data }) => {
  if (data.who.kind !== "operator") return bad("forbidden", 403);
  const body = await readJson(request);
  const id = intOrNull(body?.id);
  if (id === null || body?.resolved !== true) return bad("id and resolved: true expected");
  const r = await env.DB.prepare("UPDATE doc_comments SET resolved = 1, resolved_at = datetime('now') WHERE id = ?1 AND tenant = ?2 AND resolved = 0").bind(id, data.who.tenant).run();
  return r.meta.changes ? json(200, { id }) : bad("not found", 404);
};
