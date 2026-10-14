#!/usr/bin/env node
/**
 * Bundles the allowlisted repo documents into server/docs.generated.ts before the build.
 * Git is the source; the console only stores review state against each file's sha256.
 *
 * Fails the build (exit 1) on: a path outside the allowlist, anything under clients/, a
 * symlink that resolves outside the allowlist, or an email / phone number that isn't
 * @thearkosa.com, a .example address, a {PLACEHOLDER} or a fictional 555-01xx number.
 *
 *   node scripts/collect-docs.mjs [--root <repo>] [--out <file>] [extra/path.md …]
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Directories walked recursively, and single files / one-level globs. */
export const ALLOW_DIRS = ["templates/contracts", "templates/outreach", "templates/proposals", "templates/reports"];
export const ALLOW_FILES = ["admin/decisions.md", "admin/demo-line-test.md", "admin/ICP.md"];
export const ALLOW_GLOBS = [/^admin\/runs\/[^/]+\.md$/];
export const PLAN = "agency-plan-v4.md";

const posix = (p) => p.split(sep).join("/");

export function allowed(rel) {
  rel = posix(rel);
  if (rel.startsWith("clients/") || rel.includes("/clients/") || rel.includes("..")) return false;
  if (!rel.endsWith(".md")) return false;
  return ALLOW_DIRS.some((d) => rel.startsWith(`${d}/`)) || ALLOW_FILES.includes(rel) || ALLOW_GLOBS.some((g) => g.test(rel));
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})/g;
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\b(\d{3})\)?[\s.-]?(\d{3})[\s.-](\d{4})\b/g;
const okEmailDomain = (d) => { d = d.toLowerCase(); return d === "thearkosa.com" || d.endsWith(".thearkosa.com") || d === "example.com" || d === "example.org" || d.endsWith(".example"); };
const okPhone = (exch, line) => exch === "555" && /^01\d\d$/.test(line);

/** Personal-data findings in one document: [{ line, kind, value }]. */
export function scanPersonalData(content) {
  const out = [];
  content.split("\n").forEach((text, i) => {
    for (const m of text.matchAll(EMAIL_RE)) if (!okEmailDomain(m[1])) out.push({ line: i + 1, kind: "email", value: m[0] });
    for (const m of text.matchAll(PHONE_RE)) if (!okPhone(m[2], m[3])) out.push({ line: i + 1, kind: "phone", value: m[0] });
  });
  return out;
}

function frontmatter(content) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(content);
  const fm = {};
  if (m) for (const line of m[1].split("\n")) { const kv = /^(\w+):\s*(.*)$/.exec(line); if (kv) fm[kv[1]] = kv[2].trim(); }
  return fm;
}

function kindFor(rel, fm) {
  if (fm.kind) return fm.kind;
  if (rel.startsWith("templates/contracts/")) return "contract";
  if (rel.startsWith("templates/outreach/")) return "outreach";
  if (rel.startsWith("templates/proposals/")) return "proposal";
  if (rel.startsWith("templates/reports/")) return "report";
  if (rel.startsWith("admin/runs/")) return "run";
  return "admin";
}

const sha = (s) => createHash("sha256").update(s).digest("hex");

function git(root, args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** D1–D10 rows from the plan's two decision tables (§0.3 and §10.7). */
export function extractDecisions(plan) {
  const rows = [];
  const lines = [];
  let section = null;
  for (const line of plan.split("\n")) {
    const h = /^##\s+(0\.3|10\.7)\b/.exec(line);
    if (h) { section = h[1]; lines.push(line, ""); continue; }
    if (/^#{1,2}\s/.test(line)) section = null;
    if (!section || !line.startsWith("|")) continue;
    lines.push(line);
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    const id = /^\*\*(D\d+)\*\*$/.exec(cells[0] ?? "");
    if (!id) continue;
    const five = cells.length >= 5;
    rows.push({
      id: id[1], section: `§${section}`, decision: cells[1], problem: five ? cells[2] : null,
      recommended: five ? cells[3] : cells[2], affects: five ? cells[4] : cells[3], sha256: sha(line),
    });
  }
  return { rows, content: `# Plan decisions (D1–D10)\n\nExtracted from \`${PLAN}\` §0.3 and §10.7.\n\n${lines.join("\n")}\n` };
}

function walk(root, dir) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return walk(root, rel);
    return e.name.endsWith(".md") ? [rel] : [];
  });
}

export function collect(root, extra = []) {
  const realRoot = realpathSync(root);
  const errors = [];
  const paths = new Set([
    ...ALLOW_DIRS.flatMap((d) => walk(root, d)),
    ...ALLOW_FILES.filter((f) => existsSync(join(root, f))),
    ...(existsSync(join(root, "admin/runs")) ? readdirSync(join(root, "admin/runs")).map((f) => `admin/runs/${f}`).filter((p) => ALLOW_GLOBS.some((g) => g.test(p))) : []),
    ...extra.map(posix),
  ]);
  const docs = [];
  for (const rel of [...paths].sort()) {
    if (!allowed(rel)) { errors.push(`${rel}: not on the documents allowlist`); continue; }
    const abs = join(root, rel);
    if (!existsSync(abs) || !statSync(abs).isFile()) { errors.push(`${rel}: not a file`); continue; }
    const real = posix(relative(realRoot, realpathSync(abs)));
    if (!allowed(real)) { errors.push(`${rel}: resolves to ${real}, outside the allowlist`); continue; }
    const content = readFileSync(abs, "utf8");
    for (const f of scanPersonalData(content)) errors.push(`${rel}:${f.line}: looks like a real ${f.kind} (${f.value})`);
    const fm = frontmatter(content);
    const title = fm.title || /^#\s+(.+)$/m.exec(content)?.[1] || rel.split("/").pop();
    docs.push({ path: rel, title, kind: kindFor(rel, fm), sha256: sha(content), commit: git(root, ["log", "-1", "--format=%H", "--", rel]) || null,
      dirty: !!git(root, ["status", "--porcelain", "--", rel]), content });
  }
  let decisions = [];
  if (existsSync(join(root, PLAN))) {
    const d = extractDecisions(readFileSync(join(root, PLAN), "utf8"));
    for (const f of scanPersonalData(d.content)) errors.push(`${PLAN}#decisions:${f.line}: looks like a real ${f.kind}`);
    decisions = d.rows;
    docs.push({ path: `${PLAN}#decisions`, title: "Plan decisions (D1–D10)", kind: "decisions", sha256: sha(d.content),
      commit: git(root, ["log", "-1", "--format=%H", "--", PLAN]) || null, dirty: !!git(root, ["status", "--porcelain", "--", PLAN]), content: d.content });
  }
  return { docs, decisions, errors, commit: git(root, ["rev-parse", "HEAD"]) };
}

export function render({ docs, decisions, commit }) {
  return `// Generated by scripts/collect-docs.mjs. Do not edit; not in git.\n` +
    `import type { Decision, Doc } from "../shared/docs";\n` +
    `export const DOCS_COMMIT: string | null = ${JSON.stringify(commit)};\n` +
    `export const DOCS: Doc[] = ${JSON.stringify(docs)};\n` +
    `export const DECISIONS: Decision[] = ${JSON.stringify(decisions)};\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
  const here = fileURLToPath(new URL("..", import.meta.url));
  const root = opt("--root", join(here, "../.."));
  const out = opt("--out", join(here, "server/docs.generated.ts"));
  const result = collect(root, args);
  if (result.errors.length) {
    console.error(`collect-docs: refused, ${result.errors.length} problem(s):\n  ${result.errors.join("\n  ")}`);
    process.exit(1);
  }
  writeFileSync(out, render(result));
  console.log(`collect-docs: ${result.docs.length} documents, ${result.decisions.length} decisions → ${relative(process.cwd(), out)}`);
}
