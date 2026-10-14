// Discovery sources with fetch mocked: no call reaches Google or Overpass.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { discoverPlaces } from "../sources/places.mjs";
import { discoverOsm, ATTRIBUTION } from "../sources/overpass.mjs";
import { mergeFirms } from "../jobs.mjs";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test("Places: off without a key, zero calls", async () => {
  globalThis.fetch = () => { throw new Error("must not call"); };
  const r = await discoverPlaces({ trade: "hvac", city: "Saskatoon" }, { key: "", reserve: async () => true });
  assert.deepEqual(r, { firms: [], calls: 0, stopped: "no_key" });
});

test("Places: minimal field mask, place_id is the only thing kept, website stays in memory", async () => {
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url, mask: init.headers["X-Goog-FieldMask"], body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ places: [{ id: "ChIJ-test-1", websiteUri: "https://northgate.example/", displayName: { text: "SHOULD NOT BE USED" } }] }));
  };
  const r = await discoverPlaces({ trade: "hvac", city: "Saskatoon" }, { key: "k", reserve: async () => true });
  assert.equal(seen[0].url, "https://places.googleapis.com/v1/places:searchText");
  assert.equal(seen[0].mask, "places.id,places.websiteUri,nextPageToken");
  assert.equal(seen[0].body.textQuery, "HVAC contractor in Saskatoon");
  assert.deepEqual(r.firms[0], { name: null, website: "https://northgate.example/", phone: null, city: null, refs: [{ source: "places", ref: "ChIJ-test-1", attribution: null }] });
  assert.ok(!JSON.stringify(r.firms).includes("SHOULD NOT BE USED"));
});

test("Places: every call is reserved first; the cap stops the source", async () => {
  let calls = 0, reserves = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ places: [], nextPageToken: "more" })); };
  const r = await discoverPlaces({ trade: "hvac", city: "Saskatoon" }, { key: "k", reserve: async () => ++reserves <= 2 });
  assert.equal(calls, 2);
  assert.equal(r.stopped, "monthly_cap");
});

test("Overpass: one query, honest UA, firms carry the OSM ref and ODbL attribution", async () => {
  let req;
  globalThis.fetch = async (url, init) => {
    req = { url, ua: init.headers["user-agent"], q: new URLSearchParams(init.body).get("data") };
    return new Response(JSON.stringify({ elements: [
      { type: "node", id: 42, tags: { name: "Northgate Heating & Air", website: "https://northgate.example", phone: "306-555-0123", craft: "hvac" } },
      { type: "way", id: 7, tags: { craft: "hvac" } },
    ] }));
  };
  const firms = await discoverOsm({ trade: "hvac", city: "Saskatoon", keywords: "boiler" });
  assert.match(req.ua, /^ArkosaLeadResearch\/1\.0/);
  assert.match(req.q, /area\["name"="Saskatoon"\]\["boundary"="administrative"\]/);
  assert.match(req.q, /furnace\|.*\|boiler/);
  assert.equal(firms.length, 1, "unnamed elements are dropped");
  assert.deepEqual(firms[0].refs, [{ source: "osm", ref: "node/42", attribution: ATTRIBUTION }]);
});

test("merge: the same firm from two sources becomes one, keeping both refs", () => {
  const merged = mergeFirms([
    { name: "Northgate", website: "https://www.northgate.example/", phone: null, refs: [{ source: "osm", ref: "node/42" }] },
    { name: null, website: "https://northgate.example", phone: "306-555-0123", refs: [{ source: "places", ref: "ChIJ-1" }] },
    { name: "Other", website: null, phone: "(306) 555-0123", refs: [{ source: "osm", ref: "node/9" }] },
    { name: "Third", website: "https://third.example", phone: null, refs: [{ source: "manual", ref: "https://third.example" }] },
  ]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0].refs.map((r) => r.ref), ["node/42", "ChIJ-1", "node/9"]);
});
