"use client";
import { useEffect, useId, useRef, useState } from "react";
import { CALC_EVENT, type CalcValues } from "./MissedCallCalculator";
import { INTAKE_ACK, TURNSTILE_SITE_KEY } from "@/lib/site";

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
};
declare global { interface Window { turnstile?: Turnstile; onArkosaTurnstile?: () => void } }

const TS_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onArkosaTurnstile";

const ERRORS: Record<string, string> = {
  captcha: "The bot check didn't go through. Try it again.",
  email: "That email address doesn't look right.",
  phone: "That phone number doesn't look right.",
  missing: "Your name and business name are needed.",
  rate_limited: "Too many sends from here. Try again in an hour, or email us.",
};

const input = "mt-2 block w-full rounded-sm border border-muted bg-transparent px-3.5 py-3 focus:border-fg";

function Field({ label, optional, children }: { label: string; optional?: boolean; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="font-semibold">
        {label}{optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {children(id)}
    </div>
  );
}

export function IntakeForm() {
  const [calc, setCalc] = useState<CalcValues | null>(null);
  const [token, setToken] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const status = useRef<HTMLParagraphElement>(null);

  // Calculator → form
  useEffect(() => {
    const on = (e: Event) => setCalc((e as CustomEvent<CalcValues>).detail);
    window.addEventListener(CALC_EVENT, on);
    return () => window.removeEventListener(CALC_EVENT, on);
  }, []);

  // Turnstile, loaded only when the form comes near the viewport. Its challenge
  // scripts are heavy; loading them at page start delayed the hero's first paint.
  useEffect(() => {
    const render = () => {
      if (!widget.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(widget.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (t: string) => setToken(t),
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
      });
    };
    const load = () => {
      if (window.turnstile) return render();
      window.onArkosaTurnstile = render;
      if (!document.querySelector(`script[src="${TS_SRC}"]`)) {
        const s = document.createElement("script");
        s.src = TS_SRC; s.async = true; s.defer = true;
        document.head.appendChild(s);
      }
    };
    const el = widget.current;
    if (!el || !("IntersectionObserver" in window)) return load();
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load(); }
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => { if (state === "done" || state === "error") status.current?.focus(); }, [state]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      ...Object.fromEntries(["name", "company", "email", "phone", "trade", "city", "message", "website"].map((k) => [k, String(f.get(k) ?? "")])),
      calc: calc ?? undefined,
      turnstile: token,
    };
    if (!token) { setError(ERRORS.captcha); setState("error"); return; }
    setState("sending");
    try {
      const res = await fetch("/api/intake", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && out.ok) { setState("done"); return; }
      setError(ERRORS[out.error ?? ""] ?? "Something went wrong on our end. Email us instead.");
    } catch {
      setError("Couldn't reach the server. Check your connection, or email us.");
    }
    setState("error");
    window.turnstile?.reset(widgetId.current);
    setToken("");
  }

  if (state === "done") {
    return (
      <p ref={status} tabIndex={-1} role="status" className="border-t-2 border-fg pt-6 text-statement font-semibold tracking-[-0.015em] outline-none">
        {INTAKE_ACK}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate={false} className="grid gap-6 sm:grid-cols-2">
      <Field label="Your name">{(id) => <input id={id} name="name" required maxLength={80} autoComplete="name" className={input} />}</Field>
      <Field label="Business name">{(id) => <input id={id} name="company" required maxLength={120} autoComplete="organization" className={input} />}</Field>
      <Field label="Email">{(id) => <input id={id} name="email" type="email" required maxLength={160} autoComplete="email" className={input} />}</Field>
      <Field label="Phone" optional>{(id) => (
        <>
          <input id={id} name="phone" type="tel" maxLength={30} autoComplete="tel" aria-describedby={`${id}-h`} className={input} />
          <p id={`${id}-h`} className="mt-1.5 text-sm text-muted">We call. We never text you.</p>
        </>
      )}</Field>
      <Field label="Trade">{(id) => (
        <select id={id} name="trade" defaultValue="HVAC" className={input}>
          <option>HVAC</option><option>Plumbing</option><option>Electrical</option><option>Other</option>
        </select>
      )}</Field>
      <Field label="City" optional>{(id) => <input id={id} name="city" maxLength={60} autoComplete="address-level2" className={input} />}</Field>
      <div className="sm:col-span-2">
        <Field label="What's going on?" optional>{(id) => (
          <textarea id={id} name="message" rows={4} maxLength={1500} placeholder="e.g. Calls go to voicemail when we're on a job." className={input} />
        )}</Field>
      </div>

      {/* Honeypot: hidden from people and screen readers */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      {calc && (
        <p className="sm:col-span-2 text-sm text-muted">
          Sending your calculator numbers too: {calc.missedPerWeek} missed calls a week, {calc.bookRate}% would book, ${calc.jobValue} average job.{" "}
          <button type="button" onClick={() => setCalc(null)} className="cursor-pointer font-semibold text-fg underline underline-offset-4">Remove</button>
        </p>
      )}

      <div className="sm:col-span-2 flex flex-wrap items-center gap-x-6 gap-y-4">
        <div ref={widget} />
        <button type="submit" disabled={state === "sending"} className="btn cursor-pointer disabled:cursor-wait disabled:opacity-70">
          {state === "sending" ? "Sending…" : "Send"}
        </button>
      </div>
      {state === "error" && (
        <p ref={status} tabIndex={-1} role="alert" className="sm:col-span-2 font-semibold text-accent-ink outline-none">{error}</p>
      )}
      <p className="sm:col-span-2 text-sm text-muted">
        We use this to reply and to look up your business&rsquo;s public listing before we talk. See <a href="/privacy/" className="underline underline-offset-4">Privacy</a>.
      </p>
    </form>
  );
}
