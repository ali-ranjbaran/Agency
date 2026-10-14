export const SECURITY_HEADERS: Record<string, string> = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

export const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...SECURITY_HEADERS, ...extra } });

export const bad = (msg: string, status = 400) => json(status, { error: msg });

export async function readJson<T = Record<string, unknown>>(request: Request, max = 2_000_000): Promise<T | null> {
  if (Number(request.headers.get("content-length") ?? 0) > max) return null;
  try { return (await request.json()) as T; } catch { return null; }
}

export const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const optStr = (v: unknown, max = 500) => { const s = str(v, max); return s ? s : null; };
export const intOrNull = (v: unknown) => { const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10); return Number.isFinite(n) ? n : null; };
export const today = () => new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10); // Saskatoon, UTC−6
