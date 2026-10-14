// node --test server/*.test.mjs   (Node 22.18+ strips the .ts types itself)
// Checks the Twilio signature scheme against an independent HMAC from node:crypto, then
// the paths that must refuse: no token, no header, wrong token, tampered param, other URL.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { isNanp, keyword, readVerifiedTwilioForm, twilioSignature } from "./twilio.ts";

const TOKEN = "test-auth-token";
const URL_ = "https://thearkosa.com/api/twilio/voice";
const PARAMS = { CallSid: "CA123", From: "+13065550123", To: "+13065550199", Digits: "1 2&3" };

// Twilio's scheme, written out independently: URL + sorted key+value pairs, HMAC-SHA1, base64.
const reference = (token, url, params) =>
  createHmac("sha1", token).update(url + Object.keys(params).sort().map((k) => k + params[k]).join("")).digest("base64");

const twilioRequest = (url, params, signature) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...(signature ? { "x-twilio-signature": signature } : {}) },
    body: new URLSearchParams(params),
  });

test("signature matches an independent HMAC-SHA1", async () => {
  assert.equal(await twilioSignature(TOKEN, URL_, PARAMS), reference(TOKEN, URL_, PARAMS));
});

test("a correctly signed request is accepted", async () => {
  const p = await readVerifiedTwilioForm(twilioRequest(URL_, PARAMS, reference(TOKEN, URL_, PARAMS)), TOKEN);
  assert.deepEqual(p, PARAMS);
});

test("refused: no auth token configured", async () => {
  assert.equal(await readVerifiedTwilioForm(twilioRequest(URL_, PARAMS, reference(TOKEN, URL_, PARAMS)), undefined), null);
});

test("refused: no signature header", async () => {
  assert.equal(await readVerifiedTwilioForm(twilioRequest(URL_, PARAMS), TOKEN), null);
});

test("refused: signed with another token", async () => {
  assert.equal(await readVerifiedTwilioForm(twilioRequest(URL_, PARAMS, reference("other", URL_, PARAMS)), TOKEN), null);
});

test("refused: a param changed after signing", async () => {
  const sig = reference(TOKEN, URL_, PARAMS);
  assert.equal(await readVerifiedTwilioForm(twilioRequest(URL_, { ...PARAMS, From: "+13065550100" }, sig), TOKEN), null);
});

test("refused: signed for a different URL", async () => {
  const sig = reference(TOKEN, "https://thearkosa.com/api/twilio/sms", PARAMS);
  assert.equal(await readVerifiedTwilioForm(twilioRequest(URL_, PARAMS, sig), TOKEN), null);
});

test("keywords follow Twilio's defaults, OptOutType wins", () => {
  for (const w of ["STOP", "stop ", "Unsubscribe", "END", "QUIT", "STOPALL", "REVOKE", "OPTOUT", "CANCEL", "ARRET"]) assert.equal(keyword(w), "stop", w);
  for (const w of ["START", "unstop"]) assert.equal(keyword(w), "start", w);
  assert.equal(keyword("YES"), null, "YES does not opt back in (Twilio docs)");
  assert.equal(keyword("HELP"), "help");
  assert.equal(keyword("no heat since last night"), null);
  assert.equal(keyword("please stop by tomorrow", "STOP"), "stop");
});

test("only +1 NANP numbers", () => {
  assert.ok(isNanp("+13065550123"));
  for (const n of ["+441234567890", "13065550123", "+1306555012", "+10065550123", undefined]) assert.ok(!isNanp(n), String(n));
});
