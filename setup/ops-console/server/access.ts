/**
 * Cloudflare Access JWT check, run on every request (static files too).
 *
 * Per Cloudflare's docs: read Cf-Access-Jwt-Assertion, fetch keys from
 * <team>/cdn-cgi/access/certs, match the token's kid, verify RS256, then check iss and aud.
 * We also check exp/nbf ourselves. Two identities pass:
 *   - an operator: `email` claim in ACCESS_EMAILS
 *   - the Mac runner: a service token, whose JWT has `common_name` = Client ID and no email;
 *     only allowed on /api/runner/*
 * Ported from skills/sales/audit-site/scripts/server.mjs (verifyAccess).
 */
import type { Env, Who } from "./env";

type Jwk = JsonWebKey & { kid?: string };
let cache: { team: string; at: number; keys: Jwk[] } = { team: "", at: 0, keys: [] };

async function keyFor(team: string, kid: string): Promise<CryptoKey | null> {
  const find = () => cache.team === team ? cache.keys.find((k) => k.kid === kid) : undefined;
  if (!find() && (cache.team !== team || Date.now() - cache.at > 60_000)) {
    const res = await fetch(`${team}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(10_000) });
    if (res.ok) cache = { team, at: Date.now(), keys: ((await res.json()) as { keys?: Jwk[] }).keys ?? [] };
  }
  const jwk = find();
  return jwk ? crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]) : null;
}

const b64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
const list = (s: string | undefined) => (s ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

export const accessConfigured = (env: Env) => !!(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD && (list(env.ACCESS_EMAILS).length || list(env.RUNNER_CLIENT_IDS).length));

/** Returns the caller, or null. Never throws. */
export async function verifyAccess(request: Request, env: Env, path: string): Promise<Who | null> {
  const team = (env.ACCESS_TEAM_DOMAIN ?? "").replace(/\/$/, "");
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!team || !env.ACCESS_AUD || !token) return null;
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(b64url(h))) as { alg?: string; kid?: string };
    if (header.alg !== "RS256" || !header.kid) return null;
    const key = await keyFor(team, header.kid);
    if (!key || !(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(s), new TextEncoder().encode(`${h}.${p}`)))) return null;
    const c = JSON.parse(new TextDecoder().decode(b64url(p))) as Record<string, unknown>;
    const now = Date.now() / 1000;
    const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
    if (c.iss !== team || !aud.includes(env.ACCESS_AUD)) return null;
    if (!(typeof c.exp === "number" && c.exp > now)) return null;
    if (typeof c.nbf === "number" && c.nbf > now + 60) return null;
    const tenant = env.TENANT || "arkosa";

    const email = typeof c.email === "string" ? c.email.toLowerCase() : "";
    if (email) return list(env.ACCESS_EMAILS).includes(email) ? { kind: "operator", email, tenant } : null;

    const cn = typeof c.common_name === "string" ? c.common_name.toLowerCase() : "";
    if (cn && list(env.RUNNER_CLIENT_IDS).includes(cn) && path.startsWith("/api/runner/")) return { kind: "runner", clientId: cn, tenant };
    return null;
  } catch {
    return null;
  }
}
