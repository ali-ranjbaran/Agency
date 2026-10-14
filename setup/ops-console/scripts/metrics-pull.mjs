#!/usr/bin/env node
/**
 * Writes this week's aggregate counts from D1 into admin/metrics.md: contacts added, cumulative
 * contacts, ready to send, inbound leads, demo-line calls. Counts only, never a name, email,
 * phone or domain. Read-only on D1 (SELECT only); local by default, `--remote` for production.
 * Only the console's own cells change: New contacts, Cum. contacts and Demo-number calls in the
 * Weekly row, and the "Console counts" table. Hand-filled cells are kept.
 *   npm run metrics:pull [-- --remote] [-- --persist-to <dir>] [-- --file <metrics.md>]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cliArgs, d1Reader, tolerant } from "./d1-read.mjs";

/** Monday of the current week in Saskatoon (UTC−6, no DST), and that instant in UTC for SQL. */
export function weekStart(now = Date.now()) {
  const local = new Date(now - 6 * 3600_000);
  const monday = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - ((local.getUTCDay() + 6) % 7)));
  const day = monday.toISOString().slice(0, 10);
  return { day, utc: `${day} 06:00:00` };
}

const AUTO_HEAD = "## Console counts (metrics:pull)";

/** Pure: returns metrics.md with this week's console counts applied. */
export function applyMetrics(md, week, c) {
  const n = (v) => String(Number(v) || 0);
  const lines = md.split("\n");
  const start = lines.findIndex((l) => /^## Weekly\b/.test(l));
  if (start < 0) throw new Error("admin/metrics.md has no '## Weekly' table");
  let end = start + 1;
  while (end < lines.length && !/^## /.test(lines[end])) end++;
  const rowIdx = lines.slice(start, end).findIndex((l) => l.startsWith(`| ${week} |`));
  const header = lines.slice(start, end).find((l) => l.startsWith("| Week of"));
  if (!header) throw new Error("admin/metrics.md Weekly table has no header row");
  const names = header.split("|").slice(1, -1).map((x) => x.trim());
  const col = (name) => { const i = names.indexOf(name); if (i < 0) throw new Error(`Weekly table has no "${name}" column`); return i; };
  const width = names.length;
  let cells = rowIdx >= 0 ? lines[start + rowIdx].split("|").slice(1, -1).map((x) => x.trim()) : [week, ...Array(width - 1).fill("")];
  while (cells.length < width) cells.push("");
  cells[col("New contacts")] = n(c.contacts_added); cells[col("Cum. contacts")] = n(c.contacts_total); cells[col("Demo-number calls")] = n(c.demo_calls);
  const row = `| ${cells.join(" | ")} |`;
  if (rowIdx >= 0) lines[start + rowIdx] = row;
  else { let last = end - 1; while (last > start && !lines[last].startsWith("|")) last--; lines.splice(last + 1, 0, row); }

  const autoRow = `| ${week} | ${n(c.contacts_added)} | ${n(c.contacts_total)} | ${n(c.ready)} | ${n(c.inbound_leads)} | ${n(c.demo_calls)} |`;
  const at = lines.indexOf(AUTO_HEAD);
  if (at < 0) {
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    lines.push("", AUTO_HEAD, "Aggregates from the ops console D1, written by `npm run metrics:pull`. Don't edit by hand.", "",
      "| Week of | Contacts added | Cum. contacts | Ready to send | Inbound leads | Demo-line calls |", "|---|---|---|---|---|---|", autoRow, "");
  } else {
    let stop = at + 1;
    while (stop < lines.length && !/^## /.test(lines[stop])) stop++;
    const i = lines.slice(at, stop).findIndex((l) => l.startsWith(`| ${week} |`));
    if (i >= 0) lines[at + i] = autoRow;
    else { let last = stop - 1; while (last > at && !lines[last].startsWith("|")) last--; lines.splice(last + 1, 0, autoRow); }
  }
  const out = lines.join("\n");
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { remote, persist, opt } = cliArgs();
  const file = opt("--file") ?? fileURLToPath(new URL("../../../admin/metrics.md", import.meta.url));
  const q = tolerant(d1Reader({ remote, persist }));
  const { day, utc } = weekStart();
  const one = (sql) => Number(q(sql)[0]?.n ?? 0);
  const counts = {
    contacts_added: one(`SELECT count(*) AS n FROM contacts WHERE created_at >= '${utc}'`),
    contacts_total: one("SELECT count(*) AS n FROM contacts"),
    ready: one("SELECT count(*) AS n FROM contacts WHERE ready_to_send = 1"),
    inbound_leads: one(`SELECT count(*) AS n FROM leads WHERE created_at >= '${utc}'`),
    demo_calls: one(`SELECT count(*) AS n FROM demo_calls WHERE created_at >= '${utc}'`),
  };
  writeFileSync(file, applyMetrics(readFileSync(file, "utf8"), day, counts));
  console.log(`metrics:pull: week of ${day} ${JSON.stringify(counts)} → ${file}`);
}
