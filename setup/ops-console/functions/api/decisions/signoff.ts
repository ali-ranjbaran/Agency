/** POST { id: "D1".."D10", sha, choice: accept | reject | amend, note }. Reject and amend need a note. */
import type { Env, Who } from "../../../server/env";
import { DECISIONS } from "../../../server/docs";
import { bad, json, optStr, readJson, str } from "../../../server/http";

export const onRequestPost: PagesFunction<Env, string, { who: Who }> = async ({ request, env, data }) => {
  if (data.who.kind !== "operator") return bad("forbidden", 403);
  const body = await readJson(request);
  if (!body) return bad("JSON body expected");
  const d = DECISIONS.find((x) => x.id === str(body.id, 10));
  if (!d) return bad("not found", 404);
  if (str(body.sha, 64) !== d.sha256) return bad("this decision's text changed since you opened it; reload", 409);
  const choice = str(body.choice, 10);
  if (!["accept", "reject", "amend"].includes(choice)) return bad("bad choice");
  const note = optStr(body.note, 4000);
  if (choice !== "accept" && !note) return bad("reject and amend need a note");
  await env.DB.prepare("INSERT INTO decision_signoffs (tenant, decision_id, decision_sha, choice, note, reviewer) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
    .bind(data.who.tenant, d.id, d.sha256, choice, note, data.who.email).run();
  return json(201, { id: d.id, choice });
};
