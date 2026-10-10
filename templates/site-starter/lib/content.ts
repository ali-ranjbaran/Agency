/**
 * The content contract. content/site.json is the only file a build edits;
 * scripts/validate-content.mjs enforces it before every build.
 */
import raw from "@/content/site.json";

export type Trade = "hvac" | "plumbing" | "electrical";
export type ConversionAction = "call" | "form" | "booking" | "quote";

export interface Service {
  slug: string;          // kebab-case, used in /services/<slug>/
  name: string;
  summary: string;       // one sentence for the card
  whenNeeded: string;    // who it's for / when they need it
  differentiator: string; // the one thing this business does differently
}

export interface SiteContent {
  mode: "client" | "mock";
  /** content/example.json only: a fictional business. Shows a banner; deploy refuses it. */
  fixture?: boolean;
  business: {
    name: string;
    trade: Trade;
    phone: string;        // E.164, e.g. +13065550123
    email?: string;
    address?: { street?: string; city: string; province: string; postal?: string };
    licenseNumber?: string;
    hours?: string;       // e.g. "Mon–Fri 7am–6pm, emergency calls 24/7"
    yearsInBusiness?: number;
    domain?: string;      // e.g. northgateheating.ca
  };
  area: { primary: string; cities: string[] };
  conversion: {
    action: ConversionAction;
    label: string;        // button copy: action + benefit, never "Submit"
    bookingUrl?: string;  // required when action is "booking"
  };
  hero: { headline: string; subhead: string };
  fear: { fear: string; answer: string; proof?: string };
  services: Service[];
  proof: {
    reviews: { text: string; author: string; source: string; url?: string }[];
    stats: { value: string; label: string; source: string }[];
    badges: string[];     // e.g. "Licensed with SaskPower", "TSASK registered"
  };
  about?: { body: string[] };
  brand: {
    ink: string;          // text colour
    bg: string;           // page background
    primary: string;      // buttons and accents
    primaryInk: string;   // text on primary
    muted: string;        // secondary text
    logo?: string;        // path under /public, e.g. /logo.svg
    favicon?: string;     // path under /public; defaults to the neutral /favicon.svg
  };
  legal: { province: string; privacyContact: string; privacyUpdated?: string }; // privacyUpdated: e.g. "October 10, 2026"
}

export const site = raw as SiteContent;
export const isMock = site.mode === "mock";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || (site.business.domain ? `https://${site.business.domain}` : "https://example.com");
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
export const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID ?? "";
/** A call-tracking number replaces the business phone everywhere it's shown. */
export const PHONE = process.env.NEXT_PUBLIC_CALL_TRACKING_NUMBER || site.business.phone;

/** +13065550123 → (306) 555-0123 */
export const formatPhone = (e164: string) => {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
};

export const TRADE_LABEL: Record<Trade, string> = { hvac: "Heating and cooling", plumbing: "Plumbing", electrical: "Electrical" };
export const SCHEMA_TYPE: Record<Trade, string> = { hvac: "HVACBusiness", plumbing: "Plumber", electrical: "Electrician" };

/** Where the one primary CTA goes. */
export function primaryHref(): { href: string; external?: boolean } {
  switch (site.conversion.action) {
    case "call": return { href: `tel:${PHONE}` };
    case "booking": return { href: site.conversion.bookingUrl ?? "/contact/", external: true };
    case "form":
    case "quote": return { href: "/contact/#form" };
  }
}

export const NAV = [
  { href: "/#services", label: "Services" },
  { href: "/service-area/", label: "Service area" },
  ...(site.about?.body?.length ? [{ href: "/about/", label: "About" }] : []),
  { href: "/contact/", label: "Contact" },
];
