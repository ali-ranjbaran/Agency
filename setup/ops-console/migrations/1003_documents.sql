-- Documents: git is the source, the console holds review state only.
-- The text of each document is bundled at build time (scripts/collect-docs.mjs); these tables
-- hold reviews, comments, the approved text and decision sign-offs, each tied to a content_sha.
-- An approval belongs to one content_sha: a new sha is "changed since approved" and back in review
-- (shared/docs.ts docStatus). History is append-only, like the suppression list.

-- Review events, newest last. The current status of a doc is its latest row for the current sha.
CREATE TABLE IF NOT EXISTS doc_reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant      TEXT NOT NULL DEFAULT 'arkosa',
  doc_path    TEXT NOT NULL CHECK (trim(doc_path) <> ''),
  content_sha TEXT NOT NULL CHECK (length(content_sha) = 64),
  status      TEXT NOT NULL CHECK (status IN ('unread','in_review','changes_requested','approved')),
  note        TEXT,
  reviewer    TEXT NOT NULL CHECK (trim(reviewer) <> ''),   -- email from the Access JWT
  at          TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (status <> 'changes_requested' OR trim(coalesce(note,'')) <> '')
);
CREATE INDEX IF NOT EXISTS doc_reviews_path ON doc_reviews (tenant, doc_path, id);
CREATE TRIGGER IF NOT EXISTS doc_reviews_no_update BEFORE UPDATE ON doc_reviews
BEGIN SELECT RAISE(ABORT, 'doc_reviews is append-only'); END;
CREATE TRIGGER IF NOT EXISTS doc_reviews_no_delete BEFORE DELETE ON doc_reviews
BEGIN SELECT RAISE(ABORT, 'doc_reviews is append-only'); END;

-- The exact text that was approved, so a later version can be diffed against it.
CREATE TABLE IF NOT EXISTS doc_approved_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant      TEXT NOT NULL DEFAULT 'arkosa',
  doc_path    TEXT NOT NULL CHECK (trim(doc_path) <> ''),
  content_sha TEXT NOT NULL CHECK (length(content_sha) = 64),
  content     TEXT NOT NULL CHECK (length(content) > 0),
  at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS doc_approved_snapshots_sha ON doc_approved_snapshots (tenant, doc_path, content_sha);
CREATE TRIGGER IF NOT EXISTS doc_snapshots_no_update BEFORE UPDATE ON doc_approved_snapshots
BEGIN SELECT RAISE(ABORT, 'doc_approved_snapshots is append-only'); END;
CREATE TRIGGER IF NOT EXISTS doc_snapshots_no_delete BEFORE DELETE ON doc_approved_snapshots
BEGIN SELECT RAISE(ABORT, 'doc_approved_snapshots is append-only'); END;

-- No approval without the approved text stored for that exact sha.
CREATE TRIGGER IF NOT EXISTS doc_reviews_approve_needs_snapshot BEFORE INSERT ON doc_reviews
WHEN NEW.status = 'approved'
BEGIN
  SELECT RAISE(ABORT, 'approval needs the approved snapshot for this sha') WHERE NOT EXISTS (
    SELECT 1 FROM doc_approved_snapshots s
    WHERE s.tenant = NEW.tenant AND s.doc_path = NEW.doc_path AND s.content_sha = NEW.content_sha);
END;

-- Comments on a heading (anchor = heading slug) of one version. Only `resolved` may change.
CREATE TABLE IF NOT EXISTS doc_comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant      TEXT NOT NULL DEFAULT 'arkosa',
  doc_path    TEXT NOT NULL CHECK (trim(doc_path) <> ''),
  content_sha TEXT NOT NULL CHECK (length(content_sha) = 64),
  anchor      TEXT NOT NULL CHECK (trim(anchor) <> ''),
  body        TEXT NOT NULL CHECK (trim(body) <> ''),
  reviewer    TEXT NOT NULL CHECK (trim(reviewer) <> ''),
  resolved    INTEGER NOT NULL DEFAULT 0 CHECK (resolved IN (0,1)),
  at          TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS doc_comments_path ON doc_comments (tenant, doc_path, resolved);
CREATE TRIGGER IF NOT EXISTS doc_comments_frozen BEFORE UPDATE OF tenant, doc_path, content_sha, anchor, body, reviewer, at ON doc_comments
BEGIN SELECT RAISE(ABORT, 'comments are frozen; only resolved may change'); END;
CREATE TRIGGER IF NOT EXISTS doc_comments_no_delete BEFORE DELETE ON doc_comments
BEGIN SELECT RAISE(ABORT, 'comments are kept; resolve instead'); END;

-- Sign-offs on the plan's D1–D10, tied to the sha of the decision's table row.
CREATE TABLE IF NOT EXISTS decision_signoffs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant       TEXT NOT NULL DEFAULT 'arkosa',
  decision_id  TEXT NOT NULL CHECK (decision_id GLOB 'D[0-9]*'),
  decision_sha TEXT NOT NULL CHECK (length(decision_sha) = 64),
  choice       TEXT NOT NULL CHECK (choice IN ('accept','reject','amend')),
  note         TEXT,
  reviewer     TEXT NOT NULL CHECK (trim(reviewer) <> ''),
  at           TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (choice = 'accept' OR trim(coalesce(note,'')) <> '')
);
CREATE INDEX IF NOT EXISTS decision_signoffs_id ON decision_signoffs (tenant, decision_id, id);
CREATE TRIGGER IF NOT EXISTS decision_signoffs_no_update BEFORE UPDATE ON decision_signoffs
BEGIN SELECT RAISE(ABORT, 'decision_signoffs is append-only'); END;
CREATE TRIGGER IF NOT EXISTS decision_signoffs_no_delete BEFORE DELETE ON decision_signoffs
BEGIN SELECT RAISE(ABORT, 'decision_signoffs is append-only'); END;

-- QA reports uploaded by the Mac runner (~/Arkosa-leads/qa/<run>/report.md). Text in D1,
-- screenshots in the private R2 bucket. Reviewed with the same doc_* tables (doc_path = qa/<run>).
CREATE TABLE IF NOT EXISTS qa_reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant      TEXT NOT NULL DEFAULT 'arkosa',
  run         TEXT NOT NULL CHECK (run GLOB '[A-Za-z0-9]*' AND run NOT GLOB '*[^A-Za-z0-9._-]*'),
  content_sha TEXT NOT NULL CHECK (length(content_sha) = 64),
  content     TEXT NOT NULL,
  verdict     TEXT,                 -- CLEARED | NOT CLEARED | LAUNCH BLOCKED, from the report
  shots_json  TEXT NOT NULL DEFAULT '[]',  -- R2 keys
  at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS qa_reports_run_sha ON qa_reports (tenant, run, content_sha);
