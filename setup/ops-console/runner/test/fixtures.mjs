/**
 * Local fixture websites for fictional firms, served on 127.0.0.1. Used by the snapshot and
 * enrichment tests so no real business's site is touched while testing. Paths:
 *   /good/…     tel: link in the header, contact form, emails on /good/contact
 *   /bad/…      phone only as text far below the fold, no form, mailto on /bad/about
 *   /noscrape/… page says "no unsolicited email"
 *   robots.txt  disallows /private/ for ArkosaLeadResearch, everything for ArkosaSiteCheck under /blocked/
 */
import http from "node:http";

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;font:16px sans-serif">${body}</body></html>`;

const SITES = {
  "/good/": page("Northgate Heating & Air | Furnace repair Saskatoon", `
    <header style="padding:12px"><strong>Northgate Heating &amp; Air</strong> <a href="tel:+13065550123">306-555-0123</a></header>
    <h1>Furnace repair in Saskatoon, 24/7 emergency service</h1>
    <p>Residential furnace, boiler and air conditioning installation and repair. Licensed and insured.</p>
    <nav><a href="/good/contact">Contact us</a> <a href="/good/about">About</a> <a href="/good/services">Services</a> <a href="/good/login">Client login</a></nav>
    <form><label>Name <input name="n"></label><label>Phone <input type="tel" name="p"></label><textarea name="m"></textarea><button>Send</button></form>`),
  "/good/contact": page("Contact | Northgate Heating & Air", `
    <h1>Contact Northgate Heating &amp; Air</h1>
    <p>Call 306-555-0123 or email <a href="mailto:office@northgate.example">office@northgate.example</a>.</p>
    <p>Owner: Pat Example, Owner and Lead Technician. Email pat@northgate.example.</p>
    <p>Saskatoon, SK</p>`),
  "/good/about": page("About | Northgate", `<h1>About</h1><p>Family-owned since 2009. We serve homes and small businesses across Saskatoon.</p>`),
  "/good/services": page("Services | Northgate", `<h1>Services</h1><ul><li>Furnace repair</li><li>Furnace installation</li><li>Air conditioning</li><li>Boilers</li></ul>`),
  "/good/login": page("Login", `<form><input name="u"><input type="password" name="p"></form>`),
  "/bad/": page("Home", `
    <div style="height:2400px;background:#eee"><h1>Welcome to our website</h1><p>Quality service you can trust.</p></div>
    <footer>Prairie Furnace Example · Call us: 306-555-0124 · Commercial and industrial HVAC, rooftop units</footer>
    <a href="/bad/about">About</a>`),
  "/bad/about": page("About", `<p>Write to <a href="mailto:fictional.prairie.4f9c@gmail.com">fictional.prairie.4f9c@gmail.com</a>. Commercial HVAC service, rooftop units and refrigeration for businesses.</p>`),
  "/noscrape/": page("Example Mechanical", `<h1>Example Mechanical</h1><p>Contact: info@noscrape.example</p><a href="/noscrape/contact">Contact</a>`),
  "/noscrape/contact": page("Contact", `<p>Email info@noscrape.example. We do not accept unsolicited email or marketing offers.</p>`),
  "/new/": page("Eastside Furnace Example", `<h1>Eastside Furnace Example</h1><p>Furnace and boiler repair for homeowners in Saskatoon. Call 306-555-0130 or email <a href="mailto:service@eastside.example">service@eastside.example</a>.</p>`),
  "/private/x": page("Private", `<p>secret@hidden.example</p>`),
  "/blocked/": page("Blocked", `<p>Blocked for snapshots</p>`),
};

const ROBOTS = `User-agent: ArkosaLeadResearch\nDisallow: /private/\n\nUser-agent: ArkosaSiteCheck\nDisallow: /blocked/\n\nUser-agent: *\nAllow: /\n`;

export async function startFixtures() {
  const hits = [];
  const server = http.createServer((req, res) => {
    const path = req.url.split("?")[0];
    hits.push({ path, ua: req.headers["user-agent"], at: Date.now() });
    if (path === "/robots.txt") return res.writeHead(200, { "content-type": "text/plain" }).end(ROBOTS);
    const html = SITES[path];
    if (!html) return res.writeHead(404, { "content-type": "text/html" }).end(page("404", "not found"));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, hits, close: () => new Promise((r) => server.close(r)) };
}
