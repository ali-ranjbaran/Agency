/**
 * POST multipart (runner only): run (folder name under ~/Arkosa-leads/qa/), report (report.md text),
 * shots (PNG/JPEG, ≤ 3 MB each, ≤ 12). Text goes to D1, screenshots to the private R2 bucket.
 * The same run with the same text is stored once; changed text is a new version to review.
 */
import type { Env, Who } from "../../../server/env";
import { qaVerdict } from "../../../shared/docs";
import { bad, json } from "../../../server/http";

const MAX = 3 * 1024 * 1024;
const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");

export const onRequestPost: PagesFunction<Env, string, { who: Who }> = async ({ request, env, data }) => {
  if (data.who.kind !== "runner") return bad("forbidden", 403);
  const t = data.who.tenant;
  let form: FormData;
  try { form = await request.formData(); } catch { return bad("multipart expected"); }
  const run = String(form.get("run") ?? "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(run)) return bad("bad run name");
  const report = form.get("report");
  const content = typeof report === "string" ? report : report instanceof File ? await report.text() : "";
  if (!content.trim() || content.length > 500_000) return bad("report.md text expected (≤ 500 kB)");
  const contentSha = await sha(content);
  const existing = await env.DB.prepare("SELECT id FROM qa_reports WHERE tenant = ?1 AND run = ?2 AND content_sha = ?3").bind(t, run, contentSha).first<{ id: number }>();
  if (existing) return json(200, { id: existing.id, duplicate: true });

  const shots = form.getAll("shots").filter((f): f is File => f instanceof File).slice(0, 12);
  const keys: string[] = [];
  for (const f of shots) {
    if (f.size > MAX || !["image/png", "image/jpeg"].includes(f.type)) return bad(`${f.name}: PNG or JPEG up to 3 MB`);
    const key = `qa/${t}/${run}/${contentSha.slice(0, 12)}-${keys.length}.${f.type === "image/png" ? "png" : "jpg"}`;
    await env.SNAPSHOTS.put(key, f.stream(), { httpMetadata: { contentType: f.type } });
    keys.push(key);
  }
  const row = await env.DB.prepare("INSERT INTO qa_reports (tenant, run, content_sha, content, verdict, shots_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING id")
    .bind(t, run, contentSha, content, qaVerdict(content), JSON.stringify(keys)).first<{ id: number }>();
  return json(201, { id: row!.id });
};
