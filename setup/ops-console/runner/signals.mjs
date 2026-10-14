/**
 * Runs INSIDE the page (page.evaluate) on the mobile viewport. Pure DOM, no clicks, no typing.
 *   tel_link                 any <a href="tel:…">
 *   phone_above_fold_mobile  a phone number (text or tel: link) visible in the first screen
 *   form                     a contact-style form (2+ visible fields, or a textarea / email / tel field;
 *                            a lone search box doesn't count)
 */
export function pageSignals() {
  const PHONE = /(\+?1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]?[2-9]\d{2}[\s.-]?\d{4}/;
  const vh = window.innerHeight;
  const visible = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh;
  const shown = (el) => { const s = getComputedStyle(el); return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05; };

  const tels = [...document.querySelectorAll('a[href^="tel:"]')];
  let above = tels.some((a) => shown(a) && visible(a.getBoundingClientRect()));
  if (!above) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n && !above; n = walker.nextNode()) {
      if (!PHONE.test(n.textContent || "") || !n.parentElement || !shown(n.parentElement)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      above = [...range.getClientRects()].some(visible);
    }
  }

  const form = [...document.querySelectorAll("form")].some((f) => {
    const fields = [...f.querySelectorAll("input, textarea, select")].filter((i) =>
      !["hidden", "submit", "button", "image", "reset", "search"].includes((i.getAttribute("type") || "").toLowerCase()) && shown(i));
    return fields.length >= 2 || fields.some((i) => i.tagName === "TEXTAREA" || ["email", "tel"].includes((i.getAttribute("type") || "").toLowerCase()));
  });

  return { tel_link: tels.length > 0, phone_above_fold_mobile: above, form };
}
