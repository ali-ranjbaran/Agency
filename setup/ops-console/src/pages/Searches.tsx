import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ErrorLine, PageTitle } from "@/components/bits";
import { Universe, type UniverseRow } from "@/components/Universe";
import { api } from "@/lib/api";

type Saved = { id: number; trade: string; city: string; radius_km: number | null; keywords: string; sources: string; schedule: string | null; last_run_at: string | null };
type Job = { id: number; trade: string; city: string; sources: string; status: string; counts: Record<string, number> | null; places_calls: number; error: string | null; created_at: string; finished_at: string | null };
type Data = { saved: Saved[]; jobs: Job[]; universe: UniverseRow[]; places: { usage: { month: string; calls: number } | null; cap: number } };

const SOURCE_LABEL: Record<string, string> = { osm: "OpenStreetMap", places: "Google Places", manual: "Pasted URLs" };

export default function Searches() {
  const [d, setD] = useState<Data | null>(null);
  const [f, setF] = useState({ trade: "hvac", city: "Saskatoon", radius_km: "", keywords: "furnace, heating", osm: true, places: false, manual: false, manual_urls: "", save: true, monthly: false });
  const [error, setError] = useState<string | null>(null);
  const load = () => api<Data>("/api/searches").then(setD, (e) => setError(e.message));
  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, []);
  const run = async (fn: () => Promise<unknown>) => { setError(null); try { await fn(); await load(); } catch (e) { setError((e as Error).message); } };

  const submit = () => run(() => api("/api/searches", { method: "POST", body: {
    trade: f.trade, city: f.city, radius_km: f.radius_km, keywords: f.keywords,
    sources: (["osm", "places", "manual"] as const).filter((s) => f[s]), manual_urls: f.manual_urls,
    save: f.save, schedule: f.monthly ? "monthly" : null,
  } }));

  return (
    <>
      <PageTitle>Searches</PageTitle>
      {d && <Universe rows={d.universe} />}
      <ErrorLine error={error} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>New search</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-2 text-sm" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <Label htmlFor="s-trade">Trade</Label><Input id="s-trade" value={f.trade} onChange={(e) => setF({ ...f, trade: e.target.value })} />
              <Label htmlFor="s-city">City</Label><Input id="s-city" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
              <Label htmlFor="s-radius">Radius km (optional; blank = the city boundary)</Label><Input id="s-radius" type="number" min={1} max={100} value={f.radius_km} onChange={(e) => setF({ ...f, radius_km: e.target.value })} />
              <Label htmlFor="s-kw">Extra keywords (comma separated)</Label><Input id="s-kw" value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} />
              <fieldset className="grid gap-1">
                <legend className="mb-1 font-medium">Sources</legend>
                {(["osm", "places", "manual"] as const).map((s) => (
                  <label key={s} className="flex items-center gap-1.5"><input type="checkbox" checked={f[s]} onChange={(e) => setF({ ...f, [s]: e.target.checked })} /> {SOURCE_LABEL[s]}
                    {s === "places" && <span className="text-xs text-muted-foreground"> (off on the Mac until a key is set)</span>}</label>
                ))}
              </fieldset>
              {f.manual && <><Label htmlFor="s-urls">Website URLs, one per line (firms' own sites)</Label><Textarea id="s-urls" rows={5} value={f.manual_urls} onChange={(e) => setF({ ...f, manual_urls: e.target.value })} /></>}
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.save} onChange={(e) => setF({ ...f, save: e.target.checked })} /> Save this search</label>
              {f.save && <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.monthly} onChange={(e) => setF({ ...f, monthly: e.target.checked })} /> Re-run monthly</label>}
              <Button type="submit">Queue search</Button>
              <p className="text-xs text-muted-foreground">The Mac runner picks it up within ~2 minutes. Results land in the Review queue as candidates.</p>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Saved searches</CardTitle></CardHeader>
          <CardContent>
            {d?.saved.length ? (
              <ul className="divide-y text-sm">
                {d.saved.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="font-medium">{s.trade.toUpperCase()} · {s.city}</span>
                    <span className="text-muted-foreground">{s.sources}{s.keywords ? ` · ${s.keywords}` : ""}{s.radius_km ? ` · ${s.radius_km} km` : ""} · last run {s.last_run_at?.slice(0, 10) ?? "never"}</span>
                    <label className="ml-auto flex items-center gap-1.5"><input type="checkbox" checked={s.schedule === "monthly"} onChange={(e) => run(() => api(`/api/searches/${s.id}`, { method: "PATCH", body: { schedule: e.target.checked ? "monthly" : null } }))} /> monthly</label>
                    <Button size="sm" variant="outline" onClick={() => run(() => api(`/api/searches/${s.id}`, { method: "POST", body: {} }))}>Re-run (new firms only)</Button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">None yet.</p>}
            {d?.places && <p className="mt-3 text-xs text-muted-foreground">Google Places this month: {d.places.usage?.calls ?? 0} of {d.places.cap} calls (hard cap).</p>}
          </CardContent>
        </Card>
      </div>

      <h2 className="mt-8 mb-2 text-lg font-semibold">History</h2>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Search</TableHead><TableHead>Status</TableHead><TableHead>Found</TableHead><TableHead>New</TableHead><TableHead>Known</TableHead><TableHead>Rejected before</TableHead><TableHead>Suppressed</TableHead><TableHead>Other</TableHead><TableHead>Queued</TableHead></TableRow></TableHeader>
          <TableBody>
            {d?.jobs.map((j) => {
              const c = j.counts ?? {};
              const other = Object.entries(c).filter(([k, v]) => !["found", "new_candidates", "known", "rejected_skipped", "suppressed_dropped"].includes(k) && v).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(", ");
              return (
                <TableRow key={j.id}>
                  <TableCell>{j.id}</TableCell>
                  <TableCell>{j.trade.toUpperCase()} · {j.city} <span className="text-xs text-muted-foreground">{j.sources}</span></TableCell>
                  <TableCell><Badge variant={j.status === "error" ? "destructive" : j.status === "done" ? "default" : "secondary"}>{j.status}</Badge>{j.error && <div className="text-xs text-destructive">{j.error}</div>}</TableCell>
                  <TableCell>{c.found ?? ""}</TableCell><TableCell>{c.new_candidates ?? ""}</TableCell><TableCell>{c.known ?? ""}</TableCell>
                  <TableCell>{c.rejected_skipped ?? ""}</TableCell><TableCell>{c.suppressed_dropped ?? ""}</TableCell>
                  <TableCell className="text-xs">{other}{j.places_calls ? `${other ? ", " : ""}places calls ${j.places_calls}` : ""}</TableCell>
                  <TableCell>{j.created_at.slice(0, 16)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
