import type { Metadata } from "next";
import { site, TRADE_LABEL } from "@/lib/content";
import { PrimaryCta } from "@/components/PrimaryCta";

export const metadata: Metadata = {
  title: "Service area",
  description: `${TRADE_LABEL[site.business.trade]} in ${site.area.cities.join(", ")}.`,
  alternates: { canonical: "/service-area/" },
};

export default function ServiceArea() {
  return (
    <main id="main" className="gutter mx-auto max-w-page pb-20 pt-6 sm:pt-12">
      <h1 className="text-display font-extrabold">Where we work</h1>
      <p className="mt-5 max-w-[42rem] text-lead text-muted">
        {TRADE_LABEL[site.business.trade]} for homes and businesses in {site.area.primary} and the towns around it.
        If you're close to one of these and not sure, call and ask.
      </p>
      <ul className="mt-10 grid gap-3 sm:grid-cols-3">
        {site.area.cities.map((c) => <li key={c} className="rounded border border-line px-4 py-3 font-semibold">{c}</li>)}
      </ul>
      <div className="mt-12"><PrimaryCta /></div>
    </main>
  );
}
