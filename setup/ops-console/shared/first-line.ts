/**
 * "Copy first line": drafts line 1 of a cold email from ONE verified signal, for the operator
 * to edit. Only signals the snapshot runner measured (or review counts entered by hand, labelled
 * as such) are used; nothing is guessed. Nothing is sent from the console. Voice: CLAUDE.md.
 */
export type SnapshotSignals = {
  url?: string | null; captured_at?: string | null;
  tel_link?: number | null; phone_above_fold_mobile?: number | null; lh_mobile_perf?: number | null;
  form?: number | null; https?: number | null;
  review_count?: number | null; competitor_review_count?: number | null; competitor_name?: string | null;
};

export type FirstLine = { id: string; text: string; basis: string };

export function firstLines(domain: string, s: SnapshotSignals | null | undefined): FirstLine[] {
  if (!s) return [];
  const when = s.captured_at ? s.captured_at.slice(0, 10) : "the last check";
  const where = s.url ?? `https://${domain}`;
  const measured = `measured ${when} on ${where}`;
  const out: FirstLine[] = [];
  if (s.tel_link === 0) out.push({ id: "no_tel", basis: measured,
    text: `On a phone, the number on ${domain} can't be tapped to call. A caller has to copy it out by hand.` });
  if (s.phone_above_fold_mobile === 0) out.push({ id: "phone_below_fold", basis: measured,
    text: `On a phone, the first screen of ${domain} doesn't show a phone number, so a caller has to scroll to find it.` });
  if (s.lh_mobile_perf != null && s.lh_mobile_perf < 50) out.push({ id: "slow_mobile", basis: `${measured} (Lighthouse, mobile)`,
    text: `${domain} scored ${s.lh_mobile_perf} out of 100 for mobile speed in Google's Lighthouse test.` });
  if (s.form === 0) out.push({ id: "no_form", basis: measured,
    text: `${domain} has no contact form, so someone looking at 11 pm can only call and hope.` });
  if (s.https === 0) out.push({ id: "no_https", basis: measured,
    text: `${domain} loads without HTTPS, so Chrome labels it "Not secure" next to the address.` });
  if (s.review_count != null && s.competitor_review_count != null && s.competitor_review_count - s.review_count >= 50) {
    out.push({ id: "review_gap", basis: `review counts entered by hand (${when}); check them before sending`,
      text: `${s.competitor_name || "The top competitor in your search"} shows ${s.competitor_review_count} Google reviews to your ${s.review_count}.` });
  }
  return out;
}
