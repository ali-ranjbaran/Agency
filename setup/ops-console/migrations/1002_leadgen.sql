-- Lead generator. Searches run on the Mac runner; results land as companies with
-- stage 'candidate' (the review queue). Nothing a search finds is sendable until the
-- operator approves the company and ticks the source-page check per contact.

ALTER TABLE companies ADD COLUMN search_key TEXT;        -- "hvac|saskatoon": the universe it belongs to
ALTER TABLE companies ADD COLUMN enrichment_json TEXT;   -- services, claims, signals found on their own site
CREATE INDEX IF NOT EXISTS companies_search_key ON companies (tenant, search_key, stage);

-- A refusal statement found on the source page ("no unsolicited email"…) blocks ready_to_send.
ALTER TABLE contacts ADD COLUMN refusal_found TEXT;
CREATE TRIGGER IF NOT EXISTS contacts_refusal_guard BEFORE UPDATE OF ready_to_send ON contacts
WHEN NEW.ready_to_send = 1 AND NEW.refusal_found IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'refusal statement on source page'); END;

-- Where each company was found. Google Places: ONLY the place_id is stored (Maps Platform terms).
-- OSM: osm_type/id with "© OpenStreetMap contributors (ODbL)".
CREATE TABLE IF NOT EXISTS company_sources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant      TEXT NOT NULL DEFAULT 'arkosa',
  company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source      TEXT NOT NULL CHECK (source IN ('osm','places','manual')),
  source_ref  TEXT NOT NULL,            -- place_id | node/123 | the URL pasted
  attribution TEXT,
  job_id      INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS company_sources_ref ON company_sources (tenant, source, source_ref);

-- Rejected firms, remembered so later searches skip them. One row per firm, any key may match.
CREATE TABLE IF NOT EXISTS rejections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant      TEXT NOT NULL DEFAULT 'arkosa',
  search_key  TEXT,
  name        TEXT,
  domain      TEXT,
  phone_e164  TEXT,
  place_id    TEXT,
  osm_ref     TEXT,
  reason      TEXT NOT NULL,
  at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS rejections_domain ON rejections (tenant, domain);
CREATE INDEX IF NOT EXISTS rejections_phone  ON rejections (tenant, phone_e164);
CREATE INDEX IF NOT EXISTS rejections_place  ON rejections (tenant, place_id);
CREATE INDEX IF NOT EXISTS rejections_osm    ON rejections (tenant, osm_ref);

CREATE TABLE IF NOT EXISTS saved_searches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant      TEXT NOT NULL DEFAULT 'arkosa',
  trade       TEXT NOT NULL,
  city        TEXT NOT NULL,
  radius_km   INTEGER,
  keywords    TEXT NOT NULL DEFAULT '',  -- comma list
  sources     TEXT NOT NULL DEFAULT 'osm',
  schedule    TEXT CHECK (schedule IS NULL OR schedule = 'monthly'),
  last_run_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS search_jobs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant          TEXT NOT NULL DEFAULT 'arkosa',
  saved_search_id INTEGER REFERENCES saved_searches(id) ON DELETE SET NULL,
  trade           TEXT NOT NULL,
  city            TEXT NOT NULL,
  radius_km       INTEGER,
  keywords        TEXT NOT NULL DEFAULT '',
  sources         TEXT NOT NULL,
  manual_urls     TEXT,                  -- JSON array, for the manual source
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','error')),
  counts_json     TEXT,                  -- found, known, rejected_skipped, suppressed_dropped, new_candidates, …
  places_calls    INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  claimed_at      TEXT,
  finished_at     TEXT
);
CREATE INDEX IF NOT EXISTS search_jobs_status ON search_jobs (tenant, status, id);

-- Hard monthly cap on Google Places calls; reserved BEFORE each call.
CREATE TABLE IF NOT EXISTS places_usage (
  tenant  TEXT NOT NULL DEFAULT 'arkosa',
  month   TEXT NOT NULL,                 -- YYYY-MM
  calls   INTEGER NOT NULL DEFAULT 0,
  alerted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant, month)
);
