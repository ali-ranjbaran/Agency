// metrics:pull writes aggregate counts into admin/metrics.md without touching hand-filled cells.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyMetrics, weekStart } from "../scripts/metrics-pull.mjs";

const MD = readFileSync(new URL("../../../admin/metrics.md", import.meta.url), "utf8");
const C = { contacts_added: 7, contacts_total: 31, ready: 12, inbound_leads: 2, demo_calls: 5 };

test("week starts Monday, Saskatoon time", () => {
  assert.deepEqual(weekStart(Date.parse("2026-10-14T23:00:00Z")), { day: "2026-10-12", utc: "2026-10-12 06:00:00" });
  assert.equal(weekStart(Date.parse("2026-10-12T05:00:00Z")).day, "2026-10-05", "Sunday 11 pm local is still last week");
});

test("adds a Weekly row and the console table; idempotent", () => {
  const once = applyMetrics(MD, "2026-10-12", C);
  const row = once.split("\n").find((l) => l.startsWith("| 2026-10-12 |") && l.split("|").length > 10);
  const cells = row.split("|").slice(1, -1).map((x) => x.trim());
  assert.equal(cells.length, 14);
  // Week of | Sales h | Build h | New contacts | Cum. contacts | Emails sent | … | Demo-number calls (10) | Discovery
  assert.deepEqual([cells[3], cells[4], cells[5], cells[10], cells[11]], ["7", "31", "", "5", ""]);
  assert.match(once, /\| 2026-10-12 \| 7 \| 31 \| 12 \| 2 \| 5 \|/);
  assert.equal(applyMetrics(once, "2026-10-12", C), once);
  assert.ok(once.includes("| 2026-09-28 |"), "earlier rows kept");
});

test("updates an existing row, keeps hand-filled cells", () => {
  const md = MD.replace("| 2026-09-28 | | |", "| 2026-09-28 | 9 | 6 |");
  const out = applyMetrics(md, "2026-09-28", { ...C, contacts_added: 3 });
  const cells = out.split("\n").find((l) => l.startsWith("| 2026-09-28 |")).split("|").slice(1, -1).map((x) => x.trim());
  assert.deepEqual(cells.slice(0, 6), ["2026-09-28", "9", "6", "3", "31", ""]);
});

test("aggregates only: no emails, phones or domains", () => {
  const out = applyMetrics(MD, "2026-10-12", C);
  assert.doesNotMatch(out.slice(MD.length - 200), /@|\.example|\+1\d{10}/);
});
