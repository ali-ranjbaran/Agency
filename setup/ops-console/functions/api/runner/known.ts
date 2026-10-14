/** POST { firms: FirmKeys[] } (runner only): which firms are suppressed, known or rejected,
 *  so the runner doesn't visit sites it doesn't need to. The candidates route re-checks anyway. */
import type { Env, Who } from "../../../server/env";
import { bad, json, readJson } from "../../../server/http";
import { classify, type FirmKeys } from "../../../server/leadgen";

export const onRequestPost: PagesFunction<Env, string, { who: Who }> = async ({ request, env, data }) => {
  if (data.who.kind !== "runner") return bad("forbidden", 403);
  const b = await readJson<{ firms?: FirmKeys[] }>(request);
  if (!Array.isArray(b?.firms) || b.firms.length > 300) return bad("send { firms: [...] } (max 300)");
  const verdicts = [];
  for (const f of b.firms) verdicts.push(await classify(env, data.who.tenant, f));
  return json(200, { verdicts });
};
