/** GET ?path=: one document's text, comments, review history and the last approved text (for the diff). */
import type { Env, Who } from "../../../server/env";
import { approvedShas, findAnyDoc, qaShotUrls } from "../../../server/docs";
import { docStatus } from "../../../shared/docs";
import { bad, json } from "../../../server/http";

export const onRequestGet: PagesFunction<Env, string, { who: Who }> = async ({ request, env, data }) => {
  if (data.who.kind !== "operator") return bad("forbidden", 403);
  const t = data.who.tenant;
  const doc = await findAnyDoc(env, t, new URL(request.url).searchParams.get("path") ?? "");
  if (!doc) return bad("not found", 404);
  const [reviews, snaps, comments] = await Promise.all([
    env.DB.prepare("SELECT content_sha, status, note, reviewer, at FROM doc_reviews WHERE tenant = ?1 AND doc_path = ?2 ORDER BY id").bind(t, doc.path)
      .all<{ content_sha: string; status: string; note: string | null; reviewer: string; at: string }>(),
    env.DB.prepare("SELECT content_sha, content, at FROM doc_approved_snapshots WHERE tenant = ?1 AND doc_path = ?2 ORDER BY id").bind(t, doc.path)
      .all<{ content_sha: string; content: string; at: string }>(),
    env.DB.prepare("SELECT id, content_sha, anchor, body, reviewer, resolved, at, resolved_at FROM doc_comments WHERE tenant = ?1 AND doc_path = ?2 ORDER BY id").bind(t, doc.path).all(),
  ]);
  const st = docStatus(doc.sha256, reviews.results, approvedShas(reviews.results));
  const approved = snaps.results.find((s) => s.content_sha === st.lastApprovedSha) ?? null;
  const { qa_id: _q, shots: _s, verdict: _v, ...plain } = doc;
  return json(200, {
    doc: plain, status: st.status, changed_since_approved: st.changedSinceApproved,
    last_approved: approved && approved.content_sha !== doc.sha256 ? approved : approved ? { content_sha: approved.content_sha, at: approved.at, content: null } : null,
    history: reviews.results, comments: comments.results, verdict: doc.verdict ?? null, shots: await qaShotUrls(env, doc),
  });
};
