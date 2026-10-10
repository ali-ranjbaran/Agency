"use client";
import { useEffect, useId, useRef, useState } from "react";
import { site, isMock, TURNSTILE_SITE_KEY, PHONE, formatPhone } from "@/lib/content";

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
};
declare global { interface Window { turnstile?: Turnstile; onSiteTurnstile?: () => void } }

const TS_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onSiteTurnstile";
const CALL = `call ${formatPhone(PHONE)}`;

const ERRORS: Record<string, string> = {
  captcha: "The bot check didn't go through. Try it again.",
  phone: "That phone number doesn't look right.",
  email: "That email address doesn't look right.",
  missing: "Your name and phone number are needed.",
  rate_limited: `Too many sends from here. Please ${CALL} instead.`,
  crm: `Your message didn't go through on our end. Please ${CALL}.`,
};

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

export function LeadForm() {
  const [token, setToken] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const status = useRef<HTMLParagraphElement>(null);
  const live = !isMock && Boolean(TURNSTILE_SITE_KEY);

  useEffect(() => {
    if (!live) return;
    const render = () => {
      if (!widget.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(widget.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (t: string) => setToken(t),
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
      });
    };
    if (window.turnstile) return render();
    window.onSiteTurnstile = render;
    if (!document.querySelector(`script[src="${TS_SRC}"]`)) {
      const s = document.createElement("script");
      s.src = TS_SRC; s.async = true; s.defer = true;
      document.head.appendChild(s);
    }
  }, [live]);

  useEffect(() => { if (state === "done" || state === "error") status.current?.focus(); }, [state]);

  // No Turnstile key on a client site: never ship a form that can't send.
  if (!isMock && !TURNSTILE_SITE_KEY) {
    return <p className="text-lead">The quickest way to reach us is to call <a href={`tel:${PHONE}`} className="link font-bold">{formatPhone(PHONE)}</a>.</p>;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!live) return;
    const f = new FormData(e.currentTarget);
    const body = {
      ...Object.fromEntries(["name", "phone", "email", "service", "message", "website"].map((k) => [k, String(f.get(k) ?? "")])),
      turnstile: token,
    };
    if (!token) { setError(ERRORS.captcha); setState("error"); return; }
    setState("sending");
    try {
      const res = await fetch("/api/lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && out.ok) { setState("done"); return; }
      setError(ERRORS[out.error ?? ""] ?? `Something went wrong on our end. Please ${CALL}.`);
    } catch {
      setError(`Couldn't reach the server. Check your connection, or ${CALL}.`);
    }
    setState("error");
    window.turnstile?.reset(widgetId.current);
    setToken("");
  }

  if (state === "done") {
    return (
      <p ref={status} tabIndex={-1} role="status" className="border-t-4 border-primary pt-5 text-title font-bold outline-none">
        Thanks, we have your message. We'll call you back{site.business.hours ? " during business hours" : " soon"}.
        If it can't wait, call <a href={`tel:${PHONE}`} className="link">{formatPhone(PHONE)}</a>.
      </p>
    );
  }

  return (
    <form id="form" onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
      <Field label="Your name">{(id) => <input id={id} name="name" required maxLength={80} autoComplete="name" className="field" />}</Field>
      <Field label="Phone">{(id) => <input id={id} name="phone" type="tel" required maxLength={30} autoComplete="tel" className="field" />}</Field>
      <Field label="What do you need?">{(id) => (
        <select id={id} name="service" defaultValue="" className="field">
          <option value="">Choose one</option>
          {site.services.map((s) => <option key={s.slug}>{s.name}</option>)}
          <option>Something else</option>
        </select>
      )}</Field>
      <Field label="Email" optional>{(id) => <input id={id} name="email" type="email" maxLength={160} autoComplete="email" className="field" />}</Field>
      <div className="sm:col-span-2">
        <Field label="Anything we should know?" optional>{(id) => <textarea id={id} name="message" rows={4} maxLength={1500} className="field" />}</Field>
      </div>

      {/* Honeypot: hidden from people and screen readers */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 sm:col-span-2">
        {live && <div ref={widget} />}
        <button type="submit" disabled={!live || state === "sending"} className="btn cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
          {state === "sending" ? "Sending…" : site.conversion.action === "quote" ? site.conversion.label : "Send"}
        </button>
        {isMock && <p className="text-sm text-muted">Preview only: this form is not connected.</p>}
      </div>
      {state === "error" && (
        <p ref={status} tabIndex={-1} role="alert" className="font-semibold text-primary outline-none sm:col-span-2">{error}</p>
      )}
      <p className="text-sm text-muted sm:col-span-2">
        We use your details only to get back to you. See <a href="/privacy/" className="link">Privacy</a>.
      </p>
    </form>
  );
}
