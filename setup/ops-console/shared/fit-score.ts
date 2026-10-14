/**
 * Fit score: the ONE place to tune it. Every rule is visible, and the UI shows the breakdown
 * on hover, so the number is never a black box. Edit points or add rules here; the API and
 * the UI both import this file.
 *
 * A rule only scores when its input was actually measured. An unmeasured signal (no snapshot
 * yet, no review counts entered) adds nothing rather than guessing.
 */
export type FitInput = {
  segment: string;
  source: string;
  lead_id?: number | null;
  snapshot?: {
    tel_link: number | null;
    phone_above_fold_mobile: number | null;
    lh_mobile_perf: number | null;
    form: number | null;
    https: number | null;
    review_count: number | null;
    competitor_review_count: number | null;
  } | null;
};

export type FitRule = { id: string; label: string; points: number; test: (c: FitInput) => boolean };

export const FIT_RULES: FitRule[] = [
  { id: "inbound", label: "Inbound lead (they came to us)", points: 3, test: (c) => c.source === "inbound" || !!c.lead_id },
  { id: "no_tel", label: "Phone isn't a tap-to-call link", points: 3, test: (c) => c.snapshot?.tel_link === 0 },
  { id: "phone_below_fold", label: "No phone in the first mobile screen", points: 2, test: (c) => c.snapshot?.phone_above_fold_mobile === 0 },
  { id: "slow_mobile", label: "Mobile performance under 50 (Lighthouse)", points: 2, test: (c) => c.snapshot?.lh_mobile_perf != null && c.snapshot.lh_mobile_perf < 50 },
  {
    id: "review_gap", label: "Top competitor has 50+ more reviews", points: 2,
    test: (c) => c.snapshot?.review_count != null && c.snapshot.competitor_review_count != null &&
      c.snapshot.competitor_review_count - c.snapshot.review_count >= 50,
  },
  { id: "commercial", label: "Commercial or mixed work", points: 1, test: (c) => c.segment === "commercial" || c.segment === "mixed" },
  { id: "no_form", label: "No contact form", points: 1, test: (c) => c.snapshot?.form === 0 },
  { id: "no_https", label: "No HTTPS", points: 1, test: (c) => c.snapshot?.https === 0 },
];

export type FitResult = { score: number; parts: { id: string; label: string; points: number }[]; override: number | null };

export function fitScore(c: FitInput, override: number | null = null): FitResult {
  const parts = FIT_RULES.filter((r) => r.test(c)).map(({ id, label, points }) => ({ id, label, points }));
  const computed = parts.reduce((t, p) => t + p.points, 0);
  return { score: override ?? computed, parts, override };
}

export const FIT_MAX = FIT_RULES.reduce((t, r) => t + r.points, 0);
