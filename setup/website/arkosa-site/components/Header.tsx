"use client";
import { useState } from "react";
import { Lockup } from "./Logo";
import { DEMO_NUMBER, NAV, formatPhone } from "@/lib/site";

/** Tap-to-call for the demo line, in the first screen. Renders nothing until the number is set. */
function DemoCall({ className = "" }: { className?: string }) {
  if (!DEMO_NUMBER) return null;
  return (
    <a href={`tel:${DEMO_NUMBER}`} className={`link-underline py-2 text-sm font-semibold ${className}`} aria-label={`Call the demo line, ${formatPhone(DEMO_NUMBER)}`}>
      <span className="hidden sm:inline">Demo line </span>{formatPhone(DEMO_NUMBER)}
    </a>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="gutter mx-auto flex max-w-page items-center justify-between gap-6 py-5 sm:py-8">
        <a href="/" aria-label="Arkosa, home" className="flex">
          <Lockup className="h-[26px] w-auto" />
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-8 nav:flex">
          {NAV.map((l) => (
            <a key={l.href} href={l.href} className="link-underline py-2 text-sm font-semibold">{l.label}</a>
          ))}
          <DemoCall />
          <a href="/#start" className="btn btn-sm">Get started</a>
        </nav>
        <div className="flex items-center gap-2 nav:hidden">
          <DemoCall className="mr-1" />
          <a href="/#start" className="btn btn-sm">Get started</a>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
            className="min-h-11 cursor-pointer rounded-sm border border-fg px-3.5 text-sm font-semibold"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </header>
      {open && (
        <nav id="mobile-menu" aria-label="Mobile" className="gutter mx-auto max-w-page border-b border-line pb-6 nav:hidden">
          {NAV.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block border-b border-line py-3.5 text-xl font-semibold no-underline">
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </>
  );
}
