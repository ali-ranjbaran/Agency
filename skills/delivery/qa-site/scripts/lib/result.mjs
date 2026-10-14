/**
 * Check results and the report. Statuses are exactly PASS / FAIL / UNVERIFIED / N/A.
 * UNVERIFIED is never counted as PASS: any FAIL blocks launch; any UNVERIFIED means not cleared.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const PASS = "PASS", FAIL = "FAIL", UNVERIFIED = "UNVERIFIED", NA = "N/A";

export class Results {
  constructor() { this.list = []; }
  /** evidence: a string or string[]; fix: what to do when it isn't a PASS. */
  add(id, title, status, evidence, fix = "") {
    if (![PASS, FAIL, UNVERIFIED, NA].includes(status)) throw new Error(`bad status ${status} for ${id}`);
    const ev = Array.isArray(evidence) ? evidence.filter(Boolean) : [evidence].filter(Boolean);
    if (status === PASS && !ev.length) throw new Error(`${id}: a PASS needs evidence`);
    this.list = this.list.filter((r) => r.id !== id);
    this.list.push({ id, title, status, evidence: ev, fix: status === PASS || status === NA ? "" : fix });
  }
  get(id) { return this.list.find((r) => r.id === id); }
  counts() { return Object.fromEntries([PASS, FAIL, UNVERIFIED, NA].map((s) => [s, this.list.filter((r) => r.status === s).length])); }
  verdict() {
    const c = this.counts();
    if (c[FAIL]) return { line: "LAUNCH BLOCKED", exit: 1 };
    if (c[UNVERIFIED]) return { line: `NOT CLEARED: ${c[UNVERIFIED]} item(s) need a human`, exit: 2 };
    return { line: "CLEARED", exit: 0 };
  }
}

const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

export function writeReport(dir, { url, mode, startedAt, finishedAt, results, artifacts, repo }) {
  const v = results.verdict();
  const c = results.counts();
  const order = { [FAIL]: 0, [UNVERIFIED]: 1, [PASS]: 2, [NA]: 3 };
  const rows = [...results.list].sort((a, b) => order[a.status] - order[b.status] || a.id.localeCompare(b.id));
  const section = (status, head, body) => {
    const r = rows.filter((x) => x.status === status);
    return r.length ? [`## ${head} (${r.length})`, "", ...r.flatMap(body), ""] : [];
  };
  const md = [
    v.line,
    "",
    `# qa-site report: ${url}`,
    "",
    `Mode **${mode}** · started ${startedAt} · finished ${finishedAt}${repo ? ` · repo \`${repo}\`` : ""}`,
    `PASS ${c[PASS]} · FAIL ${c[FAIL]} · UNVERIFIED ${c[UNVERIFIED]} · N/A ${c[NA]}`,
    "",
    ...section(FAIL, "FAIL: blocks launch", (r) => [`### ${r.id}: ${r.title}`, ...r.evidence.map((e) => `- ${e}`), `- **Fix:** ${r.fix || "see references/checks.md"}`, ""]),
    ...section(UNVERIFIED, "UNVERIFIED: needs a human (never counted as a pass)", (r) => [`### ${r.id}: ${r.title}`, ...r.evidence.map((e) => `- ${e}`), r.fix ? `- **To verify:** ${r.fix}` : "", ""]),
    "## All checks",
    "",
    "| Check | Status | Evidence |",
    "|---|---|---|",
    ...rows.map((r) => `| ${r.id}: ${esc(r.title)} | ${r.status} | ${esc(r.evidence.slice(0, 3).join(" · ")).slice(0, 400)} |`),
    "",
    "## Artifacts",
    "",
    ...Object.entries(artifacts).map(([k, p]) => `- ${k}: \`${p}\``),
    "",
  ].filter((l) => l !== null).join("\n");
  writeFileSync(join(dir, "report.md"), md, { mode: 0o600 });
  writeFileSync(join(dir, "checks.json"), JSON.stringify({ url, mode, startedAt, finishedAt, verdict: v.line, counts: c, checks: rows }, null, 2), { mode: 0o600 });
  return v;
}
