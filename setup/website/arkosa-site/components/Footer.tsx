import { Mark } from "./Logo";
import { MapleLeaf } from "./MapleLeaf";
import { EMAIL, MAILTO } from "@/lib/site";

export function Footer() {
  return (
    <footer id="contact" className="border-t border-line">
      <div className="gutter mx-auto flex max-w-page flex-wrap items-center justify-between gap-x-8 gap-y-4 pt-8 pb-10 text-sm text-muted">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Mark className="size-[18px]" />
          <span>© 2026 Arkosa · Canada</span>
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-2"><MapleLeaf className="size-3.5 fill-leaf" />Proudly Canadian</span>
          <span aria-hidden="true">·</span>
          <a href="/privacy/" className="underline decoration-1 underline-offset-[5px] hover:decoration-accent">Privacy</a>
        </div>
        <a href={MAILTO} className="font-semibold text-fg underline decoration-1 underline-offset-[5px] hover:decoration-accent">{EMAIL}</a>
      </div>
    </footer>
  );
}
