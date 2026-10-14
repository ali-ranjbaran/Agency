/**
 * CASL record-keeping for cold B2B email (plan v4 §2.5). All four fields are required, and
 * the operator must tick "I checked the source page", before a contact can be ready to send.
 * The database enforces the same rule (CHECK on contacts); this module is for the UI and import.
 */
export const CASL_FIELDS = ["source_url", "capture_date", "no_refusal_checked_where", "relevance_rationale"] as const;
export type CaslField = (typeof CASL_FIELDS)[number];

export const CASL_LABEL: Record<CaslField, string> = {
  source_url: "Source URL",
  capture_date: "Capture date",
  no_refusal_checked_where: "No-refusal check (where)",
  relevance_rationale: "Relevance rationale",
};

type Caslish = Partial<Record<CaslField | "email", string | null>>;

/** Missing or invalid fields, empty when complete. */
export function caslMissing(c: Caslish): string[] {
  const missing: string[] = [];
  if (!c.email || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(c.email.trim())) missing.push("email");
  for (const f of CASL_FIELDS) if (!c[f] || !String(c[f]).trim()) missing.push(f);
  if (c.source_url && !/^https?:\/\/\S+$/i.test(c.source_url.trim())) missing.push("source_url (must be a URL)");
  if (c.capture_date && !/^\d{4}-\d{2}-\d{2}/.test(c.capture_date.trim())) missing.push("capture_date (YYYY-MM-DD)");
  return [...new Set(missing)];
}

export const caslComplete = (c: Caslish) => caslMissing(c).length === 0;
