"use client";
import { useEffect, useState } from "react";
import { GA4_ID } from "@/lib/content";

/*
 * GA4 only loads after the visitor says yes. No choice yet → banner; "No" →
 * nothing loads. Renders nothing at all when NEXT_PUBLIC_GA4_ID isn't set.
 */
const KEY = "consent-analytics";
const OPEN = "open-cookie-settings";
type Choice = "granted" | "denied" | null;

const read = (): Choice => { try { return localStorage.getItem(KEY) as Choice; } catch { return null; } };
const write = (c: Exclude<Choice, null>) => { try { localStorage.setItem(KEY, c); } catch {} };

function loadGa(id: string) {
  if (document.getElementById("ga4")) return;
  const w = window as unknown as { dataLayer: unknown[]; gtag: (...a: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() { w.dataLayer.push(arguments); };
  w.gtag("js", new Date());
  w.gtag("config", id, { anonymize_ip: true });
  const s = document.createElement("script");
  s.id = "ga4"; s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

export function Analytics() {
  const [choice, setChoice] = useState<Choice>("denied");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!GA4_ID) return;
    const c = read();
    setChoice(c);
    setShow(c === null);
    const open = () => setShow(true);
    window.addEventListener(OPEN, open);
    return () => window.removeEventListener(OPEN, open);
  }, []);

  useEffect(() => { if (GA4_ID && choice === "granted") loadGa(GA4_ID); }, [choice]);

  if (!GA4_ID || !show) return null;
  const decide = (c: "granted" | "denied") => {
    write(c); setChoice(c); setShow(false);
    if (c === "denied" && document.getElementById("ga4")) location.reload();
  };
  return (
    <div role="region" aria-label="Cookie choice" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg shadow-[0_-4px_16px_rgba(0,0,0,.08)]">
      <div className="gutter mx-auto flex max-w-page flex-wrap items-center justify-between gap-4 py-4">
        <p className="max-w-prose text-sm">
          May we use Google Analytics cookies to count visits? Nothing loads unless you say yes. <a href="/privacy/" className="link">Privacy</a>
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={() => decide("denied")} className="btn btn-sm btn-ghost cursor-pointer">No thanks</button>
          <button type="button" onClick={() => decide("granted")} className="btn btn-sm cursor-pointer">Yes, that's fine</button>
        </div>
      </div>
    </div>
  );
}

export function CookieSettingsLink() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN))} className="link cursor-pointer">
      Cookie settings
    </button>
  );
}
