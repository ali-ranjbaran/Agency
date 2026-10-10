import type { MetadataRoute } from "next";
import { site, isMock, SITE_URL } from "@/lib/content";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  if (isMock || site.fixture) return [];
  const paths = ["/", ...site.services.map((s) => `/services/${s.slug}/`), "/service-area/", ...(site.about?.body?.length ? ["/about/"] : []), "/contact/", "/privacy/"];
  return paths.map((p) => ({ url: `${SITE_URL}${p}` }));
}
