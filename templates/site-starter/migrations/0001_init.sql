-- Rate limiting for the contact form. Apply with: npm run db:migrate
-- No customer data is stored here: the lead itself goes to the CRM webhook.
CREATE TABLE IF NOT EXISTS sends (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  ip_hash     TEXT NOT NULL,             -- salted SHA-256 of the IP
  result      TEXT NOT NULL              -- forwarded | error:<status>
);
CREATE INDEX IF NOT EXISTS sends_ip_time ON sends (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS sends_time    ON sends (created_at);
