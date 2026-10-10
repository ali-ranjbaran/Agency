// Arkosa Ops dashboard. Plain JS, no build step, no third-party code (CSP: script-src 'self').
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const api = async (path, opts = {}) => {
  const res = await fetch(path, { ...opts, headers: { "x-arkosa-ops": "1", "content-type": "application/json", ...(opts.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
};

const GROUPS = [["conversion", "Conversion"], ["trust", "Trust"], ["speed", "Speed"], ["accessibility", "Accessibility"], ["local-seo", "Local SEO"], ["compliance", "Compliance"], ["automation", "Never miss it (signals)"]];
const RUNNING = new Set(["queued", "checks", "ai"]);
let state = { audits: [], leads: [], skills: [], limits: {} };
let poll = null;
let tab = "proposals";
let filter = new Set(["fail", "warn", "unverified"]);

// ---- markdown (escaped first; links http(s) only) ---------------------------------------
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
}
function md(src) {
  const lines = String(src ?? "").replace(/\r/g, "").split("\n");
  let out = "", i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*$/.test(l)) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { const n = Math.min(m[1].length + 1, 4); out += `<h${n}>${inline(m[2])}</h${n}>`; i++; continue; }
    if (/^\|/.test(l)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const body = rows.filter((r) => !/^\|[\s:|-]+\|?$/.test(r));
      const [h, ...rest] = body;
      out += `<div class="tablewrap"><table><thead><tr>${cells(h).map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rest.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ""));
      out += `<${ordered ? "ol" : "ul"}>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`;
      continue;
    }
    const para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,4}\s|\||\s*([-*]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]);
    out += `<p>${inline(para.join(" "))}</p>`;
  }
  return out;
}

// ---- sidebar -----------------------------------------------------------------------------
async function loadState() {
  state = await api("/api/state");
  $("#who").textContent = state.who === "local" ? "This Mac" : state.who;
  const left = Math.max(0, state.limits.perDay - state.limits.usedToday);
  $("#cap").textContent = `${left} of ${state.limits.perDay} audits left today${state.limits.queued ? ` · ${state.limits.queued} queued` : ""}`;
  const sel = $("#lead"), cur = sel.value;
  sel.innerHTML = `<option value="">New folder in audits/</option>` + state.leads.map((l) => `<option value="${esc(l.id)}">Lead: ${esc(l.company)}${l.city ? ` · ${esc(l.city)}` : ""}</option>`).join("");
  sel.value = cur;
  const active = currentId();
  $("#audits").innerHTML = state.audits.length ? state.audits.map((a) => {
    const host = (() => { try { return new URL(a.finalUrl || a.url).hostname.replace(/^www\./, ""); } catch { return a.url; } })();
    const sc = RUNNING.has(a.state) ? "…" : a.state === "error" && a.score == null ? "!" : a.score ?? "–";
    return `<li><button type="button" data-id="${esc(a.id)}" aria-current="${a.id === active}">
      <span class="co">${esc(a.company || host)}</span><span class="sc">${esc(sc)}</span>
      <span class="sub">${esc(host)} · ${esc(new Date(a.createdAt).toLocaleDateString("en-CA"))}${a.lead ? " · lead" : ""}${RUNNING.has(a.state) ? " · running" : a.state === "error" ? " · error" : ""}</span></button></li>`;
  }).join("") : `<li class="hint">No audits yet.</li>`;
}
$("#audits").addEventListener("click", (e) => { const b = e.target.closest("button[data-id]"); if (b) location.hash = `#/audit/${encodeURIComponent(b.dataset.id)}`; });
$("#skillsBtn").addEventListener("click", () => { location.hash = "#/skills"; });

$("#newAudit").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#formErr").textContent = "";
  const url = $("#url").value.trim();
  if (!url) { $("#formErr").textContent = "Paste a website address."; return; }
  $("#go").disabled = true;
  try {
    const { id } = await api("/api/audits", { method: "POST", body: JSON.stringify({ url, lead: $("#lead").value || undefined }) });
    $("#url").value = "";
    tab = "proposals";
    location.hash = `#/audit/${encodeURIComponent(id)}`;
    await loadState();
  } catch (err) { $("#formErr").textContent = err.message; }
  finally { $("#go").disabled = false; }
});

// ---- views -------------------------------------------------------------------------------
const currentId = () => { const m = location.hash.match(/^#\/audit\/(.+)$/); return m ? decodeURIComponent(m[1]) : null; };

function emptyView() {
  $("#view").innerHTML = `<div class="empty">
    <span class="label">Site audit</span>
    <h1>Paste a trades website. Get what's costing them calls, and what we'd fix.</h1>
    <p class="hint">Checks run against the same standards we ship to: build-site's conversion patterns and copy formulas, and CLAUDE.md's delivery standards (WCAG 2.1 AA, Lighthouse 90+, privacy and consent). Claude writes the proposals headless with the audit-site skill. Nothing is sent to anyone, and there's no price in it.</p>
    <div class="steps">
      <div><span class="label">1 · Checks</span><p>${GROUPS.length - 1} groups, about 40 checks, PageSpeed mobile run.</p></div>
      <div><span class="label">2 · Proposals</span><p>Top 3 failures with evidence, hero rewrite, improvements mapped to L1 / Core.</p></div>
      <div><span class="label">3 · Mock</span><p>One click starts a private, password-protected mock from site-starter.</p></div>
    </div></div>`;
}

function skillsView() {
  const offers = [
    ["L1 · Site rebuild", "build-site", "Conversion, trust, speed, accessibility and compliance failures on the site itself."],
    ["Core · Missed-call text-back", "setup-crm-automations", "After-hours claims, voicemail wording, phone-first sites."],
    ["Core · Review requests", "setup-crm-automations", "No reviews on the site, thin Google count vs the top competitor."],
    ["Core · Quote follow-up", "setup-crm-automations", "Quote/estimate forms, booking widgets."],
    ["Local SEO", "setup-local-seo", "Title, meta, schema, city mentions, sitemap."],
    ["Discovery call", "prep-discovery", "The audit's questions and objection prep feed the call brief."],
  ];
  const built = new Set(state.skills.filter((s) => s.built).map((s) => s.name));
  $("#view").innerHTML = `<span class="label">How audits map to what we sell</span>
    <h1 style="margin:.2em 0 .6em;font-size:1.6rem">Skills and offer map</h1>
    <div class="tablewrap"><table class="checks"><thead><tr><th>Offer</th><th>Delivered by</th><th>Triggered by findings in</th></tr></thead><tbody>
    ${offers.map(([o, s, w]) => `<tr><td><strong>${esc(o)}</strong></td><td>${esc(s)} <span class="chip ${built.has(s) ? "s-pass" : "s-unverified"}">${built.has(s) ? "built" : "planned"}</span></td><td>${esc(w)}</td></tr>`).join("")}
    </tbody></table></div>
    <h2 style="font-size:1.1rem;margin-top:28px">Skills in the repo</h2>
    <div class="skills">${state.skills.map((s) => `<div class="sk"><div class="row"><span class="nm">${esc(s.name)}</span><span class="chip ${s.built ? "s-pass" : "s-unverified"}">${s.built ? esc(s.department) : "planned"}</span></div><p>${esc(s.description)}</p></div>`).join("")}</div>`;
}

function offerKey(o) {
  const out = [];
  for (const part of String(o).split(/\s\+\s|\s\/\s/)) {
    const p = part.trim();
    if (p.startsWith("Core:")) out.push(`Core · ${p.slice(5).trim().replace(/^./, (c) => c.toUpperCase())}`);
    else if (p === "Core") out.push("Core · Automations (general)");
    else if (p === "L1") out.push("L1 · Site rebuild");
    else out.push(p);
  }
  return out;
}
const OFFER_SKILL = { "L1": "build-site", "Core": "setup-crm-automations", "Local SEO": "setup-local-seo" };

function offerPanel(checks) {
  const map = new Map();
  for (const c of checks) for (const k of offerKey(c.offer)) {
    if (!map.has(k)) map.set(k, { defects: [], signals: [] });
    if (["fail", "warn"].includes(c.status)) map.get(k).defects.push(c);
    else if (c.status === "info") map.get(k).signals.push(c);
  }
  const order = [...map.entries()].sort((a, b) => b[1].defects.filter((c) => c.status === "fail").length - a[1].defects.filter((c) => c.status === "fail").length || b[1].defects.length - a[1].defects.length);
  return `<p class="hint">Automated mapping from the checks. Claude's "Lead with" line in Proposals is the call; this is the evidence behind it. Add-ons are never pitched from an audit (plan v4 §8.4).</p>` +
    order.map(([k, v]) => {
      const skill = OFFER_SKILL[k.split(" · ")[0]] ?? "";
      if (!v.defects.length && !v.signals.length) return "";
      return `<div class="offer"><h3>${esc(k)}</h3>${skill ? `<div class="skill">Delivered by ${esc(skill)}</div>` : ""}
        ${v.defects.length ? `<ul>${v.defects.map((c) => `<li><span class="chip s-${c.status}">${c.status}</span> ${esc(c.title)}: ${esc(c.evidence)}</li>`).join("")}</ul>` : ""}
        ${v.signals.length ? `<ul>${v.signals.map((c) => `<li><span class="chip s-info">signal</span> ${esc(c.title)}: ${esc(c.evidence)}</li>`).join("")}</ul>` : ""}</div>`;
    }).join("");
}

function checksPanel(checks) {
  const all = ["fail", "warn", "unverified", "info", "pass"];
  return `<div class="filters" role="group" aria-label="Show statuses">${all.map((s) => `<button type="button" data-f="${s}" aria-pressed="${filter.has(s)}">${s} (${checks.filter((c) => c.status === s).length})</button>`).join("")}</div>` +
    GROUPS.map(([g, label]) => {
      const cs = checks.filter((c) => c.group === g && filter.has(c.status));
      if (!cs.length) return "";
      return `<h3>${esc(label)}</h3><div class="tablewrap"><table class="fixed"><colgroup><col style="width:104px"><col style="width:20%"><col><col style="width:28%"><col style="width:120px"></colgroup><thead><tr><th>Status</th><th>Check</th><th>Evidence</th><th>Fix</th><th>Offer</th></tr></thead><tbody>
        ${cs.map((c) => `<tr><td><span class="chip s-${c.status}">${c.status}</span></td><td>${esc(c.title)}</td><td class="ev">${esc(c.evidence)}</td><td class="fix">${esc(c.fix)}</td><td>${esc(c.offer)}</td></tr>`).join("")}
        </tbody></table></div>`;
    }).join("");
}

function mockPanel(d) {
  const s = d.seed;
  if (d.mock) return `<p>Mock created at <code>${esc(d.mock.path)}</code>.</p><pre class="out">${esc(d.mock.log ?? "")}</pre>`;
  if (!s) return `<p class="hint">The mock seed appears when the write-up finishes.</p>`;
  return `<p class="hint">Starts <code>new-site.mjs --mock</code> from site-starter with this seed: SITE_MODE = "mock", password-protected, noindex, form disabled. Never deploy it publicly, never use their photography, blur name and logo in anything posted.</p>
    <div class="offer"><h3>${esc(s.hero?.headline)}</h3><p>${esc(s.hero?.subhead)}</p>
      <div class="skill">${esc(s.lead?.company)} · ${esc(s.lead?.trade)} · ${esc(s.lead?.city)} · CTA: ${esc(s.conversion?.label)} (${esc(s.conversion?.action)})</div>
      ${Array.isArray(s.services) && s.services.length ? `<ul>${s.services.map((x) => `<li><strong>${esc(x.name)}</strong>: ${esc(x.summary)}</li>`).join("")}</ul>` : `<p class="hint">Services: trade preset.</p>`}</div>
    <div class="row"><button type="button" id="mockBtn">Start private mock</button></div>
    <pre class="out" id="mockOut" hidden></pre>`;
}

async function auditView(id) {
  let d;
  try { d = await api(`/api/audits/${encodeURIComponent(id)}`); }
  catch (e) { $("#view").innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const st = d.status, c = d.checks;
  const running = RUNNING.has(st.state);
  const host = (() => { try { return new URL(st.finalUrl || st.url).hostname; } catch { return st.url; } })();
  const tabs = [["proposals", "Proposals"], ["checks", "Checks"], ["offer", "Offer mapping"], ["mock", "Mock"]];

  $("#view").innerHTML = `
    <div class="head">
      <div style="flex:1;min-width:240px">
        <span class="label">${st.lead ? "Lead audit" : "Site audit"}</span>
        <h1>${esc(st.company || host)}</h1>
        <div class="meta"><a href="${esc(st.finalUrl || st.url)}" target="_blank" rel="noopener noreferrer">${esc(st.finalUrl || st.url)}</a> · ${esc(new Date(st.createdAt).toLocaleString("en-CA"))}</div>
        <div class="meta">Saved in <code>${esc(d.folder)}</code></div>
      </div>
      <div class="score" aria-label="Overall score"><b>${esc(c?.score ?? "–")}</b><span class="label">of 100</span></div>
    </div>
    ${c ? `<div class="groups">${GROUPS.slice(0, 6).map(([g, label]) => { const v = c.groupScore?.[g]; return `<div class="g"><div class="label">${esc(label)}</div><div class="n">${v ?? "–"}</div><div class="meter"><i style="width:${v ?? 0}%"></i></div></div>`; }).join("")}</div>` : ""}
    ${running ? `<div class="progress"><span class="dot" aria-hidden="true"></span><div><strong>${esc(st.state === "ai" ? "Writing proposals" : st.state === "checks" ? "Running checks" : "Queued")}</strong><div class="hint">${esc(st.step || "")}</div></div></div>` : ""}
    ${st.state === "error" ? `<div class="progress"><span class="chip s-fail">error</span><div>${esc(st.error)}</div>${c ? `<button type="button" class="ghost" id="rerun">Re-run write-up</button>` : ""}</div>` : ""}
    <div role="tablist" aria-label="Audit">${tabs.map(([k, l]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join("")}</div>
    <div class="panel" role="tabpanel" id="panel"></div>`;

  const panel = $("#panel");
  if (tab === "proposals") {
    const shot = d.hasScreenshot ? `<div class="shot"><img src="/api/audits/${encodeURIComponent(id)}/screenshot" alt="Mobile first screen of ${esc(host)}, from PageSpeed"><div class="hint" style="padding:6px 2px 0">Mobile first screen (PageSpeed)</div></div>` : "";
    panel.innerHTML = `<div class="cols"><div class="md">${d.auditMd ? md(d.auditMd) : `<p class="hint">${running ? "Proposals will appear here when Claude finishes." : "No write-up yet."}</p>`}</div><div>${shot}</div></div>`;
    if (d.auditMd && !running) panel.insertAdjacentHTML("beforeend", `<div class="row"><button type="button" class="ghost" id="rerun2">Re-run write-up</button></div>`);
  } else if (tab === "checks") { panel.classList.add("checks"); panel.innerHTML = c ? checksPanel(c.checks) : `<p class="hint">Checks are running.</p>`; }
  else if (tab === "offer") panel.innerHTML = c ? offerPanel(c.checks) : `<p class="hint">Checks are running.</p>`;
  else panel.innerHTML = mockPanel(d);

  $("#view").querySelectorAll("[role=tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; auditView(id); }));
  $("#view").querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { filter.has(b.dataset.f) ? filter.delete(b.dataset.f) : filter.add(b.dataset.f); auditView(id); }));
  for (const sel of ["#rerun", "#rerun2"]) $(sel)?.addEventListener("click", async () => {
    try { await api(`/api/audits/${encodeURIComponent(id)}/rerun`, { method: "POST", body: "{}" }); await loadState(); auditView(id); } catch (e) { alertInline(e.message); }
  });
  $("#mockBtn")?.addEventListener("click", async (e) => {
    e.target.disabled = true;
    const out = $("#mockOut");
    out.hidden = false; out.textContent = "Creating mock…";
    try { const r = await api(`/api/audits/${encodeURIComponent(id)}/mock`, { method: "POST", body: "{}" }); out.textContent = r.output; if (r.ok) setTimeout(() => auditView(id), 400); else e.target.disabled = false; }
    catch (err) { out.textContent = err.message; e.target.disabled = false; }
  });

  clearTimeout(poll);
  if (running) poll = setTimeout(async () => { if (currentId() === id) { await loadState(); auditView(id); } }, 3000);
}
function alertInline(msg) { $("#view").insertAdjacentHTML("afterbegin", `<p class="err" role="alert">${esc(msg)}</p>`); }

async function router() {
  clearTimeout(poll);
  await loadState().catch((e) => { $("#view").innerHTML = `<p class="err">${esc(e.message)}</p>`; });
  const id = currentId();
  if (id) { await auditView(id); if (window.innerWidth < 900) $("#view").scrollIntoView({ block: "start" }); return; }
  if (location.hash === "#/skills") return skillsView();
  emptyView();
}
window.addEventListener("hashchange", router);
router();
