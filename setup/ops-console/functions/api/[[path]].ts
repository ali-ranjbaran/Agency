/** Anything under /api/ that no route handles gets JSON, never the app shell. */
import { json } from "../../server/http";

export const onRequest: PagesFunction = async ({ request }) => json(request.method === "GET" ? 404 : 405, { error: "no such API route or method" });
