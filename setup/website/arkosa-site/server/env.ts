/// <reference types="@cloudflare/workers-types" />

/** Bindings and vars for the Pages Functions. See wrangler.toml. */
export interface Env {
  DB: D1Database;
  SITE_ORIGIN: string;
  INTAKE_PER_IP_PER_HOUR: string;
  INTAKE_PER_DAY: string;
  DEMO_SMS_PER_DAY: string;
  DEMO_BUSINESS_NAME: string;
  // secrets
  TURNSTILE_SECRET?: string;
  IP_SALT?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_DEMO_NUMBER?: string;
}

export const int = (v: string | undefined, fallback: number) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
