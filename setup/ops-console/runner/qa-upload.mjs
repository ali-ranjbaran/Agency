#!/usr/bin/env node
/**
 * Uploads new qa-site reports to the console: ~/Arkosa-leads/qa/<run>/report.md plus up to 12
 * screenshots from <run>/screenshots/. Uses the runner's service token (/api/runner/* only).
 * A run is re-sent only when its report.md changes; the console stores each version once.
 * State: ~/.arkosa/qa-uploaded.json (run → sha256 sent).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ARKOSA_DIR, loadConfig, log, opsClient } from "./lib.mjs";

const QA_DIR = process.env.QA_DIR ?? join(homedir(), "Arkosa-leads", "qa");
const STATE = join(ARKOSA_DIR, "qa-uploaded.json");
const MAX = 3 * 1024 * 1024;

export async function uploadAll(api, { qaDir = QA_DIR, statePath = STATE } = {}) {
  const sent = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
  let uploaded = 0;
  for (const run of existsSync(qaDir) ? readdirSync(qaDir).sort() : []) {
    const file = join(qaDir, run, "report.md");
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(run) || !existsSync(file)) continue;
    const content = readFileSync(file, "utf8");
    const sha = createHash("sha256").update(content).digest("hex");
    if (sent[run] === sha) continue;
    const form = new FormData();
    form.set("run", run);
    form.set("report", content);
    const shotDir = join(qaDir, run, "screenshots");
    const shots = existsSync(shotDir) ? readdirSync(shotDir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort().slice(0, 12) : [];
    for (const f of shots) {
      const p = join(shotDir, f);
      if (statSync(p).size > MAX) continue;
      form.append("shots", new Blob([readFileSync(p)], { type: /\.png$/i.test(f) ? "image/png" : "image/jpeg" }), f);
    }
    await api("/api/runner/qa-reports", { method: "POST", form });
    sent[run] = sha;
    writeFileSync(statePath, JSON.stringify(sent, null, 2));
    uploaded++;
    log(`qa-upload: ${run} (${shots.length} screenshots)`);
  }
  return uploaded;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = await uploadAll(opsClient(loadConfig()));
  log(`qa-upload: ${n} new report(s)`);
}
