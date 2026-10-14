#!/usr/bin/env node
/**
 * Pulls open review work out of D1 into ~/Arkosa-leads/reviews/<date>.md, for Claude Code to
 * apply in the repo: open comments, change requests on the current text, decision sign-offs.
 * Read-only: SELECT statements only. Local D1 by default; `--remote` reads production, and only
 * when the operator passes it.
 *   npm run reviews:pull [-- --remote] [-- --persist-to <dir>] [-- --out <file>]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { cliArgs, d1Reader } from "./d1-read.mjs";

const { remote, persist, out: outArg } = cliArgs();
const date = new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);
const out = outArg ?? join(homedir(), "Arkosa-leads", "reviews", `${date}.md`);
const query = d1Reader({ remote, persist });

const comments = query(`SELECT doc_path, content_sha, anchor, body, reviewer, at FROM doc_comments WHERE resolved = 0 ORDER BY doc_path, id`);
// Latest review per doc, if it asks for changes.
const changes = query(`SELECT r.doc_path, r.content_sha, r.note, r.reviewer, r.at FROM doc_reviews r
  WHERE r.status = 'changes_requested' AND r.id = (SELECT max(id) FROM doc_reviews WHERE doc_path = r.doc_path AND tenant = r.tenant) ORDER BY r.doc_path`);
const signoffs = query(`SELECT s.decision_id, s.choice, s.note, s.reviewer, s.at FROM decision_signoffs s
  WHERE s.id = (SELECT max(id) FROM decision_signoffs WHERE decision_id = s.decision_id AND tenant = s.tenant) ORDER BY CAST(substr(s.decision_id, 2) AS INTEGER)`);

const lines = [`# Review pull · ${date}`, "", `Source: ${remote ? "production D1 (--remote)" : "local D1"}. Apply in the repo, then commit; the console picks up the new text on the next deploy.`, ""];
lines.push(`## Change requests (${changes.length})`, "");
for (const c of changes) lines.push(`- \`${c.doc_path}\` @ ${c.content_sha.slice(0, 10)} · ${c.reviewer} · ${c.at}`, `  ${c.note}`);
lines.push("", `## Open comments (${comments.length})`, "");
for (const c of comments) lines.push(`- \`${c.doc_path}\` #${c.anchor} @ ${c.content_sha.slice(0, 10)} · ${c.reviewer} · ${c.at}`, `  ${c.body}`);
lines.push("", `## Decision sign-offs (${signoffs.length})`, "", "Knock-on edits wait for these (plan v4 §0.3, §10.8).", "");
for (const s of signoffs) lines.push(`- **${s.decision_id}**: ${s.choice}${s.note ? ` — ${s.note}` : ""} · ${s.reviewer} · ${s.at}`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${lines.join("\n")}\n`);
console.log(`reviews:pull: ${changes.length} change requests, ${comments.length} open comments, ${signoffs.length} sign-offs → ${out}`);
