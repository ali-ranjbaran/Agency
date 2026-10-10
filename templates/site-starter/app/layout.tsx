import type { Metadata } from "next";
import "./globals.css";
import { site, isMock, SITE_URL, PHONE, SCHEMA_TYPE, TRADE_LABEL } from "@/lib/content";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PreviewBanner } from "@/components/PreviewBanner";
import { Analytics } from "@/components/Analytics";

const b = site.business;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${b.name} · ${TRADE_LABEL[b.trade]} in ${site.area.primary}`, template: `%s · ${b.name}` },
  description: site.hero.subhead,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: b.name, locale: "en_CA", url: "/" },
  icons: { icon: [{ url: site.brand.favicon ?? "/favicon.svg", type: "image/svg+xml" }] },
  robots: isMock || site.fixture ? { index: false, follow: false } : undefined,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const br = site.brand;
  const tokens = { "--ink": br.ink, "--bg": br.bg, "--primary": br.primary, "--primary-ink": br.primaryInk, "--muted": br.muted } as React.CSSProperties;
  const ld = {
    "@context": "https://schema.org", "@type": SCHEMA_TYPE[b.trade],
    name: b.name, url: SITE_URL, telephone: PHONE, email: b.email,
    areaServed: site.area.cities,
    ...(b.address && { address: { "@type": "PostalAddress", streetAddress: b.address.street, addressLocality: b.address.city, addressRegion: b.address.province, postalCode: b.address.postal, addressCountry: "CA" } }),
  };
  return (
    <html lang="en-CA" style={tokens}>
      <head>
        {!isMock && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />}
      </head>
      <body className="bg-bg text-ink">
        <a href="#main" className="skip btn btn-sm">Skip to content</a>
        <PreviewBanner />
        <Header />
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
