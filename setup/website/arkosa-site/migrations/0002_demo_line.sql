-- Demo line v2: hashed callers, per-call log, hard caps with one alert per period.
-- Apply with:
--   npx wrangler d1 migrations apply arkosa --remote
-- demo_sms and opt_outs held full phone numbers. Both were empty when this was
-- written (checked 2026-10-13), so they are dropped, not migrated.

DROP TABLE IF EXISTS demo_sms;
DROP TABLE IF EXISTS opt_outs;

-- One row per inbound call to the demo number. The operator console reads this.
-- The full number is never stored: HMAC-SHA256 with PHONE_HASH_KEY, plus the last 4.
CREATE TABLE IF NOT EXISTS demo_calls (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),  -- UTC
  caller_hash  TEXT    NOT NULL,
  caller_last4 TEXT    NOT NULL,
  call_sid     TEXT,
  sms_sent     INTEGER NOT NULL DEFAULT 0,   -- 1 = text-back sent
  skip_reason  TEXT,                         -- opted_out | recent | daily_cap | monthly_cap | error:<status>
  reply_sent   INTEGER NOT NULL DEFAULT 0,   -- 1 = the one canned reply went out
  replied_at   TEXT,                         -- UTC; counts the reply in the right day/month
  carrier      TEXT                          -- NULL: Twilio's voice webhook doesn't provide it
);
CREATE INDEX IF NOT EXISTS demo_calls_caller_time ON demo_calls (caller_hash, created_at);
CREATE INDEX IF NOT EXISTS demo_calls_time        ON demo_calls (created_at);
CREATE INDEX IF NOT EXISTS demo_calls_replied     ON demo_calls (replied_at);

-- STOP list. Removed only by START from the same number.
CREATE TABLE IF NOT EXISTS demo_opt_outs (
  caller_hash TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One alert email per cap per period: kind = daily_cap | monthly_cap, period = YYYY-MM-DD | YYYY-MM.
CREATE TABLE IF NOT EXISTS demo_alerts (
  kind    TEXT NOT NULL,
  period  TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (kind, period)
);
