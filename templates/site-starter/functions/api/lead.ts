/**
 * POST /api/lead — the site's contact form.
 *
 * Public endpoint, so: same-origin check, honeypot, Turnstile, per-IP and per-day
 * caps, strict field limits. The lead is forwarded to the CRM's inbound webhook
 * and nothing about the person is kept here: D1 holds only a salted IP hash and
 * a timestamp, for the caps. Contacts live in the CRM.
 */
import type { Env } from "../../server/env";
import { int } from "../../server/env";
import { json, sha256Hex } from "../../server/http";

const LIMITS = { name: 80, phone: 30, email: 160, service: 80, message: 1500 } as const;

type Body = Record<string, unknown>;
const str = (b: Body, k: keyof typeof LIMITS) => {
  const v = typeof b[k] === "string" ? (b[k] as string).trim() : "";
  return v.slice(0, LIMITS[k]);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Mock sites never accept leads.
  if (env.SITE_MODE !== "client") return json(403, { ok: false, error: "preview" });

  // Same-origin only. Browsers always send Origin on a cross-site POST.
  const origin = request.headers.get("origin");
  const allowed = new Set([env.SITE_ORIGIN, new URL(request.url).origin]);
  if (!origin || !allowed.has(origin)) return json(403, { ok: false, error: "origin" });

  if (!env.TURNSTILE_SECRET || !env.IP_SALT || !env.CRM_WEBHOOK_URL) return json(503, { ok: false, error: "not_configured" });

  if (Number(request.headers.get("content-length") ?? 0) > 10000) return json(413, { ok: false, error: "too_large" });

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
    phone: str(body, "phone"),
    email: str(body, "email").toLowerCase() || null,
    service: str(body, "service") || null,
    message: str(body, "message") || null,
  };
  if (!lead.name || !lead.phone) return json(400, { ok: false, error: "missing" });
  if (!/^[0-9+().\-\s]{7,30}$/.test(lead.phone)) return json(400, { ok: false, error: "phone" });
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) return json(400, { ok: false, error: "email" });

  // Caps
  const ipHash = await sha256Hex(env.IP_SALT + "|" + ip);
  const caps = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM sends WHERE ip_hash = ?1 AND created_at > datetime('now','-1 hour')) AS ip_hour,
       (SELECT COUNT(*) FROM sends WHERE created_at > datetime('now','-1 day')) AS day`,
  ).bind(ipHash).first<{ ip_hour: number; day: number }>();
  if ((caps?.ip_hour ?? 0) >= int(env.LEADS_PER_IP_PER_HOUR, 3) || (caps?.day ?? 0) >= int(env.LEADS_PER_DAY, 40))
    return json(429, { ok: false, error: "rate_limited" });

  // Forward to the CRM. The send counts toward the caps whether or not the CRM accepts it.
  const res = await fetch(env.CRM_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...lead, source: "website", page: request.headers.get("referer") ?? null, submitted_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  const result = res?.ok ? "forwarded" : `error:${res?.status ?? "network"}`;
  await env.DB.prepare("INSERT INTO sends (ip_hash, result) VALUES (?1, ?2)").bind(ipHash, result).run();

  return res?.ok ? json(200, { ok: true }) : json(502, { ok: false, error: "crm" });
};

export const onRequest: PagesFunction<Env> = async () => json(405, { ok: false, error: "method" });
