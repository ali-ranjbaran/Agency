import { site, GA4_ID } from "@/lib/content";
import { PhoneLink } from "./PhoneLink";
import { CookieSettingsLink } from "./Analytics";

export function Footer() {
  const b = site.business;
  return (
    <footer className="border-t border-line">
      <div className="gutter mx-auto grid max-w-page gap-8 py-12 sm:grid-cols-3">
        <div>
          <p className="font-extrabold">{b.name}</p>
          <p className="mt-2"><PhoneLink /></p>
          {b.email && <p className="mt-1"><a href={`mailto:${b.email}`} className="link">{b.email}</a></p>}
          {b.hours && <p className="mt-2 text-sm text-muted">{b.hours}</p>}
        </div>
        <div>
          <p className="font-bold">Service area</p>
          <p className="mt-2 text-sm text-muted">{site.area.cities.join(", ")}</p>
          {b.address && (
            <address className="mt-2 text-sm not-italic text-muted">
              {[b.address.street, b.address.city, b.address.province, b.address.postal].filter(Boolean).join(", ")}
            </address>
          )}
        </div>
        <div className="text-sm">
          {b.licenseNumber && <p className="text-muted">Licence {b.licenseNumber}</p>}
          <p className="mt-2"><a href="/privacy/" className="link">Privacy</a></p>
          {GA4_ID && <p className="mt-2"><CookieSettingsLink /></p>}
          <p className="mt-4 text-muted">© {new Date().getFullYear()} {b.name}</p>
        </div>
      </div>
    </footer>
  );
}
