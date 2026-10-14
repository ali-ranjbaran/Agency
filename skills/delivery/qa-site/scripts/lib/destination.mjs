/**
 * Did the test lead reach its destination? Read through wrangler (the operator's login), from the
 * site's own D1, read-only except for archiving the marked test row itself.
 * Known shapes (detected from the repo):
 *   intake → `leads` table (Arkosa's own site): the row with the test email must exist; then archived.
 *   lead   → `sends` table (site-starter): a `forwarded` row since the run started proves the CRM
 *            webhook answered 2xx. The lead itself lives in the CRM; checking it there is human.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

export function detectDestination(repo) {
  if (!repo) return null;
  const toml = join(repo, "wrangler.toml");
  if (!existsSync(toml)) return null;
  const db = (readFileSync(toml, "utf8").match(/database_name\s*=\s*"([^"]+)"/) ?? [])[1];
  if (!db) return null;
  if (existsSync(join(repo, "functions/api/intake.ts"))) return { kind: "leads", db, endpoint: "/api/intake" };
  if (existsSync(join(repo, "functions/api/lead.ts"))) return { kind: "sends", db, endpoint: "/api/lead" };
  return null;
}

function d1(repo, db, sql, { local }) {
  const args = ["--no-install", "wrangler", "d1", "execute", db, local ? "--local" : "--remote", "--json", "--command", sql];
  if (local) args.splice(args.indexOf("--local") + 1, 0, "--persist-to", local);
  const r = spawnSync("npx", args, { cwd: repo, encoding: "utf8", env: { ...process.env, CI: "1" }, timeout: 60_000 });
  if (r.status !== 0) throw new Error(`wrangler d1 failed: ${(r.stderr || r.stdout || "").trim().split("\n").pop()?.slice(0, 200)}`);
  return JSON.parse(r.stdout.slice(r.stdout.indexOf("[")))[0].results;
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** Retries a "not found yet" a few times: a write isn't always visible to a second reader at once
 *  (local wrangler state, D1 replication). Returns { ok: true|false|null, evidence }. */
export async function confirmArrival(dest, repo, opts, { tries = 6, waitMs = 2500 } = {}) {
  let r;
  for (let i = 0; i < tries; i++) {
    r = confirmOnce(dest, repo, opts);
    if (r.ok !== false) return r;
    await new Promise((res) => setTimeout(res, waitMs));
  }
  return { ...r, evidence: `${r.evidence} (checked ${tries}× over ${Math.round((tries * waitMs) / 1000)} s)` };
}

function confirmOnce(dest, repo, { email, sinceIso, local }) {
  try {
    if (dest.kind === "leads") {
      const rows = d1(repo, dest.db, `SELECT id, status, created_at FROM leads WHERE email = ${q(email)} ORDER BY id DESC LIMIT 1`, { local });
      if (!rows.length) return { ok: false, evidence: `no row in D1 \`leads\` for ${email}` };
      d1(repo, dest.db, `UPDATE leads SET status = 'archived', updated_at = datetime('now') WHERE email = ${q(email)} AND email LIKE '%@qa-test.invalid'`, { local });
      return { ok: true, evidence: `D1 \`leads\` row #${rows[0].id} (${rows[0].created_at}) for ${email}; test row archived` };
    }
    const since = sinceIso.replace("T", " ").slice(0, 19);
    const rows = d1(repo, dest.db, `SELECT id, result, created_at FROM sends WHERE created_at >= ${q(since)} ORDER BY id DESC LIMIT 10`, { local });
    const fwd = rows.find((r) => r.result === "forwarded");
    if (fwd) return { ok: true, evidence: `D1 \`sends\` row #${fwd.id} "forwarded" at ${fwd.created_at}: the CRM webhook answered 2xx` };
    if (rows.length) return { ok: false, evidence: `D1 \`sends\` since ${since}: ${rows.map((r) => r.result).join(", ")} (the CRM webhook did not accept it)` };
    return { ok: false, evidence: `no \`sends\` row since ${since}` };
  } catch (e) {
    return { ok: null, evidence: e.message };
  }
}
