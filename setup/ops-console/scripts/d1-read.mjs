/**
 * Read-only D1 access for the operator scripts (reviews:pull, metrics:pull). Single SELECT
 * statements only. Local D1 by default; `--remote` reads production, only when the operator passes it.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

export function cliArgs(argv = process.argv.slice(2)) {
  const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  return { remote: argv.includes("--remote"), persist: opt("--persist-to"), out: opt("--out"), opt };
}

export function d1Reader({ remote = false, persist } = {}) {
  return (sql) => {
    if (!/^\s*SELECT\b/i.test(sql) || /;\s*\S/.test(sql)) throw new Error("read-only scripts run single SELECT statements only");
    const where = remote ? ["--remote"] : ["--local", ...(persist ? ["--persist-to", persist] : [])];
    const r = spawnSync("npx", ["--no-install", "wrangler", "d1", "execute", "arkosa", ...where, "--json", "--command", sql],
      { cwd: ROOT, encoding: "utf8", env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
    if (r.status !== 0) throw new Error(r.stderr || r.stdout);
    return JSON.parse(r.stdout.slice(r.stdout.indexOf("[")))[0].results;
  };
}

/** Like d1Reader, but a table that doesn't exist yet (e.g. the website's) reads as no rows. */
export const tolerant = (query) => (sql) => { try { return query(sql); } catch (e) { if (/no such table/i.test(String(e))) return []; throw e; } };
