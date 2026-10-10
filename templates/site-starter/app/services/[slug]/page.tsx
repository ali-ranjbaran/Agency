import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { site } from "@/lib/content";
import { PrimaryCta } from "@/components/PrimaryCta";
import { PhoneLink } from "@/components/PhoneLink";

export const dynamicParams = false;
export function generateStaticParams() {
  return site.services.map((s) => ({ slug: s.slug }));
}

type Props = { params: Promise<{ slug: string }> };
const find = (slug: string) => site.services.find((s) => s.slug === slug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = find((await params).slug);
  return s ? { title: `${s.name} in ${site.area.primary}`, description: s.summary, alternates: { canonical: `/services/${s.slug}/` } } : {};
}

export default async function ServicePage({ params }: Props) {
  const s = find((await params).slug);
  if (!s) notFound();
  const others = site.services.filter((o) => o.slug !== s.slug);
  return (
    <main id="main" className="gutter mx-auto max-w-page pb-20 pt-6 sm:pt-12">
      <nav aria-label="Breadcrumb" className="text-sm text-muted"><a href="/#services" className="link">Services</a> / {s.name}</nav>
      <h1 className="mt-4 max-w-[20ch] text-display font-extrabold">{s.name} in {site.area.primary}</h1>
      <p className="mt-5 max-w-[42rem] text-lead">{s.summary}</p>

      <div className="mt-12 grid gap-10 sm:grid-cols-2">
        <section aria-labelledby="when-h">
          <h2 id="when-h" className="text-title font-bold">When you need it</h2>
          <p className="mt-3 text-muted">{s.whenNeeded}</p>
        </section>
        <section aria-labelledby="diff-h">
          <h2 id="diff-h" className="text-title font-bold">How we do it</h2>
          <p className="mt-3 text-muted">{s.differentiator}</p>
        </section>
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-8">
        <PrimaryCta />
        {site.conversion.action !== "call" && <p>or call <PhoneLink /></p>}
      </div>

      {others.length > 0 && (
        <section aria-labelledby="more-h" className="mt-16">
          <h2 id="more-h" className="text-title font-bold">Other services</h2>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {others.map((o) => <li key={o.slug}><a href={`/services/${o.slug}/`} className="link">{o.name}</a></li>)}
          </ul>
        </section>
      )}
    </main>
  );
}
