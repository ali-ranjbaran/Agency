/**
 * Twilio helpers that run on Cloudflare (no Node SDK).
 *
 * Signature check, per Twilio's webhook security scheme: take the full request
 * URL exactly as Twilio called it, append every POST param as key+value with
 * keys sorted, HMAC-SHA1 with the auth token, base64, compare to
 * X-Twilio-Signature. Twilio's docs recommend their SDK; it doesn't run here,
 * so this is the same algorithm, covered by server/twilio.test.mjs.
 */

export async function twilioSignature(authToken: string, url: string, params: Record<string, string>) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Parses the form body and verifies the signature. Returns params, or null if the request isn't from Twilio. */
export async function readVerifiedTwilioForm(request: Request, authToken: string | undefined) {
  if (!authToken) return null;
  const header = request.headers.get("x-twilio-signature");
  if (!header) return null;
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;
  const expected = await twilioSignature(authToken, request.url, params);
  return safeEqual(expected, header) ? params : null;
}

/** +1 and ten digits: Canada and the US only. Everything else is refused, which also blocks toll fraud. */
export const isNanp = (phone: string | undefined): phone is string => !!phone && /^\+1[2-9]\d{2}[2-9]\d{6}$/.test(phone);

/** 5 s cap so a slow Twilio API can't push the text-back past the 10 s promise. */
export async function sendSms(
  env: { TWILIO_ACCOUNT_SID?: string; TWILIO_AUTH_TOKEN?: string; TWILIO_DEMO_NUMBER?: string; TWILIO_API_BASE?: string },
  to: string,
  body: string,
): Promise<{ ok: boolean; status: number }> {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_DEMO_NUMBER: from } = env;
  if (!sid || !token || !from) return { ok: false, status: 0 };
  // TWILIO_API_BASE exists only so the local test can point at a mock. Production leaves it unset.
  const base = env.TWILIO_API_BASE || "https://api.twilio.com";
  try {
    const res = await fetch(`${base}/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: "Basic " + btoa(`${sid}:${token}`),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
      signal: AbortSignal.timeout(5000),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

// Twilio's default long-code keywords (docs: Advanced Opt-Out). ARRET is our addition for
// French speakers; recording an extra opt-out only ever means fewer texts.
const STOP = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT", "ARRET", "ARRÊT"]);
const START = new Set(["START", "UNSTOP"]);
/** Twilio's OptOutType (STOP | START | HELP) wins when present; otherwise our keyword match. */
export const keyword = (body: string | undefined, optOutType?: string) => {
  const t = (optOutType ?? "").toUpperCase();
  if (t === "STOP" || t === "START" || t === "HELP") return t.toLowerCase() as "stop" | "start" | "help";
  const w = (body ?? "").trim().toUpperCase();
  return STOP.has(w) ? "stop" : START.has(w) ? "start" : w === "HELP" || w === "INFO" ? "help" : null;
};
