/**
 * Safe fetching for site checks (shared by audit-site and qa-site).
 * Only public http(s) sites on ports 80/443 are fetched; private, loopback and link-local
 * addresses are refused at every redirect hop (the audit dashboard takes URLs from a web form).
 * Local test servers: pass { allowLocal: true } (or AUDIT_ALLOW_LOCAL=1, kept for old callers).
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 ArkosaAudit/1";
const MAX_BYTES = 3 * 1024 * 1024;

function privateIp(ip) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return privateIp(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export async function assertPublicUrl(raw, { allowLocal = process.env.AUDIT_ALLOW_LOCAL === "1" } = {}) {
  let u;
  try { u = new URL(raw); } catch { throw new Error("not a valid URL"); }
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("only http and https URLs");
  if (u.username || u.password) throw new Error("URLs with credentials are refused");
  if (u.port && !["80", "443"].includes(u.port) && !allowLocal) throw new Error("only ports 80 and 443");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (allowLocal) return u;   // local test servers only; the dashboard never sets it
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) throw new Error("not a public hostname");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((x) => privateIp(x.address))) throw new Error("resolves to a private address");
  return u;
}

/** GET with manual redirects, each hop re-checked. Returns { status, url, headers, text, hops }. */
export async function safeGet(raw, { timeout = 20_000, maxBytes = MAX_BYTES, allowLocal, userAgent = UA, method = "GET" } = {}) {
  let url = raw;
  const hops = [];
  for (let i = 0; i < 6; i++) {
    const u = await assertPublicUrl(url, allowLocal === undefined ? undefined : { allowLocal });
    const res = await fetch(u, { method, redirect: "manual", headers: { "user-agent": userAgent, accept: "text/html,*/*" }, signal: AbortSignal.timeout(timeout) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      hops.push({ from: u.href, status: res.status });
      url = new URL(res.headers.get("location"), u).href;
      await res.body?.cancel();
      continue;
    }
    const reader = res.body?.getReader();
    const chunks = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) { await reader.cancel(); break; }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
    return { status: res.status, url: u.href, headers: Object.fromEntries(res.headers), text, hops, truncated: size > maxBytes };
  }
  throw new Error("too many redirects");
}
