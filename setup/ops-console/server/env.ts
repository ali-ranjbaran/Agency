/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  SNAPSHOTS: R2Bucket;
  ALERTS?: Fetcher;
  TENANT: string;
  PLACES_MONTHLY_CAP: string;
  // secrets
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ACCESS_EMAILS?: string;
  RUNNER_CLIENT_IDS?: string;
  PHONE_HASH_KEY?: string;
  SNAPSHOT_URL_KEY?: string;
}

/** Who is calling, set by functions/_middleware.ts. */
export type Who = { kind: "operator"; email: string; tenant: string } | { kind: "runner"; clientId: string; tenant: string };

export type Ctx = EventContext<Env, string, { who: Who }>;
