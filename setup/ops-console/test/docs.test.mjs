// Documents: review-state schema gates, the approval-per-sha rule, and the collector's refusals.
// Fictional data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { docStatus, headings, lineDiff, markerCounts } from "../shared/docs.ts";
import { allowed, collect, extractDecisions, scanPersonalData } from "../scripts/collect-docs.mjs";

const MIG = new URL("../migrations/", import.meta.url);
function db() {
  const d = new DatabaseSync(":memory:");
  for (const f of readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort()) d.exec(readFileSync(new URL(f, MIG), "utf8"));
  return d;
}
const A = "a".repeat(64), B = "b".repeat(64);
const review = (d, sha, status, note = null) =>
  d.prepare("INSERT INTO doc_reviews (doc_path, content_sha, status, note, reviewer) VALUES ('templates/contracts/msa.md', ?, ?, ?, 'operator@example.com')").run(sha, status, note);
const snapshot = (d, sha) => d.prepare("INSERT INTO doc_approved_snapshots (doc_path, content_sha, content) VALUES ('templates/contracts/msa.md', ?, '# MSA')").run(sha);

// ---- schema ---------------------------------------------------------------------------------
test("approval without the approved snapshot for that sha → refused", () => {
  const d = db();
  assert.throws(() => review(d, A, "approved"), /approved snapshot/);
  snapshot(d, A);
  assert.throws(() => review(d, B, "approved"), /approved snapshot/, "snapshot of another sha doesn't count");
  review(d, A, "approved");
});

test("request changes without a note → refused", () => {
  const d = db();
  assert.throws(() => review(d, A, "changes_requested", "  "), /CHECK constraint failed/);
  review(d, A, "changes_requested", "Liability cap too low");
});

test("bad status / short sha / empty reviewer → refused", () => {
  const d = db();
  assert.throws(() => review(d, A, "done"), /CHECK constraint failed/);
  assert.throws(() => review(d, "abc", "in_review"), /CHECK constraint failed/);
  assert.throws(() => d.prepare("INSERT INTO doc_reviews (doc_path, content_sha, status, reviewer) VALUES ('x.md', ?, 'in_review', ' ')").run(A), /CHECK constraint failed/);
});

test("reviews, snapshots and sign-offs are append-only", () => {
  const d = db();
  snapshot(d, A); review(d, A, "approved");
  d.prepare("INSERT INTO decision_signoffs (decision_id, decision_sha, choice, reviewer) VALUES ('D1', ?, 'accept', 'operator@example.com')").run(A);
  for (const t of ["doc_reviews", "doc_approved_snapshots", "decision_signoffs"]) {
    assert.throws(() => d.prepare(`DELETE FROM ${t}`).run(), /append-only/, t);
    assert.throws(() => d.prepare(`UPDATE ${t} SET at = 'x'`).run(), /append-only/, t);
  }
});

test("comments: only `resolved` may change, never deleted", () => {
  const d = db();
  const id = d.prepare("INSERT INTO doc_comments (doc_path, content_sha, anchor, body, reviewer) VALUES ('x.md', ?, 'parties', 'Add GST number', 'operator@example.com')").run(A).lastInsertRowid;
  d.prepare("UPDATE doc_comments SET resolved = 1, resolved_at = datetime('now') WHERE id = ?").run(id);
  assert.throws(() => d.prepare("UPDATE doc_comments SET body = 'changed' WHERE id = ?").run(id), /frozen/);
  assert.throws(() => d.prepare("DELETE FROM doc_comments").run(), /resolve instead/);
  assert.throws(() => d.prepare("INSERT INTO doc_comments (doc_path, content_sha, anchor, body, reviewer) VALUES ('x.md', ?, 'parties', '  ', 'o@example.com')").run(A), /CHECK constraint failed/);
});

test("decision sign-off: reject/amend need a note, ids look like D<n>", () => {
  const d = db();
  const so = (id, choice, note) => d.prepare("INSERT INTO decision_signoffs (decision_id, decision_sha, choice, note, reviewer) VALUES (?, ?, ?, ?, 'operator@example.com')").run(id, A, choice, note);
  assert.throws(() => so("D2", "reject", null), /CHECK constraint failed/);
  assert.throws(() => so("D2", "amend", " "), /CHECK constraint failed/);
  assert.throws(() => so("X1", "accept", null), /CHECK constraint failed/);
  so("D2", "amend", "Extend to Regina first");
  so("D10", "accept", null);
});

// ---- approval belongs to one sha ----------------------------------------------------------------
test("approval resets when the content sha changes", () => {
  const approvedA = [{ content_sha: A, status: "approved" }];
  assert.deepEqual(docStatus(A, approvedA, [A]), { status: "approved", changedSinceApproved: false, lastApprovedSha: A });
  assert.deepEqual(docStatus(B, approvedA, [A]), { status: "in_review", changedSinceApproved: true, lastApprovedSha: A });
  assert.equal(docStatus(B, [...approvedA, { content_sha: B, status: "changes_requested" }], [A]).status, "changes_requested");
  assert.deepEqual(docStatus(B, [...approvedA, { content_sha: B, status: "approved" }], [A, B]), { status: "approved", changedSinceApproved: false, lastApprovedSha: B });
  assert.equal(docStatus(A, [], []).status, "unread");
});

test("markers, headings and diff", () => {
  assert.deepEqual(markerCounts("{LEGAL_NAME} owes {PRICE_ENTRY} [LAWYER] {lower} [LAWYER]"), { placeholders: 2, lawyer: 2 });
  assert.deepEqual(headings("# Title\n## Fees and payment\n```\n## not a heading\n```\n## Fees and payment").map((h) => h.anchor), ["title", "fees-and-payment", "fees-and-payment-1"]);
  assert.deepEqual(lineDiff("a\nb\nc", "a\nc\nd").map((l) => l.op + l.line), [" a", "-b", " c", "+d"]);
});

// ---- collector ------------------------------------------------------------------------------------
function repo(files) {
  const root = mkdtempSync(join(tmpdir(), "collect-docs-"));
  for (const [p, c] of Object.entries(files)) { mkdirSync(join(root, p, ".."), { recursive: true }); writeFileSync(join(root, p), c); }
  return root;
}
const OK = { "templates/contracts/msa.md": "---\ntitle: MSA\nkind: contract\n---\n# MSA\nhello@thearkosa.com, office@northgate.example, (306) 555-0123, {SUPPORT_PHONE}\n" };

test("collector: allowlist", () => {
  for (const p of ["templates/contracts/msa.md", "templates/outreach/a/b.md", "admin/decisions.md", "admin/ICP.md", "admin/runs/2026-10-14-auto.md"]) assert.ok(allowed(p), p);
  for (const p of ["clients/acme/context.md", "templates/contracts/../../clients/x.md", "admin/metrics.md", "admin/runs/x/y.md", "templates/site-starter/README.md", "templates/contracts/msa.txt", "CLAUDE.md"]) assert.ok(!allowed(p), p);
});

test("collector: clean repo passes, placeholders and fictional data allowed", () => {
  const r = collect(repo(OK));
  assert.deepEqual(r.errors, []);
  assert.equal(r.docs.length, 1);
  assert.equal(r.docs[0].kind, "contract");
  assert.match(r.docs[0].sha256, /^[0-9a-f]{64}$/);
});

test("collector: refuses non-allowlisted and clients/ paths", () => {
  const root = repo({ ...OK, "clients/acme/context.md": "# Acme", "admin/metrics.md": "# m" });
  assert.match(collect(root, ["clients/acme/context.md"]).errors.join("\n"), /clients\/acme\/context\.md: not on the documents allowlist/);
  assert.match(collect(root, ["admin/metrics.md"]).errors.join("\n"), /not on the documents allowlist/);
});

test("collector: refuses a symlink into clients/", () => {
  const root = repo({ ...OK, "clients/acme/context.md": "# Acme" });
  symlinkSync(join(root, "clients/acme/context.md"), join(root, "templates/contracts/linked.md"));
  assert.match(collect(root).errors.join("\n"), /linked\.md: resolves to clients\/acme\/context\.md/);
});

test("collector: refuses real-looking emails and phone numbers", () => {
  assert.deepEqual(scanPersonalData("call (306) 555-0123 or {DEMO_NUMBER}, mail illia@thearkosa.com or x@y.example").length, 0);
  const found = scanPersonalData("Owner: jane.doe@gmail.com\ncell 306-931-4477\n+1 639 555 2000");
  assert.deepEqual(found.map((f) => f.kind), ["email", "phone", "phone"]);
  const root = repo({ "templates/outreach/leak.md": "# Leak\nReach Bob at bob@somefirm.ca or 306.931.4477\n" });
  const errs = collect(root).errors.join("\n");
  assert.match(errs, /leak\.md:2: looks like a real email/);
  assert.match(errs, /leak\.md:2: looks like a real phone/);
});

test("collector: decisions D1–D10 come from the plan's two tables", () => {
  const plan = readFileSync(new URL("../../../agency-plan-v4.md", import.meta.url), "utf8");
  const { rows } = extractDecisions(plan);
  assert.deepEqual(rows.map((r) => r.id), ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10"]);
  assert.ok(rows.every((r) => r.recommended && r.affects && /^[0-9a-f]{64}$/.test(r.sha256)));
  assert.equal(rows[0].section, "§0.3"); assert.equal(rows[6].section, "§10.7");
});
