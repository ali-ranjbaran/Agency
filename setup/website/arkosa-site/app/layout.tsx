import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { SITE_URL, EMAIL } from "@/lib/site";

const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-hanken", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Arkosa", locale: "en_CA", url: "/" },
  title: "Arkosa · Websites, CRM and follow-up for trades businesses",
  description: "Arkosa builds websites, sets up CRM systems and automates customer follow-up for HVAC, plumbing and electrical businesses. Proudly Canadian.",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // data-theme="dark" switches to the dark version.
  return (
    <html lang="en-CA" data-theme="light" className={hanken.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org", "@type": "Organization",
            name: "Arkosa", url: SITE_URL, email: EMAIL, areaServed: ["Saskatchewan", "Alberta", "Manitoba"],
          }) }}
        />
      </head>
      <body className="bg-bg text-fg">{children}</body>
    </html>
  );
}
