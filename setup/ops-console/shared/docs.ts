/**
 * Documents: git is the source, the console holds review state only.
 * scripts/collect-docs.mjs bundles the allowlisted markdown at build time; the database
 * stores reviews, comments, approved snapshots and decision sign-offs, each tied to a content_sha.
 */
export type Doc = { path: string; title: string; kind: string; sha256: string; commit: string | null; dirty: boolean; content: string };
export type Decision = { id: string; section: string; decision: string; problem: string | null; recommended: string; affects: string; sha256: string };

export const DOC_STATUSES = ["unread", "in_review", "changes_requested", "approved"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

/** Kinds in display order. Anything else lands under "other". */
export const KIND_LABEL: Record<string, string> = {
  contract: "Contracts", sow: "Statements of work", wording: "Message wording", outreach: "Outreach",
  proposal: "Proposals", report: "Reports", decisions: "Plan decisions", admin: "Admin", run: "Run logs", qa: "QA reports",
};

export const PLACEHOLDER_RE = /\{[A-Z][A-Z0-9_]*\}/g;
export const LAWYER_RE = /\[LAWYER\]/g;
export const markerCounts = (content: string) => ({
  placeholders: (content.match(PLACEHOLDER_RE) ?? []).length,
  lawyer: (content.match(LAWYER_RE) ?? []).length,
});

/** GitHub-style heading slug; comment anchors use it. Duplicates get -1, -2… */
export function slugify(text: string, seen?: Map<string, number>) {
  const base = text.toLowerCase().replace(/<[^>]*>/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-") || "section";
  if (!seen) return base;
  const n = seen.get(base) ?? 0;
  seen.set(base, n + 1);
  return n ? `${base}-${n}` : base;
}

/** Headings outside fenced code, with their anchors, in order. */
export function headings(content: string) {
  const seen = new Map<string, number>();
  const out: { level: number; text: string; anchor: string }[] = [];
  let fence = false;
  for (const line of content.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue; }
    const m = !fence && /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2], anchor: slugify(m[2], seen) });
  }
  return out;
}

/**
 * Effective status of a document at its current sha. An approval belongs to one content_sha:
 * when the content changes, the old approval no longer counts and the doc is back in review.
 */
export function docStatus(currentSha: string, reviews: { content_sha: string; status: string }[], approvedShas: string[]) {
  const forSha = reviews.filter((r) => r.content_sha === currentSha);
  const latest = forSha.length ? forSha[forSha.length - 1].status as DocStatus : null;
  const lastApproved = approvedShas.length ? approvedShas[approvedShas.length - 1] : null;
  const changedSinceApproved = !!lastApproved && lastApproved !== currentSha && latest !== "approved";
  const status: DocStatus = latest ?? (changedSinceApproved ? "in_review" : "unread");
  return { status, changedSinceApproved, lastApprovedSha: lastApproved };
}

/** Line diff (LCS). Small docs only; fine for a few hundred lines. */
export function lineDiff(a: string, b: string): { op: " " | "+" | "-"; line: string }[] {
  const x = a.split("\n"), y = b.split("\n");
  const n = x.length, m = y.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { op: " " | "+" | "-"; line: string }[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { out.push({ op: " ", line: x[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ op: "-", line: x[i++] });
    else out.push({ op: "+", line: y[j++] });
  }
  while (i < n) out.push({ op: "-", line: x[i++] });
  while (j < m) out.push({ op: "+", line: y[j++] });
  return out;
}
