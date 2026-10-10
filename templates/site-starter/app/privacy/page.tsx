import type { Metadata } from "next";
import { site, GA4_ID, TURNSTILE_SITE_KEY, isMock } from "@/lib/content";

export const metadata: Metadata = {
  title: "Privacy",
  description: `What ${site.business.name} collects through this website and what we do with it.`,
  alternates: { canonical: "/privacy/" },
};

const H = "mt-10 text-title font-bold";

/*
 * Generated from what this build actually does: the form section appears only
 * when the form is live, the analytics section only when GA4 is configured.
 * Have the client read it before launch; it is a starting point, not legal advice.
 */
export default function Privacy() {
  const b = site.business;
  const contact = site.legal.privacyContact;
  const formLive = !isMock && Boolean(TURNSTILE_SITE_KEY);
  const callTracking = Boolean(process.env.NEXT_PUBLIC_CALL_TRACKING_NUMBER);
  return (
    <main id="main" className="gutter mx-auto max-w-page pb-20 pt-6 sm:pt-12">
      <h1 className="text-display font-extrabold">Privacy</h1>
      {site.legal.privacyUpdated && <p className="mt-3 text-muted">Last updated {site.legal.privacyUpdated}.</p>}
      <div className="mt-8 max-w-[42rem]">
        <p>This page explains what {b.name} collects through this website and what we do with it. We follow Canada&rsquo;s privacy law (PIPEDA) and the privacy rules that apply in {site.legal.province}.</p>

        <h2 className={H}>Browsing this site</h2>
        {GA4_ID ? (
          <p className="mt-3">If you say yes to the cookie question, we use Google Analytics to count visits and see which pages are useful. It sets cookies and sends technical information about your visit (pages viewed, device type, approximate location) to Google. If you say no, it never loads. You can change your answer any time with &ldquo;Cookie settings&rdquo; at the bottom of every page.</p>
        ) : (
          <p className="mt-3">This site has no analytics, no advertising and no tracking cookies.</p>
        )}

        {formLive && (
          <>
            <h2 className={H}>The contact form</h2>
            <p className="mt-3">When you send the form we receive your name and phone number, and anything else you choose to add: email, the service you need and your message. We use it only to get back to you about your request.</p>
            <p className="mt-3">Your details go straight into our customer system, which is run by a service provider whose servers may be outside Canada. We don&rsquo;t sell your information or add you to a mailing list. To keep out bots the form uses Cloudflare Turnstile, which processes technical information about your browser, and we keep a one-way scrambled version of your IP address for a short time to limit repeated sends.</p>
          </>
        )}

        {callTracking && (
          <>
            <h2 className={H}>Phone calls</h2>
            <p className="mt-3">The phone number on this site is a tracking number, so we can tell which calls came from the website. It records the time, length and the number you called from.</p>
          </>
        )}

        <h2 className={H}>Your choices</h2>
        <p className="mt-3">You can ask what information we hold about you, ask us to correct it, or ask us to delete it. Email <a href={`mailto:${contact}`} className="link">{contact}</a> and we&rsquo;ll reply within 30 days.</p>
      </div>
    </main>
  );
}
