/**
 * POST { path, sha, status: in_review | changes_requested | approved, note? }
 * The sha must be the bundled one: you can only approve the text you are looking at.
 * Approval stores that exact text first; the schema refuses an approval without it.
 */
import type { Env, Who } from "../../../server/env";
import { findDoc } from "../../../server/docs";
import { bad, json, optStr, readJson, str } from "../../../server/http";

export const onRequestPost: PagesFunction<Env, string, { who: Who }> = async ({ request, env, data }) => {
  if (data.who.kind !== "operator") return bad("forbidden", 403);
  const t = data.who.tenant;
  const body = await readJson(request);
  if (!body) return bad("JSON body expected");
  const doc = findDoc(str(body.path, 300));
  if (!doc) return bad("not found", 404);
  if (str(body.sha, 64) !== doc.sha256) return bad("this document changed since you opened it; reload", 409);
  const status = str(body.status, 30);
  if (!["in_review", "changes_requested", "approved"].includes(status)) return bad("bad status");
  const note = optStr(body.note, 4000);
  if (status === "changes_requested" && !note) return bad("say what needs to change");
  const stmts = [];
  if (status === "approved") stmts.push(env.DB.prepare("INSERT OR IGNORE INTO doc_approved_snapshots (tenant, doc_path, content_sha, content) VALUES (?1, ?2, ?3, ?4)").bind(t, doc.path, doc.sha256, doc.content));
  stmts.push(env.DB.prepare("INSERT INTO doc_reviews (tenant, doc_path, content_sha, status, note, reviewer) VALUES (?1, ?2, ?3, ?4, ?5, ?6)").bind(t, doc.path, doc.sha256, status, note, data.who.email));
  await env.DB.batch(stmts);
  return json(201, { status });
};
