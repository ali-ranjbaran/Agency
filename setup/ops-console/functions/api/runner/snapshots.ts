/**
 * POST multipart (runner only): company_id, meta (JSON), desktop + mobile (JPEG, ≤ 3 MB each).
 * Stores the images in the private R2 bucket and writes the site_snapshots row. Manual review
 * counts from the previous snapshot are carried forward. A failed capture sends meta.error and
 * no images; it's logged as its own row and never hides the last good snapshot.
 */
import type { Env, Who } from "../../../server/env";
import { GOOD_SNAPSHOT } from "../../../server/db";
import { bad, json } from "../../../server/http";

const MAX = 3 * 1024 * 1024;
const flag = (v: unknown) => (v === true ? 1 : v === false ? 0 : null);

export const onRequestPost: PagesFunction<Env, string, { who: Who }> = async ({ request, env, data }) => {
  if (data.who.kind !== "runner") return bad("forbidden", 403);
  const t = data.who.tenant;
  let form: FormData;
  try { form = await request.formData(); } catch { return bad("multipart expected"); }
  const companyId = Number.parseInt(String(form.get("company_id")), 10);
  let meta: Record<string, unknown>;
  try { meta = JSON.parse(String(form.get("meta") ?? "{}")); } catch { return bad("bad meta"); }
  const company = await env.DB.prepare("SELECT id FROM companies WHERE id = ?1 AND tenant = ?2").bind(companyId, t).first();
  if (!company) return bad("unknown company", 404);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const keys: Record<"desktop" | "mobile", string | null> = { desktop: null, mobile: null };
  for (const view of ["desktop", "mobile"] as const) {
    const f = form.get(view);
    if (!(f instanceof File)) continue;
    if (f.size > MAX || f.type !== "image/jpeg") return bad(`${view}: JPEG up to 3 MB`);
    keys[view] = `snapshots/${t}/${companyId}/${stamp}-${view}.jpg`;
    await env.SNAPSHOTS.put(keys[view]!, f.stream(), { httpMetadata: { contentType: "image/jpeg" } });
  }

  const prev = await env.DB.prepare(`SELECT review_count, competitor_review_count, competitor_name FROM site_snapshots
    WHERE company_id = ?1 AND ${GOOD_SNAPSHOT} ORDER BY captured_at DESC, id DESC LIMIT 1`).bind(companyId)
    .first<{ review_count: number | null; competitor_review_count: number | null; competitor_name: string | null }>();
  const error = typeof meta.error === "string" && meta.error ? meta.error.slice(0, 200) : null;
  const perf = Number.isFinite(Number(meta.lh_mobile_perf)) && meta.lh_mobile_perf !== null ? Math.round(Number(meta.lh_mobile_perf)) : null;

  const row = await env.DB.prepare(
    `INSERT INTO site_snapshots (tenant, company_id, url, desktop_key, mobile_key, lh_mobile_perf, phone_above_fold_mobile, tel_link, form, https,
       review_count, competitor_review_count, competitor_name, error)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14) RETURNING id`,
  ).bind(t, companyId, typeof meta.url === "string" ? meta.url.slice(0, 500) : null, keys.desktop, keys.mobile, error ? null : perf,
    error ? null : flag(meta.phone_above_fold_mobile), error ? null : flag(meta.tel_link), error ? null : flag(meta.form), error ? null : flag(meta.https),
    prev?.review_count ?? null, prev?.competitor_review_count ?? null, prev?.competitor_name ?? null, error).first<{ id: number }>();
  return json(201, { id: row!.id });
};
