import { BOOKING_URL, DEMO_NUMBER, MAILTO, TURNSTILE_SITE_KEY, formatPhone } from "@/lib/site";

type Option = { key: string; label: string; title: string; body: string; cta: string; href: string; external?: boolean };

/** Only options whose config exists are shown, so a missing number or link never becomes a dead button. */
export function startOptions(): Option[] {
  const out: Option[] = [];
  if (DEMO_NUMBER) out.push({
    key: "demo", label: "Hear it work", title: "Call our demo line",
    body: `Call ${formatPhone(DEMO_NUMBER)}. It rings busy, like a missed call. A text comes back in about 10 seconds. That is what your customers would get.`,
    cta: `Call ${formatPhone(DEMO_NUMBER)}`, href: `tel:${DEMO_NUMBER}`,
  });
  out.push({
    key: "calc", label: "Count it", title: "What missed calls cost you",
    body: "Three numbers from your week. One monthly figure for the work that went to the next company on the list.",
    cta: "Work it out", href: "#calculator",
  });
  if (BOOKING_URL) out.push({
    key: "book", label: "Talk it through", title: "Book 20 minutes",
    body: "Pick a time that suits you. Bring your call numbers and we will tell you what is worth fixing first.",
    cta: "Pick a time", href: BOOKING_URL, external: true,
  });
  out.push(TURNSTILE_SITE_KEY
    ? { key: "intake", label: "Write to us", title: "Send your details",
        body: "Tell us about your business and what is going wrong with your calls. We reply by email within one business day.",
        cta: "Fill in the form", href: "#intake" }
    : { key: "email", label: "Write to us", title: "Email us",
        body: "Tell us about your business and what is going wrong with your calls. We reply within one business day.",
        cta: "Send an email", href: MAILTO });
  return out;
}

const d = (ms: number) => ({ ["--d" as string]: `${ms}ms` });

export function StartOptions() {
  const options = startOptions();
  return (
    <ul role="list" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-[clamp(28px,4vw,40px)]">
      {options.map((o, i) => (
        <li key={o.key} data-reveal style={d(i * 100)} className="flex flex-col border-t-2 border-fg pt-6">
          <p className="label text-accent-ink">{o.label}</p>
          <h3 className="mt-2 text-title font-semibold tracking-[-0.01em]">{o.title}</h3>
          <p className="mt-3 flex-1 text-muted text-pretty">{o.body}</p>
          <a
            href={o.href}
            {...(o.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="btn btn-sm mt-6 self-start"
          >
            {o.cta}
            {o.external && <span className="sr-only"> (opens in a new tab)</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}
