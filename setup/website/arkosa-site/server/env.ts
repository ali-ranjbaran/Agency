/// <reference types="@cloudflare/workers-types" />

/** Bindings and vars for the Pages Functions. See wrangler.toml. */
export interface Env {
  DB: D1Database;
  /** Service binding to the arkosa-alerts Worker (email to the operator). Optional so a missing binding never breaks the demo line. */
  ALERTS?: Fetcher;
  SITE_ORIGIN: string;
  INTAKE_PER_IP_PER_HOUR: string;
  INTAKE_PER_DAY: string;
  DEMO_BUSINESS_NAME: string;
  DEMO_CALLBACK_MIN: string;
  DEMO_SMS_CALLER_WINDOW_MIN: string;
  DEMO_SMS_PER_DAY: string;
  DEMO_SMS_PER_MONTH: string;
  /** Local tests only: points sendSms at a mock. Never set in production. */
  TWILIO_API_BASE?: string;
  // secrets
  TURNSTILE_SECRET?: string;
  IP_SALT?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_DEMO_NUMBER?: string;
  PHONE_HASH_KEY?: string;
}

export const int = (v: string | undefined, fallback: number) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
