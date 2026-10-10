/**
 * Mock sites (SITE_MODE = "mock") are never public: every route needs the
 * MOCK_PASSWORD (any username). Fails closed: mock mode without a password
 * set serves nothing. Client sites pass straight through.
 */
import type { Env } from "../server/env";

const enc = new TextEncoder();
async function same(a: string, b: string) {
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest("SHA-256", enc.encode(s))));
  return crypto.subtle.timingSafeEqual(x, y);
}

export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
  if (env.SITE_MODE === "client") return next();
  if (!env.MOCK_PASSWORD) return new Response("Preview not configured", { status: 503 });

  const auth = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = atob(encoded);
    const pass = decoded.slice(decoded.indexOf(":") + 1);
    if (await same(pass, env.MOCK_PASSWORD)) {
      const res = await next();
      const out = new Response(res.body, res);
      out.headers.set("x-robots-tag", "noindex, nofollow");
      out.headers.set("cache-control", "private, no-store");
      return out;
    }
  }
  return new Response("Password required", {
    status: 401,
    headers: { "www-authenticate": 'Basic realm="Preview", charset="UTF-8"', "x-robots-tag": "noindex, nofollow" },
  });
};
