import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { EMAIL, MAILTO } from "@/lib/site";

/*
 * DRAFT for the operator's review (written 2026-10-14). Plain-language terms of use for this
 * website only; not legal advice and not a client contract (client work runs on the MSA/SOW).
 * Have a lawyer read it before relying on it.
 */
export const metadata: Metadata = {
  title: "Terms · Arkosa",
  description: "The terms for using this website, the missed-call calculator and the demo phone line.",
  alternates: { canonical: "/terms/" },
};

const H = "mt-10 text-title font-semibold tracking-[-0.01em]";

export default function Terms() {
  return (
    <>
      <Header />
      <main id="main" className="gutter mx-auto max-w-page pb-[clamp(56px,9vw,112px)]">
        <h1 className="mt-6 text-h2 font-semibold tracking-tight">Terms</h1>
        <p className="mt-3 text-muted">Last updated October 14, 2026.</p>
        <div className="mt-8 max-w-[40rem] text-pretty">
          <h2 className={H}>What these terms cover</h2>
          <p className="mt-3">
            These terms cover your use of thearkosa.com, the missed-call calculator and the demo phone line. Work we do for a client is covered by that
            client&rsquo;s own agreement with us, not by this page.
          </p>

          <h2 className={H}>The calculator and its numbers</h2>
          <p className="mt-3">
            The missed-call calculator shows an estimate from the numbers you type in. It is not a quote, a promise of results, or financial advice.
          </p>

          <h2 className={H}>The demo phone line</h2>
          <p className="mt-3">
            The demo line shows how a missed-call text-back works, using a fictional business. Calling it is optional. It sends at most one demo text and
            one automatic reply, and it stops when you reply STOP. How we handle your number is set out in our <a href="/privacy/" className="font-semibold underline underline-offset-4">privacy policy</a>.
          </p>

          <h2 className={H}>Using this site</h2>
          <p className="mt-3">
            Please don&rsquo;t try to break into the site, overload the form or the demo line, or send anything through them that isn&rsquo;t a genuine
            enquiry. We limit how often the form and the demo line can be used, and we may block abuse.
          </p>

          <h2 className={H}>No warranty</h2>
          <p className="mt-3">
            We keep the site accurate and working, but it is provided as is. To the extent the law allows, we are not responsible for losses from using it
            or from relying on what it says.
          </p>

          <h2 className={H}>Our content</h2>
          <p className="mt-3">The text, design and code of this site belong to Arkosa. Please ask before reusing them.</p>

          <h2 className={H}>Law</h2>
          <p className="mt-3">These terms are governed by the laws of Saskatchewan and the federal laws of Canada that apply there.</p>

          <h2 className={H}>Changes and contact</h2>
          <p className="mt-3">
            If these terms change, the date at the top changes too. Questions: <a href={MAILTO} className="font-semibold underline underline-offset-4">{EMAIL}</a>.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
