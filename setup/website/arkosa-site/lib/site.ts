export const SITE_URL = "https://thearkosa.com";
export const EMAIL = "hello@thearkosa.com";
export const MAILTO = `mailto:${EMAIL}`;
export const NAV = [
  { href: "/#services", label: "Services" },
  { href: "/#who", label: "Who we serve" },
  { href: "/#about", label: "About" },
  { href: "/#start", label: "Get started" },
] as const;

/*
 * The four "start" options. Each is set at build time (Cloudflare Pages →
 * Settings → Variables, or .env.local) and an option stays hidden until its
 * value exists, so the site never ships a dead button.
 */

/** Demo text-back line, E.164, e.g. +13065550123. */
export const DEMO_NUMBER = process.env.NEXT_PUBLIC_DEMO_NUMBER ?? "";
/** Booking page for the 20-minute call (Google Calendar appointment schedule, Cal.com, ...). */
export const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL ?? "";
/** Turnstile site key (public). The intake form is hidden without it. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/** The fixed acknowledgment shown after the form is sent. Nothing else goes out without review. */
export const INTAKE_ACK = "Got it. Illia will reply by email within one business day.";

/** +13065550123 → (306) 555-0123 */
export const formatPhone = (e164: string) => {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
};
