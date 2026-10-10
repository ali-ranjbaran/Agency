import { site, TRADE_LABEL } from "@/lib/content";
import { PrimaryCta } from "@/components/PrimaryCta";
import { PhoneLink } from "@/components/PhoneLink";

/* Section order follows build-site references/conversion-patterns.md. */
export default function Home() {
  const { business: b, proof } = site;
  const trust = [
    ...(b.yearsInBusiness ? [`${b.yearsInBusiness} years in business`] : []),
    ...proof.badges,
    ...(b.licenseNumber ? [`Licence ${b.licenseNumber}`] : []),
  ];
  const hasProof = proof.reviews.length > 0 || proof.stats.length > 0;

  return (
    <main id="main">
      {/* 1 · Hero */}
      <section className="gutter mx-auto max-w-page pb-12 pt-6 sm:pb-20 sm:pt-12">
        <p className="text-sm font-bold uppercase tracking-wider text-muted">{TRADE_LABEL[b.trade]} · {site.area.primary}</p>
        <h1 className="mt-3 max-w-[18ch] text-display font-extrabold">{site.hero.headline}</h1>
        <p className="mt-5 max-w-[42rem] text-lead text-muted">{site.hero.subhead}</p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <PrimaryCta />
          {site.conversion.action !== "call" && <p>or call <PhoneLink /></p>}
        </div>
      </section>

      {/* 2 · Trust bar */}
      {trust.length > 0 && (
        <section aria-label="Credentials" className="border-y border-line bg-tint">
          <ul className="gutter mx-auto flex max-w-page flex-wrap gap-x-8 gap-y-2 py-4 text-sm font-semibold">
            {trust.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </section>
      )}

      {/* 3 · Services */}
      <section id="services" aria-labelledby="services-h" className="gutter section-y mx-auto max-w-page">
        <h2 id="services-h" className="text-h2 font-extrabold">What we do</h2>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2">
          {site.services.map((s) => (
            <li key={s.slug} className="relative rounded border border-line p-6 transition-colors hover:border-ink">
              <h3 className="text-title font-bold">
                <a href={`/services/${s.slug}/`} className="no-underline after:absolute after:inset-0">{s.name}</a>
              </h3>
              <p className="mt-2 text-muted">{s.summary}</p>
              <p className="mt-3 text-sm font-semibold" aria-hidden="true">Details →</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 4 · Social proof */}
      {hasProof && (
        <section aria-labelledby="proof-h" className="bg-tint">
          <div className="gutter section-y mx-auto max-w-page">
            <h2 id="proof-h" className="text-h2 font-extrabold">What customers say</h2>
            {proof.stats.length > 0 && (
              <dl className="mt-8 grid gap-6 sm:grid-cols-3">
                {proof.stats.map((s) => (
                  <div key={s.label} className="border-t-4 border-primary pt-3">
                    <dt className="sr-only">{s.label}</dt>
                    <dd className="text-h2 font-extrabold">{s.value}</dd>
                    <dd className="text-muted">{s.label}</dd>
                  </div>
                ))}
              </dl>
            )}
            {proof.reviews.length > 0 && (
              <ul className="mt-10 grid gap-6 sm:grid-cols-2">
                {proof.reviews.map((r, i) => (
                  <li key={i}>
                    <figure className="h-full rounded bg-bg p-6">
                      <blockquote className="text-lead">&ldquo;{r.text}&rdquo;</blockquote>
                      <figcaption className="mt-4 text-sm text-muted">
                        {r.author}, {r.url ? <a href={r.url} className="link" rel="noopener" target="_blank">{r.source}<span className="sr-only"> (opens in a new tab)</span></a> : r.source}
                      </figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* 5 · The fear answer */}
      {site.fear?.answer && (
        <section aria-labelledby="fear-h" className="gutter section-y mx-auto max-w-page">
          <p className="text-sm font-bold uppercase tracking-wider text-muted">{site.fear.fear}</p>
          <h2 id="fear-h" className="mt-3 max-w-[24ch] text-h2 font-extrabold">{site.fear.answer}</h2>
          {site.fear.proof && <p className="mt-4 max-w-[42rem] text-lead text-muted">{site.fear.proof}</p>}
        </section>
      )}

      {/* 6 · Service area */}
      <section aria-labelledby="area-h" className="border-t border-line">
        <div className="gutter section-y mx-auto max-w-page">
          <h2 id="area-h" className="text-h2 font-extrabold">Where we work</h2>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-lead">
            {site.area.cities.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <p className="mt-6"><a href="/service-area/" className="link font-semibold">Service area details</a></p>
        </div>
      </section>

      {/* 7 · Final CTA: the same single action, restated */}
      <section aria-labelledby="cta-h" className="bg-ink text-bg">
        <div className="gutter section-y mx-auto max-w-page">
          <h2 id="cta-h" className="max-w-[22ch] text-h2 font-extrabold">{site.conversion.label}</h2>
          {b.hours && <p className="mt-3 max-w-[42rem] opacity-90">{b.hours}</p>}
          <div className="mt-8"><PrimaryCta className="!bg-bg !text-ink" /></div>
        </div>
      </section>
    </main>
  );
}
