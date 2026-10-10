import type { Metadata } from "next";
import { site } from "@/lib/content";
import { PrimaryCta } from "@/components/PrimaryCta";

export const metadata: Metadata = { title: "About", alternates: { canonical: "/about/" } };

export default function About() {
  const b = site.business;
  const facts = [
    b.yearsInBusiness && `${b.yearsInBusiness} years in business`,
    b.licenseNumber && `Licence ${b.licenseNumber}`,
    ...site.proof.badges,
  ].filter(Boolean) as string[];
  return (
    <main id="main" className="gutter mx-auto max-w-page pb-20 pt-6 sm:pt-12">
      <h1 className="text-display font-extrabold">About {b.name}</h1>
      <div className="mt-8 max-w-[42rem] space-y-4 text-lead">
        {(site.about?.body ?? []).map((p, i) => <p key={i}>{p}</p>)}
      </div>
      {facts.length > 0 && (
        <ul className="mt-10 flex flex-wrap gap-3">
          {facts.map((f) => <li key={f} className="rounded bg-tint px-4 py-2 text-sm font-semibold">{f}</li>)}
        </ul>
      )}
      <div className="mt-12"><PrimaryCta /></div>
    </main>
  );
}
