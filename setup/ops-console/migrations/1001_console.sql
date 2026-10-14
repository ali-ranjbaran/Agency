-- Arkosa operator console, v1. Lives in the shared D1 `arkosa` next to the website's
-- tables (`leads`, `demo_calls`), which the console only ever reads.
-- File names start at 1001 so they can't collide with the site's migrations
-- (setup/website/arkosa-site/migrations, 0001…), which share the d1_migrations table.
--   npx wrangler d1 migrations apply arkosa --remote   (run from setup/ops-console)
-- Personal data lives here, never in git. Every table carries `tenant` so a client view
-- can be added later; v1 has one tenant, 'arkosa'.

CREATE TABLE IF NOT EXISTS companies (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant           TEXT    NOT NULL DEFAULT 'arkosa',
  name             TEXT    NOT NULL,
  domain           TEXT,                       -- registrable host, lowercase, no www
  phone_e164       TEXT,                       -- +1XXXXXXXXXX
  city             TEXT,
  trade            TEXT    NOT NULL DEFAULT 'hvac',
  segment          TEXT    NOT NULL DEFAULT 'unknown'
                   CHECK (segment IN ('residential','commercial','mixed','unknown')),
  source           TEXT    NOT NULL,           -- manual | import | inbound | osm | places | url
  stage            TEXT    NOT NULL DEFAULT 'prospect'
                   CHECK (stage IN ('candidate','prospect','contacted','conversation','demo_called',
                                    'discovery','proposal','won','lost','not_now')),
  fit_override     INTEGER,                    -- NULL = use the computed score
  next_action      TEXT,
  next_action_type TEXT CHECK (next_action_type IS NULL OR next_action_type IN ('call','email','follow_up','other')),
  next_action_due  TEXT,                       -- YYYY-MM-DD
  lead_id          INTEGER,                    -- leads.id when promoted from an inbound lead
  notes            TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS companies_tenant_domain ON companies (tenant, domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS companies_stage ON companies (tenant, stage, next_action_due);
CREATE INDEX IF NOT EXISTS companies_phone ON companies (tenant, phone_e164);

-- The 4 CASL fields, plus casl_verified_at (the operator ticked "I checked the source page").
-- ready_to_send = 1 is impossible without all of them: enforced by CHECK, not just the UI.
CREATE TABLE IF NOT EXISTS contacts (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant                   TEXT    NOT NULL DEFAULT 'arkosa',
  company_id               INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                     TEXT,
  title                    TEXT,
  email                    TEXT,
  source_url               TEXT,
  capture_date             TEXT,
  no_refusal_checked_where TEXT,
  relevance_rationale      TEXT,
  casl_draft               INTEGER NOT NULL DEFAULT 0,   -- 1 = machine-drafted, not yet approved
  casl_verified_at         TEXT,
  email_flags              TEXT    NOT NULL DEFAULT '',  -- comma list: role, freemail, isp
  ready_to_send            INTEGER NOT NULL DEFAULT 0 CHECK (ready_to_send IN (0,1)),
  created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (ready_to_send = 0 OR (
    trim(coalesce(email,'')) <> '' AND
    trim(coalesce(source_url,'')) <> '' AND
    trim(coalesce(capture_date,'')) <> '' AND
    trim(coalesce(no_refusal_checked_where,'')) <> '' AND
    trim(coalesce(relevance_rationale,'')) <> '' AND
    casl_verified_at IS NOT NULL AND
    casl_draft = 0))
);
CREATE INDEX IF NOT EXISTS contacts_company ON contacts (company_id);
CREATE INDEX IF NOT EXISTS contacts_email   ON contacts (tenant, email);

CREATE TABLE IF NOT EXISTS touches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant     TEXT NOT NULL DEFAULT 'arkosa',
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('email','call','demo_call','discovery','proposal','note','stage_change')),
  outcome    TEXT,
  at         TEXT NOT NULL DEFAULT (datetime('now')),
  notes      TEXT
);
CREATE INDEX IF NOT EXISTS touches_company_at ON touches (company_id, at);

CREATE TABLE IF NOT EXISTS site_snapshots (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant                  TEXT NOT NULL DEFAULT 'arkosa',
  company_id              INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  captured_at             TEXT NOT NULL DEFAULT (datetime('now')),
  url                     TEXT,
  desktop_key             TEXT,        -- R2 keys (private bucket)
  mobile_key              TEXT,
  lh_mobile_perf          INTEGER,     -- 0–100, Lighthouse mobile performance
  phone_above_fold_mobile INTEGER,     -- 1/0, NULL = not measured
  tel_link                INTEGER,
  form                    INTEGER,
  https                   INTEGER,
  review_count            INTEGER,     -- manual entry in v1
  competitor_review_count INTEGER,
  competitor_name         TEXT,
  error                   TEXT         -- e.g. robots_disallowed, timeout
);
CREATE INDEX IF NOT EXISTS snapshots_company ON site_snapshots (company_id, captured_at);

-- Append-only. A match hides the row from every send view and blocks ready_to_send.
CREATE TABLE IF NOT EXISTS suppression (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant TEXT NOT NULL DEFAULT 'arkosa',
  kind   TEXT NOT NULL CHECK (kind IN ('email','domain','phone')),
  value  TEXT NOT NULL,                -- lowercase email / domain, or E.164 phone
  reason TEXT NOT NULL,
  at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS suppression_lookup ON suppression (tenant, kind, value);
CREATE TRIGGER IF NOT EXISTS suppression_no_update BEFORE UPDATE ON suppression
BEGIN SELECT RAISE(ABORT, 'suppression is append-only'); END;
CREATE TRIGGER IF NOT EXISTS suppression_no_delete BEFORE DELETE ON suppression
BEGIN SELECT RAISE(ABORT, 'suppression is append-only'); END;

-- A new suppression row immediately un-readies every matching contact.
CREATE TRIGGER IF NOT EXISTS suppression_unready AFTER INSERT ON suppression
BEGIN
  UPDATE contacts SET ready_to_send = 0, updated_at = datetime('now')
  WHERE tenant = NEW.tenant AND ready_to_send = 1 AND (
    (NEW.kind = 'email'  AND lower(email) = NEW.value) OR
    (NEW.kind = 'domain' AND lower(substr(email, instr(email,'@') + 1)) = NEW.value) OR
    (NEW.kind = 'domain' AND company_id IN (SELECT id FROM companies WHERE domain = NEW.value)) OR
    (NEW.kind = 'phone'  AND company_id IN (SELECT id FROM companies WHERE phone_e164 = NEW.value)));
END;

-- ready_to_send = 1 is refused for suppressed emails, domains or company phones, and for
-- companies still in the review queue (stage 'candidate').
CREATE TRIGGER IF NOT EXISTS contacts_ready_guard_update BEFORE UPDATE OF ready_to_send ON contacts
WHEN NEW.ready_to_send = 1
BEGIN
  SELECT RAISE(ABORT, 'suppressed') WHERE EXISTS (
    SELECT 1 FROM suppression s, companies c WHERE c.id = NEW.company_id AND s.tenant = NEW.tenant AND (
      (s.kind = 'email'  AND s.value = lower(NEW.email)) OR
      (s.kind = 'domain' AND s.value = lower(substr(NEW.email, instr(NEW.email,'@') + 1))) OR
      (s.kind = 'domain' AND s.value = c.domain) OR
      (s.kind = 'phone'  AND s.value = c.phone_e164)));
  SELECT RAISE(ABORT, 'company not approved') WHERE
    (SELECT stage FROM companies WHERE id = NEW.company_id) = 'candidate';
END;
CREATE TRIGGER IF NOT EXISTS contacts_ready_guard_insert BEFORE INSERT ON contacts
WHEN NEW.ready_to_send = 1
BEGIN SELECT RAISE(ABORT, 'contacts are created not-ready; mark ready after checking'); END;

-- Editing any CASL field or the email after verification clears the tick and readiness.
CREATE TRIGGER IF NOT EXISTS contacts_casl_edit_resets AFTER UPDATE OF email, source_url, capture_date,
  no_refusal_checked_where, relevance_rationale ON contacts
WHEN OLD.casl_verified_at IS NOT NULL AND (
  coalesce(OLD.email,'') <> coalesce(NEW.email,'') OR
  coalesce(OLD.source_url,'') <> coalesce(NEW.source_url,'') OR
  coalesce(OLD.capture_date,'') <> coalesce(NEW.capture_date,'') OR
  coalesce(OLD.no_refusal_checked_where,'') <> coalesce(NEW.no_refusal_checked_where,'') OR
  coalesce(OLD.relevance_rationale,'') <> coalesce(NEW.relevance_rationale,''))
BEGIN
  UPDATE contacts SET casl_verified_at = NULL, ready_to_send = 0 WHERE id = NEW.id;
END;

-- CSV import rows that failed the CASL check wait here to be fixed, then promoted.
CREATE TABLE IF NOT EXISTS import_quarantine (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant     TEXT NOT NULL DEFAULT 'arkosa',
  batch      TEXT NOT NULL,
  row_json   TEXT NOT NULL,
  missing    TEXT NOT NULL,               -- comma list of missing/invalid fields
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
