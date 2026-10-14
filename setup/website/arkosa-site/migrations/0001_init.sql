-- Arkosa site backend. Apply with:
--   npx wrangler d1 migrations apply arkosa --remote
-- Personal data lives here (Cloudflare D1), never in the repo.

-- Website intake form. The Mac lead runner picks up status='new'.
CREATE TABLE IF NOT EXISTS leads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  name          TEXT    NOT NULL,
  company       TEXT    NOT NULL,
  email         TEXT    NOT NULL,
  phone         TEXT,
  trade         TEXT,
  city          TEXT,
  message       TEXT,
  -- Missed-call calculator values, if the visitor sent them with the form.
  calc_missed_per_week REAL,
  calc_book_rate       REAL,
  calc_job_value       REAL,
  ip_hash       TEXT    NOT NULL,          -- salted SHA-256, for rate limiting only
  status        TEXT    NOT NULL DEFAULT 'new',   -- new | processing | briefed | error | archived
  attempts      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS leads_status  ON leads (status, created_at);
CREATE INDEX IF NOT EXISTS leads_ip_time ON leads (ip_hash, created_at);

-- Demo line: one row per text we sent (or skipped), for caps and the metrics sheet.
CREATE TABLE IF NOT EXISTS demo_sms (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  phone       TEXT NOT NULL,
  kind        TEXT NOT NULL,   -- textback | reply
  call_sid    TEXT,
  result      TEXT NOT NULL    -- sent | skipped:<reason> | error:<status>
);
CREATE INDEX IF NOT EXISTS demo_sms_phone_time ON demo_sms (phone, kind, created_at);
CREATE INDEX IF NOT EXISTS demo_sms_time       ON demo_sms (created_at);

-- STOP list for the demo line. Never deleted except by START from the same number.
CREATE TABLE IF NOT EXISTS opt_outs (
  phone       TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
