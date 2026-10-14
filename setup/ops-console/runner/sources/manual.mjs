/**
 * Discovery source: URLs the operator pasted (e.g. from directories browsed by hand).
 *
 * TERMS NOTE. The runner never scrapes directories (Yably, HomeStars, YellowPages, BBB,
 * LinkedIn or any other). The operator reads those in a browser and pastes the firms' own
 * website URLs; only those sites are visited.
 */
export function discoverManual(urls) {
  return (urls ?? []).map((u) => ({ name: null, website: u, phone: null, city: null, refs: [{ source: "manual", ref: u, attribution: "pasted by the operator" }] }));
}
