/** Serves ./fixtures (a fictional business) on 127.0.0.1 for tests. */
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = new URL("./fixtures/", import.meta.url).pathname;
const TYPES = { ".html": "text/html; charset=utf-8", ".txt": "text/plain", ".xml": "application/xml" };

export async function serveFixtures() {
  const server = http.createServer((req, res) => {
    let p = req.url.split("?")[0];
    if (p === "/" || p.endsWith("/")) p += "index.html";
    const file = join(DIR, p);
    if (!file.startsWith(DIR) || !existsSync(file)) return res.writeHead(404).end("not found");
    res.writeHead(200, { "content-type": TYPES[p.slice(p.lastIndexOf("."))] ?? "application/octet-stream" }).end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await serveFixtures();
  console.log(s.base);
}
