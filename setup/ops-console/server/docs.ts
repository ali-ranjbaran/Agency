/** Documents: bundled text (git) + review state (D1). Every query is scoped to the caller's tenant. */
import { DECISIONS, DOCS, DOCS_COMMIT } from "./docs.generated";
import { docStatus, markerCounts, type Doc } from "../shared/docs";
import { snapshotUrl } from "./db";
import type { Env } from "./env";

export { DECISIONS, DOCS, DOCS_COMMIT };

export const findDoc = (path: string): Doc | undefined => DOCS.find((d) => d.path === path);

type QaDoc = Doc & { qa_id: number; verdict: string | null; shots: string[] };

/** QA reports from the Mac runner, newest version per run, as documents at path "qa/<run>". */
export async function qaDocs(env: Env, tenant: string): Promise<QaDoc[]> {
  const { results } = await env.DB.prepare(
    `SELECT q.id, q.run, q.content_sha, q.content, q.verdict, q.shots_json FROM qa_reports q
     WHERE q.tenant = ?1 AND q.id = (SELECT max(id) FROM qa_reports WHERE tenant = q.tenant AND run = q.run) ORDER BY q.run DESC`,
  ).bind(tenant).all<{ id: number; run: string; content_sha: string; content: string; verdict: string | null; shots_json: string }>();
  return results.map((r) => ({ path: `qa/${r.run}`, title: `QA · ${r.run}`, kind: "qa", sha256: r.content_sha, commit: null, dirty: false, content: r.content,
    qa_id: r.id, verdict: r.verdict, shots: JSON.parse(r.shots_json) as string[] }));
}

/** A bundled document, or a QA report. */
export async function findAnyDoc(env: Env, tenant: string, path: string): Promise<(Doc & Partial<QaDoc>) | undefined> {
  if (!path.startsWith("qa/")) return findDoc(path);
  return (await qaDocs(env, tenant)).find((d) => d.path === path);
}

/** Signed, short-lived screenshot URLs for a QA report (same route and key as site snapshots). */
export async function qaShotUrls(env: Env, d: { qa_id?: number; shots?: string[] }) {
  if (!d.qa_id || !d.shots) return [];
  return Promise.all(d.shots.map((_, i) => snapshotUrl(env, d.qa_id!, `qa-${i}`)));
}

type ReviewRow = { doc_path: string; content_sha: string; status: string; note: string | null; reviewer: string; at: string };

export async function docSummaries(env: Env, tenant: string) {
  const [reviews, snaps, comments, qa] = await Promise.all([
    env.DB.prepare("SELECT doc_path, content_sha, status, note, reviewer, at FROM doc_reviews WHERE tenant = ?1 ORDER BY id").bind(tenant).all<ReviewRow>(),
    env.DB.prepare("SELECT doc_path, content_sha FROM doc_approved_snapshots WHERE tenant = ?1 ORDER BY id").bind(tenant).all<{ doc_path: string; content_sha: string }>(),
    env.DB.prepare("SELECT doc_path, count(*) AS n FROM doc_comments WHERE tenant = ?1 AND resolved = 0 GROUP BY doc_path").bind(tenant).all<{ doc_path: string; n: number }>(),
    qaDocs(env, tenant),
  ]);
  return [...DOCS, ...qa].map((d) => {
    const st = docStatus(d.sha256, reviews.results.filter((r) => r.doc_path === d.path), snaps.results.filter((s) => s.doc_path === d.path).map((s) => s.content_sha));
    return {
      path: d.path, title: d.title, kind: d.kind, sha256: d.sha256, commit: d.commit, dirty: d.dirty, ...markerCounts(d.content),
      verdict: "verdict" in d ? d.verdict : null,
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
