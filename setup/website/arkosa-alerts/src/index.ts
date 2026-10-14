/**
 * arkosa-alerts: one job, email the operator. Called only by the site's ALERTS service
 * binding (no public route). Body: { subject, text }. The recipient is fixed by the
 * ALERT_TO secret, so a caller can't choose where mail goes.
 */
interface Env {
  EMAIL: SendEmail;
  ALERT_TO?: string;
  ALERT_FROM: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
    if (!env.ALERT_TO) return new Response("ALERT_TO not set", { status: 503 });
    let body: { subject?: unknown; text?: unknown };
    try {
      body = await request.json();
    } catch {
      return new Response("bad json", { status: 400 });
    }
    await env.EMAIL.send({
      to: env.ALERT_TO,
      from: env.ALERT_FROM,
      subject: String(body.subject ?? "Arkosa alert").slice(0, 150),
      text: String(body.text ?? "").slice(0, 5000),
    });
    return new Response("ok");
  },
} satisfies ExportedHandler<Env>;
