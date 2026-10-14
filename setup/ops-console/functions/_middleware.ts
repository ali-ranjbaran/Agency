/**
 * Gate for the whole console, static files included (root middleware runs in front of
 * everything, per the Pages docs). Cloudflare Access sits in front too; this is the
 * second check, so a request that reaches the pages.dev URL directly still needs a valid
 * Access JWT. Fails closed: with Access unconfigured nothing is served.
 *
 * Writes from the browser must also be same-origin JSON, which blocks cross-site forms.
 */
import { accessConfigured, verifyAccess } from "../server/access";
import type { Env, Who } from "../server/env";
import { SECURITY_HEADERS, json } from "../server/http";

export const onRequest: PagesFunction<Env, string, { who: Who }> = async (ctx) => {
  const { request, env } = ctx;
  const url = new URL(request.url);
  if (!accessConfigured(env)) return json(503, { error: "Access is not configured" });

  const who = await verifyAccess(request, env, url.pathname);
  if (!who) return json(403, { error: "forbidden" });

  if (!["GET", "HEAD"].includes(request.method) && who.kind === "operator") {
    const origin = request.headers.get("origin");
    const type = request.headers.get("content-type") ?? "";
    if (origin !== url.origin || !type.startsWith("application/json")) return json(403, { error: "forbidden" });
  }

  ctx.data.who = who;
  const res = await ctx.next();
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  if ((out.headers.get("content-type") ?? "").includes("text/html")) {
    out.headers.set("content-security-policy",
      "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  }
  return out;
};
