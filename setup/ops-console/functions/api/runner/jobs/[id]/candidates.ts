/** POST { candidates: CandidateIn[] } (runner only, max 25 per call): store new candidates.
 *  Each one is re-classified here; suppressed / known / rejected ones are counted, not stored. */
import type { Env, Who } from "../../../../../server/env";
import { bad, json, readJson } from "../../../../../server/http";
import { addCandidate, type CandidateIn } from "../../../../../server/leadgen";

export const onRequestPost: PagesFunction<Env, "id", { who: Who }> = async ({ request, env, data, params }) => {
  if (data.who.kind !== "runner") return bad("forbidden", 403);
  const t = data.who.tenant;
  const job = await env.DB.prepare("SELECT id, trade, city FROM search_jobs WHERE id = ?1 AND tenant = ?2 AND status = 'running'")
    .bind(Number.parseInt(String(params.id), 10), t).first<{ id: number; trade: string; city: string }>();
  if (!job) return bad("job not running", 409);
  const b = await readJson<{ candidates?: CandidateIn[] }>(request);
  if (!Array.isArray(b?.candidates) || b.candidates.length > 25) return bad("send { candidates: [...] } (max 25)");
  const created: { id: number; domain: string | null }[] = [];
  const counts = { new_candidates: 0, suppressed_dropped: 0, known: 0, rejected_skipped: 0 };
  for (const c of b.candidates) {
    const r = await addCandidate(env, t, job, c);
    if (r.verdict === "new") { counts.new_candidates++; created.push({ id: r.id!, domain: r.domain }); }
    else if (r.verdict === "suppressed") counts.suppressed_dropped++;
    else if (r.verdict === "known") counts.known++;
    else counts.rejected_skipped++;
  }
  return json(200, { created, counts });
};
