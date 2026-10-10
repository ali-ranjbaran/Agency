#!/usr/bin/env node
/**
 * Start a site from this template.
 *
 *   Client build (build-site step 5):
 *     node scripts/new-site.mjs --client <name> --intake clients/<name>/intake.json [--out <dir>]
 *     → ~/personal-project/sites/<name>/, its own git repo, content/site.json filled from the intake.
 *       Refuses without exactly one conversion action. Prints whatever is still missing.
 *
 *   Private mock from a website lead:
 *     node scripts/new-site.mjs --mock --lead ~/Arkosa-leads/<folder>/lead.json [--out <dir>]
 *     → <lead folder>/mock/, filled from the lead + the trade preset, SITE_MODE = "mock"
 *       (password-protected, noindex, form disabled). Never inside the Agency repo.
 *     --seed <mock-seed.json>  optional, from the audit-site skill: its hero, conversion, area
 *       and services replace the preset's where they're well-formed. The validator still runs.
 *
 * intake.json has the same shape as content/site.json (see lib/content.ts), without "mode".
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { validate } from "./validate-content.mjs";

const TEMPLATE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(TEMPLATE, "../..");
const ACTIONS = ["call", "form", "booking", "quote"];
const SKIP = new Set(["node_modules", ".next", "out", ".wrangler", "presets", "new-site.mjs", "site.json", ".DS_Store", "tsconfig.tsbuildinfo", "next-env.d.ts"]);

const die = (msg) => { console.error(`new-site: ${msg}`); process.exit(1); };
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch (e) { die(`can't read ${p}: ${e.message}`); } };
const slug = (s) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const inside = (child, parent) => { const r = relative(parent, child); return r === "" || (!r.startsWith("..") && !r.startsWith("/")); };
const titleCase = (s) => String(s).trim().toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

function copyTemplate(dest) {
  if (existsSync(dest)) die(`${dest} already exists; pick another --out or remove it first`);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(TEMPLATE, dest, { recursive: true, filter: (src) => !SKIP.has(basename(src)) });
}

function configure(dest, { name, origin, mode }) {
  const pkgPath = join(dest, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  pkg.name = name;
  pkg.scripts["db:migrate"] = `wrangler d1 migrations apply ${name}-db --remote`;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  const tomlPath = join(dest, "wrangler.toml");
  const toml = readFileSync(tomlPath, "utf8")
    .replace(/^name = ".*"$/m, `name = "${name}"`)
    .replace(/^database_name = ".*"$/m, `database_name = "${name}-db"`)
    .replace(/^SITE_ORIGIN = ".*"$/m, `SITE_ORIGIN = "${origin}"`)
    .replace(/^SITE_MODE = ".*"$/m, `SITE_MODE = "${mode}"`);
  writeFileSync(tomlPath, toml);
}

function report(content, dest) {
  const { errors, warnings } = validate(content);
  for (const w of warnings) console.log(`  warn  ${w}`);
  if (errors.length) {
    console.log(`\nStill missing before it will build (${errors.length}):`);
    for (const e of errors) console.log(`  ✗ ${e}`);
    console.log(`\nFill these in ${join(dest, "content/site.json")}, then npm run validate.`);
  } else console.log("\ncontent ok");
}

// ---- client -----------------------------------------------------------------
function client() {
  const name = arg("--client");
  if (!name || slug(name) !== name) die("--client needs a kebab-case trading name, e.g. --client northgate-heating");
  const intakePath = arg("--intake") ?? die("--intake <path to intake.json> is required");
  const intake = readJson(intakePath);

  // build-site step 2 gate: exactly one primary conversion action.
  const action = intake?.conversion?.action;
  if (Array.isArray(action) || !ACTIONS.includes(action))
    die(`intake.conversion.action must be exactly one of ${ACTIONS.join(", ")} (build-site step 2). Got: ${JSON.stringify(action)}`);

  const dest = resolve(arg("--out") ?? join(homedir(), "personal-project/sites", name));
  if (inside(dest, REPO)) die("client sites live in their own repo, outside the Agency repo");

  const { mode: _ignored, fixture: _f, ...rest } = intake;
  const content = { mode: "client", ...rest };
  copyTemplate(dest);
  writeFileSync(join(dest, "content/site.json"), JSON.stringify(content, null, 2) + "\n");
  const domain = intake?.business?.domain;
  configure(dest, { name: `${name}-site`, origin: domain ? `https://${domain}` : "https://example.com", mode: "client" });
  spawnSync("git", ["init", "-q", "-b", "main"], { cwd: dest, stdio: "inherit" });

  console.log(`Created ${dest}`);
  if (!domain) console.log("  note  business.domain not set: SITE_ORIGIN in wrangler.toml is a placeholder");
  report(content, dest);
  console.log(`\nNext: cd ${dest} && npm install && npm run build. Setup steps: README.md.`);
}

// ---- mock -------------------------------------------------------------------
const TRADE = { hvac: "hvac", plumbing: "plumbing", electrical: "electrical" };

function mock() {
  const leadPath = resolve(arg("--lead") ?? die("--lead <path to lead.json> is required"));
  if (inside(leadPath, REPO)) die("lead.json must not be inside the Agency repo");
  const lead = readJson(leadPath);
  const trade = TRADE[String(lead.trade ?? "").toLowerCase()];
  if (!trade) die(`no preset for trade "${lead.trade}"; mocks cover HVAC, Plumbing and Electrical`);
  if (!lead.company) die("lead has no company name");
  const preset = readJson(join(TEMPLATE, "presets", `${trade}.json`));

  const city = lead.city ? titleCase(lead.city) : "your area";
  const digits = String(lead.phone ?? "").replace(/\D/g, "");
  const phone = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits[0] === "1" ? `+${digits}` : "+13065550100";
  const fill = (s) => s.replaceAll("{city}", city);

  const content = {
    mode: "mock",
    business: { name: lead.company, trade, phone },
    area: { primary: city, cities: [city] },
    conversion: preset.conversion,
    hero: { headline: fill(preset.hero.headline), subhead: fill(preset.hero.subhead) },
    fear: preset.fear,
    services: preset.services,
    proof: { reviews: [], stats: [], badges: [] },
    brand: preset.brand,
    legal: { province: "Canada", privacyContact: lead.email || "privacy@example.com" },
  };

  const seedPath = arg("--seed");
  if (seedPath) {
    if (inside(resolve(seedPath), REPO)) die("--seed must not be inside the Agency repo");
    for (const note of applySeed(content, readJson(resolve(seedPath)))) console.log(`  seed  ${note}`);
  }

  const dest = resolve(arg("--out") ?? join(dirname(leadPath), "mock"));
  if (inside(dest, REPO)) die("mocks hold lead data and must stay outside the Agency repo");
  copyTemplate(dest);
  writeFileSync(join(dest, "content/site.json"), JSON.stringify(content, null, 2) + "\n");
  configure(dest, { name: `mock-${slug(lead.company) || "lead"}`, origin: "https://example.com", mode: "mock" });

  console.log(`Created mock at ${dest}`);
  if (phone === "+13065550100") console.log("  note  the lead gave no usable phone; the mock shows a 555 placeholder number");
  report(content, dest);
  console.log(`
Next:
  cd ${dest} && npm install && npm run build
  Preview locally:  npx wrangler pages dev ./out --binding MOCK_PASSWORD=<pick one>
  Never deploy it publicly (CLAUDE.md). If it goes online, MOCK_PASSWORD must be set first;
  without it the site serves nothing. No prospect photography, ever.`);
}

/** Audit seed → mock content. Only well-formed parts are taken; the rest stays from the preset. */
function applySeed(content, seed) {
  const notes = [];
  const str = (v) => typeof v === "string" && v.trim().length > 0;
  if (str(seed?.hero?.headline) && str(seed?.hero?.subhead)) { content.hero = { headline: seed.hero.headline.trim(), subhead: seed.hero.subhead.trim() }; notes.push("hero from audit"); }
  const cv = seed?.conversion;
  if (cv && ["call", "form", "quote"].includes(cv.action) && str(cv.label)) { content.conversion = { action: cv.action, label: cv.label.trim() }; notes.push(`conversion: ${cv.action}`); }
  const cities = seed?.area?.cities;
  if (str(seed?.area?.primary) && Array.isArray(cities) && cities.length && cities.every(str)) { content.area = { primary: seed.area.primary.trim(), cities: cities.slice(0, 12).map((c) => c.trim()) }; notes.push("service area from audit"); }
  const svc = Array.isArray(seed?.services) ? seed.services.filter((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s?.slug ?? "") && ["name", "summary", "whenNeeded", "differentiator"].every((k) => str(s?.[k]))) : [];
  if (svc.length >= 1) { content.services = svc.slice(0, 6).map(({ slug, name, summary, whenNeeded, differentiator }) => ({ slug, name, summary, whenNeeded, differentiator })); notes.push(`${content.services.length} services from audit`); }
  else if (seed?.services) notes.push("services in seed were incomplete; using the trade preset");
  return notes;
}

if (process.argv.includes("--client")) client();
else if (process.argv.includes("--mock")) mock();
else die("use --client <name> --intake <file>  or  --mock --lead <file> [--seed <mock-seed.json>]");
