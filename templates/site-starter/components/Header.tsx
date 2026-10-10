"use client";
import { useState } from "react";
import { site, NAV, PHONE, formatPhone } from "@/lib/content";
import { PrimaryCta } from "./PrimaryCta";

export function Header() {
  const [open, setOpen] = useState(false);
  const callIsPrimary = site.conversion.action === "call";
  return (
    <>
      <header className="gutter mx-auto flex max-w-page items-center justify-between gap-4 py-4 sm:py-6">
        <a href="/" className="flex items-center gap-3 text-lg font-extrabold leading-tight no-underline">
          {site.brand.logo
            ? <img src={site.brand.logo} alt={`${site.business.name}, home`} width={160} height={40} className="h-10 w-auto" />
            : <span>{site.business.name}<span className="sr-only">, home</span></span>}
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-7 nav:flex">
          {NAV.map((l) => <a key={l.href} href={l.href} className="link py-2 text-sm font-semibold no-underline hover:underline">{l.label}</a>)}
          {!callIsPrimary && <a href={`tel:${PHONE}`} className="text-sm font-bold">{formatPhone(PHONE)}</a>}
          <PrimaryCta small />
        </nav>
        <div className="flex shrink-0 items-center gap-2 nav:hidden">
          {/* Click-to-call is always one tap away on mobile; the hero carries the full CTA label. */}
          <a href={`tel:${PHONE}`} className={`btn btn-sm ${callIsPrimary ? "" : "btn-ghost"}`}>
            Call<span className="sr-only"> {formatPhone(PHONE)}</span>
          </a>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
            className="min-h-11 cursor-pointer rounded border border-ink px-3.5 text-sm font-semibold"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </header>
      {open && (
        <nav id="mobile-menu" aria-label="Mobile" className="gutter mx-auto max-w-page border-b border-line pb-6 nav:hidden">
          {NAV.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block border-b border-line py-3.5 text-xl font-semibold no-underline">{l.label}</a>
          ))}
          {!callIsPrimary && <div className="mt-5"><PrimaryCta /></div>}
        </nav>
      )}
    </>
  );
}
