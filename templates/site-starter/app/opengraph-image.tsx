/**
 * The share image (og:image) for every page, generated at build from site.json: business name,
 * hero headline, area and phone on the brand colours. No photography (CLAUDE.md); a client photo
 * can replace this later only with written permission. Root file, so it applies to all routes.
 */
import { ImageResponse } from "next/og";
import { PHONE, formatPhone, site } from "@/lib/content";

export const dynamic = "force-static";
export const alt = `${site.business.name}: ${site.hero.headline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const b = site.brand;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: b.bg, color: b.ink }}>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>{site.business.name}</div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 1000 }}>{site.hero.headline}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 30 }}>
          <span style={{ color: b.muted }}>{site.area.primary}</span>
          <span style={{ background: b.primary, color: b.primaryInk, padding: "14px 28px", borderRadius: 8, fontWeight: 700 }}>{formatPhone(PHONE)}</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
