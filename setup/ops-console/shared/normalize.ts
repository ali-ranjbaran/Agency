/** Canadian/US numbers only. Returns +1XXXXXXXXXX or null. */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(d) ? `+1${d}` : null;
}

/** Lowercase host without www. and without port. Accepts a URL, a bare host or an email's domain. */
export function toDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (s.includes("@") && !s.includes("/")) s = s.split("@").pop()!;
  try {
    const host = new URL(/^[a-z]+:\/\//.test(s) ? s : `https://${s}`).hostname;
    const d = host.replace(/^www\./, "");
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : null;
  } catch {
    return null;
  }
}

export const normEmail = (raw: string | null | undefined) => {
  const e = String(raw ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e) ? e : null;
};

export const emailDomain = (email: string) => email.slice(email.lastIndexOf("@") + 1).toLowerCase();
