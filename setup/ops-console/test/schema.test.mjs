// The CASL and suppression gates live in the schema, so they're tested against the real
// migration in SQLite (D1 is SQLite). Fictional data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const MIG = new URL("../migrations/", import.meta.url);

function db() {
  const d = new DatabaseSync(":memory:");
  d.exec("PRAGMA foreign_keys = ON;");
  for (const f of readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort()) d.exec(readFileSync(new URL(f, MIG), "utf8"));
  d.prepare("INSERT INTO companies (name, domain, phone_e164, source) VALUES ('Northgate Heating & Air','northgate.example','+13065550123','manual')").run();
  return d;
}
const COMPLETE = {
  email: "office@northgate.example",
  source_url: "https://northgate.example/contact",
  capture_date: "2026-10-13",
  no_refusal_checked_where: "contact page footer, no refusal found",
  relevance_rationale: "Office manager at a residential HVAC firm in Saskatoon",
};
function addContact(d, fields = COMPLETE) {
  const cols = Object.keys(fields);
  return d.prepare(`INSERT INTO contacts (company_id, ${cols.join(",")}) VALUES (1, ${cols.map(() => "?").join(",")})`)
    .run(...Object.values(fields)).lastInsertRowid;
}
const ready = (d, id) => d.prepare("UPDATE contacts SET ready_to_send = 1, casl_verified_at = coalesce(casl_verified_at, datetime('now')) WHERE id = ?").run(id);
const isReady = (d, id) => d.prepare("SELECT ready_to_send FROM contacts WHERE id = ?").get(id).ready_to_send;

test("complete CASL fields + tick → ready", () => {
  const d = db();
  const id = addContact(d);
  ready(d, id);
  assert.equal(isReady(d, id), 1);
});

for (const f of ["email", "source_url", "capture_date", "no_refusal_checked_where", "relevance_rationale"]) {
  test(`missing ${f} → can't be ready`, () => {
    const d = db();
    const id = addContact(d, { ...COMPLETE, [f]: "  " });
    assert.throws(() => ready(d, id), /CHECK constraint failed/);
  });
}

test("no tick (casl_verified_at) → can't be ready", () => {
  const d = db();
  const id = addContact(d);
  assert.throws(() => d.prepare("UPDATE contacts SET ready_to_send = 1 WHERE id = ?").run(id), /CHECK constraint failed/);
});

test("machine draft → can't be ready until approved", () => {
  const d = db();
  const id = addContact(d, { ...COMPLETE, casl_draft: 1 });
  assert.throws(() => ready(d, id), /CHECK constraint failed/);
});

test("contacts can't be inserted ready", () => {
  const d = db();
  assert.throws(() => addContact(d, { ...COMPLETE, casl_verified_at: "2026-10-13", ready_to_send: 1 }), /created not-ready/);
});

for (const [kind, value] of [["email", "office@northgate.example"], ["domain", "northgate.example"], ["phone", "+13065550123"]]) {
  test(`suppressed ${kind} → can't be ready`, () => {
    const d = db();
    const id = addContact(d);
    d.prepare("INSERT INTO suppression (kind, value, reason) VALUES (?, ?, 'asked not to be contacted')").run(kind, value);
    assert.throws(() => ready(d, id), /suppressed/);
  });
  test(`suppressing ${kind} un-readies an already-ready contact`, () => {
    const d = db();
    const id = addContact(d);
    ready(d, id);
    d.prepare("INSERT INTO suppression (kind, value, reason) VALUES (?, ?, 'bounce')").run(kind, value);
    assert.equal(isReady(d, id), 0);
  });
}

test("suppression is append-only", () => {
  const d = db();
  d.prepare("INSERT INTO suppression (kind, value, reason) VALUES ('email','x@y.example','test')").run();
  assert.throws(() => d.prepare("UPDATE suppression SET reason = 'changed'").run(), /append-only/);
  assert.throws(() => d.prepare("DELETE FROM suppression").run(), /append-only/);
});

test("candidate company → contact can't be ready", () => {
  const d = db();
  d.prepare("UPDATE companies SET stage = 'candidate' WHERE id = 1").run();
  const id = addContact(d);
  assert.throws(() => ready(d, id), /company not approved/);
});

test("editing a CASL field after the tick clears tick and readiness", () => {
  const d = db();
  const id = addContact(d);
  ready(d, id);
  d.prepare("UPDATE contacts SET source_url = 'https://northgate.example/about' WHERE id = ?").run(id);
  const row = d.prepare("SELECT ready_to_send, casl_verified_at FROM contacts WHERE id = ?").get(id);
  assert.equal(row.ready_to_send, 0);
  assert.equal(row.casl_verified_at, null);
});

test("bad stage / segment values are refused", () => {
  const d = db();
  assert.throws(() => d.prepare("UPDATE companies SET stage = 'hot' WHERE id = 1").run(), /CHECK constraint failed/);
  assert.throws(() => d.prepare("UPDATE companies SET segment = 'industrial' WHERE id = 1").run(), /CHECK constraint failed/);
});

test("refusal statement on the source page → can't be ready", () => {
  const d = db();
  const id = addContact(d, { ...COMPLETE, refusal_found: 'contact page: "no unsolicited email"' });
  assert.throws(() => ready(d, id), /refusal statement/);
});

test("places cap reservation is one atomic statement and stops at the cap", () => {
  const d = db();
  const reserve = () => d.prepare(`INSERT INTO places_usage (tenant, month, calls) VALUES ('arkosa','2026-10',1)
    ON CONFLICT (tenant, month) DO UPDATE SET calls = calls + 1 WHERE calls < 3 RETURNING calls`).get();
  const got = [reserve(), reserve(), reserve(), reserve(), reserve()].map((r) => r?.calls ?? null);
  assert.deepEqual(got, [1, 2, 3, null, null]);
});
