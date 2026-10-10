import { site, isMock } from "@/lib/content";

/** Mocks and the fictional fixture say what they are on every page. */
export function PreviewBanner() {
  if (!isMock && !site.fixture) return null;
  return (
    <div role="note" className="gutter bg-ink py-2.5 text-center text-sm font-semibold text-bg">
      {isMock
        ? `Concept preview for ${site.business.name}, prepared by Arkosa. Not a live site; the form is not connected.`
        : "Sample content: a fictional business used to test this template."}
    </div>
  );
}
