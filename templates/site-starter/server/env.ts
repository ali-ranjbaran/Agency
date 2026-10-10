/// <reference types="@cloudflare/workers-types" />

/** Bindings and vars for the Pages Functions. See wrangler.toml. */
export interface Env {
  DB: D1Database;
  SITE_ORIGIN: string;
  /** "client" or "mock". A mock is password-protected on every route. */
  SITE_MODE: string;
  LEADS_PER_IP_PER_HOUR: string;
  LEADS_PER_DAY: string;
  // secrets
  TURNSTILE_SECRET?: string;
  IP_SALT?: string;
  /** The CRM's inbound webhook (GHL: Automation → Workflow → Inbound Webhook trigger). */
  CRM_WEBHOOK_URL?: string;
  /** Mock sites only. */
  MOCK_PASSWORD?: string;
}

export const int = (v: string | undefined, fallback: number) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
