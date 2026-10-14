/** GET: every bundled document with its review status, marker counts and open comments; plus D1–D10. */
import type { Env, Who } from "../../../server/env";
import { DOCS_COMMIT, decisionSummaries, docSummaries } from "../../../server/docs";
import { bad, json } from "../../../server/http";

export const onRequestGet: PagesFunction<Env, string, { who: Who }> = async ({ env, data }) => {
  if (data.who.kind !== "operator") return bad("forbidden", 403);
  const [docs, decisions] = await Promise.all([docSummaries(env, data.who.tenant), decisionSummaries(env, data.who.tenant)]);
  return json(200, { commit: DOCS_COMMIT, docs, decisions });
};
