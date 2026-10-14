// Access JWT gate: real RS256 tokens signed by a throwaway key, served from a mocked certs URL.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { verifyAccess, accessConfigured } from "../server/access.ts";

const TEAM = "https://arkosa-test.cloudflareaccess.com";
const AUD = "aud-tag-123";
const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ACCESS_EMAILS: "operator@example.com", RUNNER_CLIENT_IDS: "runner-id.access", TENANT: "arkosa" };

const gen = () => crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const good = await gen();
const other = await gen();
const jwk = { ...(await crypto.subtle.exportKey("jwk", good.publicKey)), kid: "k1" };

let certFetches = 0;
globalThis.fetch = async (url) => {
  assert.equal(String(url), `${TEAM}/cdn-cgi/access/certs`);
  certFetches++;
  return new Response(JSON.stringify({ keys: [jwk] }), { headers: { "content-type": "application/json" } });
};

const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
async function jwt(claims, { key = good.privateKey, kid = "k1", alg = "RS256" } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const h = enc({ alg, kid, typ: "JWT" });
  const p = enc({ iss: TEAM, aud: [AUD], iat: now, exp: now + 3600, ...claims });
  const sig = Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${h}.${p}`))).toString("base64url");
  return `${h}.${p}.${sig}`;
}
const req = (token) => new Request("https://ops.thearkosa.com/api/companies", { headers: token ? { "cf-access-jwt-assertion": token } : {} });
const check = (token, path = "/api/companies", e = env) => verifyAccess(req(token), e, path);

beforeEach(() => { certFetches = 0; });

test("operator with an allowed email passes", async () => {
  assert.deepEqual(await check(await jwt({ email: "Operator@Example.com" })), { kind: "operator", email: "operator@example.com", tenant: "arkosa" });
});

test("refused: email not on the list", async () => assert.equal(await check(await jwt({ email: "someone@example.com" })), null));
test("refused: no token", async () => assert.equal(await check(null), null));
test("refused: garbage token", async () => assert.equal(await check("a.b.c"), null));
test("refused: wrong audience", async () => assert.equal(await check(await jwt({ email: "operator@example.com", aud: ["other-app"] })), null));
test("refused: wrong issuer", async () => assert.equal(await check(await jwt({ email: "operator@example.com", iss: "https://evil.cloudflareaccess.com" })), null));
test("refused: expired", async () => assert.equal(await check(await jwt({ email: "operator@example.com", exp: Math.floor(Date.now() / 1000) - 10 })), null));
test("refused: not yet valid", async () => assert.equal(await check(await jwt({ email: "operator@example.com", nbf: Math.floor(Date.now() / 1000) + 3600 })), null));
test("refused: signed by another key", async () => assert.equal(await check(await jwt({ email: "operator@example.com" }, { key: other.privateKey })), null));
test("refused: unknown kid", async () => assert.equal(await check(await jwt({ email: "operator@example.com" }, { kid: "nope" })), null));
test("refused: alg none / HS256", async () => {
  const t = await jwt({ email: "operator@example.com" });
  const [, p, s] = t.split(".");
  assert.equal(await check(`${enc({ alg: "none", kid: "k1" })}.${p}.${s}`), null);
  assert.equal(await check(`${enc({ alg: "HS256", kid: "k1" })}.${p}.${s}`), null);
});
test("refused: tampered payload", async () => {
  const t = await jwt({ email: "someone@example.com" });
  const [h, , s] = t.split(".");
  assert.equal(await check(`${h}.${enc({ iss: TEAM, aud: [AUD], exp: 9e9, email: "operator@example.com" })}.${s}`), null);
});

test("runner service token passes on /api/runner/*", async () => {
  const t = await jwt({ common_name: "runner-id.access", sub: "" });
  assert.deepEqual(await check(t, "/api/runner/targets"), { kind: "runner", clientId: "runner-id.access", tenant: "arkosa" });
});
test("refused: runner token anywhere else", async () => {
  const t = await jwt({ common_name: "runner-id.access", sub: "" });
  assert.equal(await check(t, "/api/companies"), null);
  assert.equal(await check(t, "/"), null);
});
test("refused: unknown service token", async () => assert.equal(await check(await jwt({ common_name: "other.access" }), "/api/runner/targets"), null));

test("unconfigured → accessConfigured false (middleware answers 503)", () => {
  assert.equal(accessConfigured({ ...env, ACCESS_AUD: "" }), false);
  assert.equal(accessConfigured({ ...env, ACCESS_EMAILS: "", RUNNER_CLIENT_IDS: "" }), false);
  assert.equal(accessConfigured(env), true);
});

test("certs are cached between requests", async () => {
  await check(await jwt({ email: "operator@example.com" }));
  await check(await jwt({ email: "operator@example.com" }));
  assert.ok(certFetches <= 1, `fetched certs ${certFetches} times`);
});
