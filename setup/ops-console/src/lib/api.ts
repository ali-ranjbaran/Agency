/** Same-origin JSON calls. Access cookies ride along; the middleware checks the JWT. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? "GET",
    headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export type Fit = { score: number; parts: { id: string; label: string; points: number }[]; override: number | null };

export type Company = {
  id: number; name: string; domain: string | null; phone_e164: string | null; city: string | null; trade: string;
  segment: string; source: string; stage: string; fit_override: number | null; next_action: string | null;
  next_action_type: string | null; next_action_due: string | null; lead_id: number | null; notes: string | null;
  created_at: string; last_touch_at: string | null; casl_complete: number; ready_contacts: number; suppressed: number;
  snap_id: number | null; snap_at: string | null; lh_mobile_perf: number | null; tel_link: number | null;
  phone_above_fold_mobile: number | null; form: number | null; https: number | null;
  review_count: number | null; competitor_review_count: number | null; fit: Fit;
};

export type Contact = {
  id: number; company_id: number; name: string | null; title: string | null; email: string | null;
  source_url: string | null; capture_date: string | null; no_refusal_checked_where: string | null; relevance_rationale: string | null;
  casl_draft: number; casl_verified_at: string | null; email_flags: string; ready_to_send: number; suppressed: number;
};

export type Touch = { id: number; type: string; outcome: string | null; at: string; notes: string | null };

export type Lead = { id: number; created_at: string; name: string; company: string; email: string; phone: string | null;
  trade: string | null; city: string | null; message: string | null; status: string; company_id: number | null };

export const fmtDate = (s: string | null | undefined) => (s ? s.slice(0, 10) : "");
export const todayLocal = () => new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);
