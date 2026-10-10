import { site, primaryHref } from "@/lib/content";

/** The one primary conversion action. Every page uses this; nothing competes with it. */
export function PrimaryCta({ small, className = "" }: { small?: boolean; className?: string }) {
  const { href, external } = primaryHref();
  return (
    <a href={href} className={`btn ${small ? "btn-sm" : ""} ${className}`} {...(external && { target: "_blank", rel: "noopener" })}>
      {site.conversion.label}
      {external && <span className="sr-only"> (opens in a new tab)</span>}
    </a>
  );
}
