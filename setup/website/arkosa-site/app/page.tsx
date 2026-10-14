import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MapleLeaf } from "@/components/MapleLeaf";
import { HeroStrata, NameStrata } from "@/components/Strata";
import { ScrollReveal } from "@/components/ScrollReveal";
import { TURNSTILE_SITE_KEY } from "@/lib/site";
import { StartOptions } from "@/components/StartOptions";
import { MissedCallCalculator } from "@/components/MissedCallCalculator";
import { IntakeForm } from "@/components/IntakeForm";

const d = (ms: number) => ({ ["--d" as string]: `${ms}ms` });

const SERVICES = [
  { title: "Websites", body: "Clear, fast sites built to turn a visit into a phone call." },
  { title: "CRM setup", body: "Every lead, job and customer in one place, set up around how you already work." },
  { title: "Follow-up automation", body: "Missed-call text-back, review requests and messages to past customers, so no call goes unanswered." },
];

export default function Home() {
  return (
    <>
      <a href="#main" className="absolute left-4 -top-20 z-10 bg-fg px-4 py-2.5 font-semibold text-bg no-underline focus:top-4">
        Skip to content
      </a>
      <Header />

      <main id="main">
        {/* Hero */}
        <section aria-labelledby="hero-h" className="gutter mx-auto max-w-page pt-[clamp(48px,10vw,128px)] pb-[clamp(48px,8vw,96px)]">
          <p className="label mb-6 flex items-center gap-2.5 text-accent-ink">
            <MapleLeaf className="size-5 fill-leaf" />
            Proudly Canadian
          </p>
          <h1 id="hero-h" className="max-w-[16ch] text-display font-semibold tracking-tight text-balance">
            Websites, CRM and follow-up for trades businesses on the prairies.
          </h1>
          <p className="mt-[clamp(20px,3vw,32px)] max-w-[38rem] text-lead text-muted text-pretty">
            We build your website, set up your CRM and automate the follow-up, so more of your calls turn into booked jobs.
          </p>
          <div className="mt-[clamp(28px,4vw,40px)] flex">
            <a href="#start" className="btn">
              Get started
              <span aria-hidden="true" className="flex flex-col gap-[3px]">
                <span className="ml-1 block h-0.5 w-2 bg-current" />
                <span className="block h-0.5 w-3 bg-current" />
              </span>
            </a>
          </div>
        </section>

        <div className="gutter mx-auto max-w-page"><HeroStrata /></div>

        {/* What we do */}
        <section id="services" aria-labelledby="what-h" className="gutter section-y mx-auto max-w-page">
          <h2 data-reveal id="what-h" className="label mb-[clamp(32px,5vw,56px)] text-accent-ink">What we do</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))] gap-[clamp(36px,5vw,56px)]">
            {SERVICES.map((s, i) => (
              <div key={s.title} data-reveal style={d(i * 120)} className="border-t-2 border-fg pt-6">
                <h3 className="text-title font-semibold tracking-[-0.01em]">{s.title}</h3>
                <p className="mt-3 text-muted text-pretty">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Get started: four ways in */}
        <section id="start" aria-labelledby="start-h" className="gutter section-y mx-auto max-w-page border-t border-line">
          <p data-reveal className="label mb-5 text-accent-ink">Get started</p>
          <h2 data-reveal style={d(80)} id="start-h" className="mb-[clamp(32px,5vw,56px)] max-w-[22ch] text-h2 font-semibold tracking-tight text-balance">
            Pick whichever suits you. None of them commit you to anything.
          </h2>
          <StartOptions />
        </section>

        <section id="calculator" aria-labelledby="calc-h" className="gutter section-y mx-auto max-w-page border-t border-line">
          <p data-reveal className="label mb-5 text-accent-ink">Count it</p>
          <h2 data-reveal style={d(80)} id="calc-h" className="mb-[clamp(32px,5vw,56px)] max-w-[22ch] text-h2 font-semibold tracking-tight text-balance">
            What missed calls cost you each month
          </h2>
          <MissedCallCalculator canSend={Boolean(TURNSTILE_SITE_KEY)} />
        </section>

        {TURNSTILE_SITE_KEY && (
          <section id="intake" aria-labelledby="intake-h" className="gutter section-y mx-auto max-w-page border-t border-line">
            <div className="grid gap-[clamp(32px,5vw,64px)] md:grid-cols-[1fr_2fr]">
              <div>
                <p className="label mb-5 text-accent-ink">Write to us</p>
                <h2 id="intake-h" className="text-h2 font-semibold tracking-tight text-balance">Send your details</h2>
                <p className="mt-5 text-muted text-pretty">A person reads every one. You get an email back within one business day.</p>
              </div>
              <IntakeForm />
            </div>
          </section>
        )}

        {/* Who it's for */}
        <section id="who" aria-labelledby="who-h" className="bg-band text-band-fg">
          <div className="gutter section-y mx-auto flex max-w-page flex-wrap items-baseline gap-x-[clamp(32px,5vw,64px)] gap-y-6">
            <h2 data-reveal id="who-h" className="label flex-[1_1_180px] text-band-label">Who it’s for</h2>
            <div data-reveal style={d(120)} className="min-w-0 flex-[3_1_min(100%,420px)]">
              <p className="max-w-[30ch] text-statement font-semibold tracking-[-0.015em] text-balance">
                HVAC, plumbing, electrical and other trades across Saskatchewan, Alberta and Manitoba.
              </p>
              <p className="mt-5 flex items-center gap-2.5 text-band-muted">
                <MapleLeaf className="size-[18px] flex-none fill-band-label" />
                Based in Canada.
              </p>
            </div>
          </div>
        </section>

        {/* The name */}
        <section id="about" aria-labelledby="name-h" className="gutter section-y mx-auto grid max-w-page grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-center gap-[clamp(36px,6vw,80px)]">
          <NameStrata />
          <div>
            <p data-reveal className="label mb-5 text-accent-ink">The name</p>
            <h2 data-reveal style={d(100)} id="name-h" className="text-h2 font-semibold tracking-tight">Built in layers.</h2>
            <p data-reveal style={d(200)} className="mt-5 max-w-[34rem] text-muted text-pretty">
              Arkose is a sandstone made of grains pressed together, layer on layer, until they hold as solid rock. We build the same way: one sound layer at a time, made to last.
            </p>
          </div>
        </section>
      </main>

      <Footer />

      <ScrollReveal />
    </>
  );
}
