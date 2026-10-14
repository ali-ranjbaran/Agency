/**
 * POST /api/intake — the website's "Send your details" form.
 *
 * Public endpoint, so: same-origin check, honeypot, Turnstile, per-IP and per-day
 * caps, strict field limits. No model call happens here; a bot can fill the
 * table up to the daily cap and nothing more. The Mac lead runner reads
 * status='new' rows and runs the prep-discovery skill.
 */
import type { Env } from "../../server/env";
import { int } from "../../server/env";
import { json, sha256Hex } from "../../server/http";

const LIMITS = { name: 80, company: 120, email: 160, phone: 30, trade: 40, city: 60, message: 1500 } as const;
const TRADES = new Set(["HVAC", "Plumbing", "Electrical", "Other"]);

type Body = Record<string, unknown>;
const str = (b: Body, k: keyof typeof LIMITS) => {
  const v = typeof b[k] === "string" ? (b[k] as string).trim() : "";
  return v.slice(0, LIMITS[k]);
};
const num = (v: unknown, min: number, max: number) => {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Same-origin only. Browsers always send Origin on a cross-site POST.
  const origin = request.headers.get("origin");
  const allowed = new Set([env.SITE_ORIGIN, new URL(request.url).origin]);
  if (!origin || !allowed.has(origin)) return json(403, { ok: false, error: "origin" });

  if (!env.TURNSTILE_SECRET || !env.IP_SALT) return json(503, { ok: false, error: "not_configured" });

  if (Number(request.headers.get("content-length") ?? 0) > 20000) return json(413, { ok: false, error: "too_large" });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json(400, { ok: false, error: "bad_json" });
  }

  // Honeypot: real people never see this field.
  if (typeof body.website === "string" && body.website.length > 0) return json(200, { ok: true });

  const ip = request.headers.get("cf-connecting-ip") ?? "";

  // Turnstile
  const token = typeof body.turnstile === "string" ? body.turnstile : "";
  if (!token) return json(400, { ok: false, error: "captcha" });
  const ts = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
  }).then((r) => r.json() as Promise<{ success?: boolean }>).catch(() => ({ success: false }));
  if (!ts.success) return json(400, { ok: false, error: "captcha" });

  // Fields
  const lead = {
    name: str(body, "name"),
    company: str(body, "company"),
    email: str(body, "email").toLowerCase(),
    phone: str(body, "phone") || null,
    trade: TRADES.has(str(body, "trade")) ? str(body, "trade") : null,
    city: str(body, "city") || null,
    message: str(body, "message") || null,
  };
  if (!lead.name || !lead.company) return json(400, { ok: false, error: "missing" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) return json(400, { ok: false, error: "email" });
  if (lead.phone && !/^[0-9+().\-\s]{7,30}$/.test(lead.phone)) return json(400, { ok: false, error: "phone" });

  const calc = (typeof body.calc === "object" && body.calc) ? (body.calc as Body) : {};
  const calcMissed = num(calc.missedPerWeek, 0, 500);
  const calcRate = num(calc.bookRate, 0, 100);
  const calcValue = num(calc.jobValue, 0, 100000);

  // Caps
  const ipHash = await sha256Hex(env.IP_SALT + "|" + ip);
  const caps = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM leads WHERE ip_hash = ?1 AND created_at > datetime('now','-1 hour')) AS ip_hour,
       (SELECT COUNT(*) FROM leads WHERE created_at > datetime('now','-1 day')) AS day`,
  ).bind(ipHash).first<{ ip_hour: number; day: number }>();
  if ((caps?.ip_hour ?? 0) >= int(env.INTAKE_PER_IP_PER_HOUR, 3) || (caps?.day ?? 0) >= int(env.INTAKE_PER_DAY, 40))
    return json(429, { ok: false, error: "rate_limited" });

  await env.DB.prepare(
    `INSERT INTO leads (name, company, email, phone, trade, city, message,
                        calc_missed_per_week, calc_book_rate, calc_job_value, ip_hash)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
  ).bind(lead.name, lead.company, lead.email, lead.phone, lead.trade, lead.city, lead.message,
         calcMissed, calcRate, calcValue, ipHash).run();

  return json(200, { ok: true });
};

export const onRequest: PagesFunction<Env> = async () => json(405, { ok: false, error: "method" });
