import type { Metadata } from "next";
import { site } from "@/lib/content";
import { LeadForm } from "@/components/LeadForm";
import { PhoneLink } from "@/components/PhoneLink";
import { PrimaryCta } from "@/components/PrimaryCta";

export const metadata: Metadata = { title: "Contact", alternates: { canonical: "/contact/" } };

export default function Contact() {
  const b = site.business;
  const action = site.conversion.action;
  return (
    <main id="main" className="gutter mx-auto max-w-page pb-20 pt-6 sm:pt-12">
      <h1 className="text-display font-extrabold">Contact</h1>
      <div className="mt-10 grid gap-12 nav:grid-cols-[1fr_2fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-muted">Call</p>
          <p className="mt-2 text-title"><PhoneLink /></p>
          {b.hours && <p className="mt-2 text-muted">{b.hours}</p>}
          {b.email && <p className="mt-6"><a href={`mailto:${b.email}`} className="link">{b.email}</a></p>}
          {action === "booking" && <div className="mt-8"><PrimaryCta /></div>}
        </div>
        <section aria-labelledby="form-h">
          <h2 id="form-h" className="text-h2 font-extrabold">{action === "quote" ? site.conversion.label : "Send us a message"}</h2>
          <div className="mt-6"><LeadForm /></div>
        </section>
      </div>
    </main>
  );
}
