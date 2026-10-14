/** Documents: bundled text (git) + review state (D1). Every query is scoped to the caller's tenant. */
import { DECISIONS, DOCS, DOCS_COMMIT } from "./docs.generated";
import { docStatus, markerCounts, type Doc } from "../shared/docs";
import type { Env } from "./env";

export { DECISIONS, DOCS, DOCS_COMMIT };

export const findDoc = (path: string): Doc | undefined => DOCS.find((d) => d.path === path);

type ReviewRow = { doc_path: string; content_sha: string; status: string; note: string | null; reviewer: string; at: string };

export async function docSummaries(env: Env, tenant: string) {
  const [reviews, snaps, comments] = await Promise.all([
    env.DB.prepare("SELECT doc_path, content_sha, status, note, reviewer, at FROM doc_reviews WHERE tenant = ?1 ORDER BY id").bind(tenant).all<ReviewRow>(),
    env.DB.prepare("SELECT doc_path, content_sha FROM doc_approved_snapshots WHERE tenant = ?1 ORDER BY id").bind(tenant).all<{ doc_path: string; content_sha: string }>(),
    env.DB.prepare("SELECT doc_path, count(*) AS n FROM doc_comments WHERE tenant = ?1 AND resolved = 0 GROUP BY doc_path").bind(tenant).all<{ doc_path: string; n: number }>(),
  ]);
  return DOCS.map((d) => {
    const st = docStatus(d.sha256, reviews.results.filter((r) => r.doc_path === d.path), snaps.results.filter((s) => s.doc_path === d.path).map((s) => s.content_sha));
    return {
      path: d.path, title: d.title, kind: d.kind, sha256: d.sha256, commit: d.commit, dirty: d.dirty, ...markerCounts(d.content),
      status: st.status, changed_since_approved: st.changedSinceApproved, open_comments: comments.results.find((c) => c.doc_path === d.path)?.n ?? 0,
    };
  });
}

export async function decisionSummaries(env: Env, tenant: string) {
  const { results } = await env.DB.prepare("SELECT decision_id, decision_sha, choice, note, reviewer, at FROM decision_signoffs WHERE tenant = ?1 ORDER BY id")
    .bind(tenant).all<{ decision_id: string; decision_sha: string; choice: string; note: string | null; reviewer: string; at: string }>();
  return DECISIONS.map((d) => {
    const mine = results.filter((r) => r.decision_id === d.id);
    const latest = mine.length ? mine[mine.length - 1] : null;
    return { ...d, signoff: latest, changed_since_signoff: !!latest && latest.decision_sha !== d.sha256 };
  });
}

/** Counts for the Today page. */
export async function docCounts(env: Env, tenant: string) {
  const [docs, decisions] = await Promise.all([docSummaries(env, tenant), decisionSummaries(env, tenant)]);
  return {
    awaiting_review: docs.filter((d) => d.status === "unread" || d.status === "in_review").length,
    changed_since_approved: docs.filter((d) => d.changed_since_approved).length,
    open_lawyer: docs.reduce((n, d) => n + d.lawyer, 0),
    decisions_unsigned: decisions.filter((d) => !d.signoff || d.changed_since_signoff).length,
  };
}
