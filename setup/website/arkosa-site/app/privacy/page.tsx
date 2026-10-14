import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { EMAIL, MAILTO } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy · Arkosa",
  description: "What this website collects, what the contact form and demo line do with your details, and your rights.",
  alternates: { canonical: "/privacy/" },
};

const H = "mt-10 text-title font-semibold tracking-[-0.01em]";

export default function Privacy() {
  return (
    <>
      <Header />
      <main id="main" className="gutter mx-auto max-w-page pb-[clamp(56px,9vw,112px)]">
        <h1 className="mt-6 text-h2 font-semibold tracking-tight">Privacy</h1>
        <p className="mt-3 text-muted">Last updated October 10, 2026.</p>
        <div className="mt-8 max-w-[40rem] text-pretty">
          <h2 className={H}>Browsing this site</h2>
          <p className="mt-3">This site has no analytics, no advertising and no tracking pixels. The missed-call calculator runs in your browser; the numbers you type stay there unless you choose to send them with the form.</p>

          <h2 className={H}>The contact form</h2>
          <p className="mt-3">
            When you send the form we receive your name, business name, email, and anything else you choose to fill in: phone, trade, city, your message and your calculator numbers. We use it to reply to you and to prepare for a call, which includes reading your business&rsquo;s public website, Google listing and reviews.
          </p>
          <p className="mt-3">
            We will reply by email or call you. We will not text you, and we will not add you to a mailing list.
          </p>
          <p className="mt-3">
            We use software, including Anthropic&rsquo;s Claude, to help research your business and draft our reply. A person reads and approves every reply before it goes out.
          </p>
          <p className="mt-3">
            The form is stored with Cloudflare, our hosting provider, whose servers may be outside Canada. To keep out bots, the form uses Cloudflare Turnstile, which processes technical information about your browser. We also keep a one-way scrambled version of your IP address to limit repeated sends; it cannot be turned back into the address.
          </p>

          <h2 className={H}>The demo phone line</h2>
          <p className="mt-3">
            If you call our demo line, we receive your phone number from our phone provider, Twilio. We use it to send you one demo text, and we keep a record of it so we never text you more than once a day and so we honour STOP. Reply STOP at any time and you will get no further texts from that line. Calls to the demo line are not answered or recorded.
          </p>

          <h2 className={H}>If you email us</h2>
          <p className="mt-3">
            When you write to <a href={MAILTO} className="font-semibold underline underline-offset-4">{EMAIL}</a>, we receive your email address and whatever you send. We use it to reply and to do business with you.
          </p>

          <h2 className={H}>Sharing and keeping</h2>
          <p className="mt-3">We do not sell or share your information, other than with the providers named above that carry or store it for us. If we don&rsquo;t end up working together, we delete your form details within 12 months.</p>

          <h2 className={H}>Hosting</h2>
          <p className="mt-3">Our hosting provider may keep standard server logs, such as IP address and pages requested, for security and reliability.</p>

          <h2 className={H}>Your rights</h2>
          <p className="mt-3">Under Canada&rsquo;s privacy law (PIPEDA) you can ask to see, correct or delete the personal information we hold about you. Email us and we will respond.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
