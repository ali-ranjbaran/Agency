import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorLine, FitBadge, PageTitle } from "@/components/bits";
import { Universe, type UniverseRow } from "@/components/Universe";
import { api, type Company, type Contact } from "@/lib/api";
import { CASL_FIELDS, CASL_LABEL, caslMissing } from "@shared/casl";

type Cand = Company & {
  thumb: string | null;
  enrichment: { services?: string[]; claims_247?: boolean; pages?: string[]; note?: string; residential_signals?: number; commercial_signals?: number };
  contacts: (Contact & { refusal_found: string | null })[];
  sources: { source: string; source_ref: string; attribution: string | null }[];
};

const sourceLink = (s: Cand["sources"][number]) =>
  s.source === "places" ? <a className="underline" href={`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(s.source_ref)}`} target="_blank" rel="noreferrer noopener">Google Maps (opens Google)</a>
  : s.source === "osm" ? <a className="underline" href={`https://www.openstreetmap.org/${s.source_ref}`} target="_blank" rel="noreferrer noopener">OSM {s.source_ref}</a>
  : <span>pasted URL</span>;

function CandidateCard({ c, selected, onSelect, onDone }: { c: Cand; selected: boolean; onSelect: (v: boolean) => void; onDone: () => void }) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const act = async (f: () => Promise<unknown>) => { setError(null); try { await f(); onDone(); } catch (e) { setError((e as Error).message); } };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start gap-3">
          <input type="checkbox" aria-label={`Select ${c.name} for bulk reject`} checked={selected} onChange={(e) => onSelect(e.target.checked)} className="mt-1" />
          {c.thumb ? <img src={c.thumb} alt={`Mobile first screen of ${c.domain}`} className="h-28 w-16 flex-none rounded border object-cover object-top" />
            : <div className="flex h-28 w-16 flex-none items-center justify-center rounded border text-center text-[10px] text-muted-foreground">no snapshot yet</div>}
          <div className="min-w-0 flex-1">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <Link to={`/company/${c.id}`} className="hover:underline">{c.name}</Link> <FitBadge fit={c.fit} />
              <Badge variant="outline">segment guess: {c.segment}</Badge>
              {c.enrichment.claims_247 && <Badge variant="secondary">24/7 claim</Badge>}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {c.domain ? <a className="underline" href={`https://${c.domain}`} target="_blank" rel="noreferrer noopener">{c.domain}</a> : "no website"} · {c.phone_e164 ?? "no phone"} · {c.city ?? ""}
            </p>
            {!!c.enrichment.services?.length && <p className="text-sm">Services: {c.enrichment.services.join(", ")}</p>}
            {c.enrichment.note && <p className="text-sm text-muted-foreground">{c.enrichment.note}</p>}
            <p className="mt-1 text-xs text-muted-foreground">Found via: {c.sources.map((s, i) => <span key={i}>{sourceLink(s)}{s.attribution && s.source === "osm" ? ` ${s.attribution}` : ""}{i < c.sources.length - 1 ? " · " : ""}</span>)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {c.contacts.length === 0 && <p className="text-sm text-muted-foreground">No email published on the pages visited. Approving still adds the company; add a contact later if you find one.</p>}
        {c.contacts.map((k) => {
          const missing = caslMissing(k);
          return (
            <div key={k.id} className="rounded-md border p-3 text-sm">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-medium">{k.email}</span>
                {k.name && <span>{k.name}{k.title ? `, ${k.title}` : ""}</span>}
                {k.email_flags.split(",").filter(Boolean).map((f) => <Badge key={f} variant="outline">{f === "role" ? "role account" : f}</Badge>)}
                <Badge variant="secondary">CASL draft</Badge>
                {k.refusal_found && <Badge variant="destructive">refusal on site</Badge>}
              </div>
              <dl className="grid gap-x-3 gap-y-1 md:grid-cols-[12rem_1fr]">
                {CASL_FIELDS.map((f) => (
                  <div key={f} className="contents">
                    <dt className="text-muted-foreground">{CASL_LABEL[f]}</dt>
                    <dd>{f === "source_url" && k.source_url ? <a className="underline" href={k.source_url} target="_blank" rel="noreferrer noopener">{k.source_url}</a> : (k[f] || <span className="text-destructive">missing</span>)}</dd>
                  </div>
                ))}
              </dl>
              {k.refusal_found ? <p className="mt-2 text-destructive">Can't be sent to: {k.refusal_found}.</p> : missing.length ? <p className="mt-2 text-muted-foreground">Missing: {missing.join(", ")}.</p> : (
                <label className="mt-2 flex items-center gap-1.5">
                  <input type="checkbox" checked={!!checked[k.id]} onChange={(e) => setChecked({ ...checked, [k.id]: e.target.checked })} />
                  I checked the source page (this contact becomes ready to send when I approve)
                </label>
              )}
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button size="sm" onClick={() => act(async () => {
            const r = await api<{ contacts: { id: number; ready: boolean; why?: string }[] }>(`/api/review/${c.id}/approve`, { method: "POST", body: { checked } });
            setResult(`${r.contacts.filter((x) => x.ready).length} of ${r.contacts.length} contacts ready`);
          })}>Approve → prospect</Button>
          <Button size="sm" variant="outline" render={<Link to={`/company/${c.id}`} />}>Edit</Button>
          <Input aria-label="Reason" placeholder="Reason (for reject / suppress)" value={reason} onChange={(e) => setReason(e.target.value)} className="h-8 w-64" />
          <Button size="sm" variant="outline" disabled={!reason.trim()} onClick={() => act(() => api("/api/review/reject", { method: "POST", body: { ids: [c.id], reason } }))}>Reject</Button>
          <Button size="sm" variant="destructive" disabled={!reason.trim()} onClick={() => confirm(`Suppress ${c.domain ?? c.name}? Its domain, phone and emails go on the permanent suppression list.`) && act(() => api(`/api/review/${c.id}/suppress`, { method: "POST", body: { reason } }))}>Suppress</Button>
          {result && <span className="text-sm">{result}</span>}
        </div>
        <ErrorLine error={error} />
      </CardContent>
    </Card>
  );
}

export default function Review() {
  const [rows, setRows] = useState<Cand[]>([]);
  const [uni, setUni] = useState<UniverseRow[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [bulkReason, setBulkReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = () => api<{ candidates: Cand[]; universe: UniverseRow[] }>("/api/review").then((d) => { setRows(d.candidates); setUni(d.universe); setSel(new Set()); }, (e) => setError(e.message));
  useEffect(() => { load(); }, []);
  return (
    <>
      <PageTitle>Review queue ({rows.length})</PageTitle>
      <p className="mb-3 text-sm text-muted-foreground">Nothing here can be sent. Approve one company at a time; a contact is ready only with all four CASL fields and your source-page tick. Rejected firms are remembered and skipped by future searches.</p>
      <Universe rows={uni} />
      <ErrorLine error={error} />
      {sel.size > 0 && (
        <div className="sticky top-0 z-10 my-3 flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
          <span className="text-sm">{sel.size} selected</span>
          <Input aria-label="Reason for bulk reject" placeholder="Reason" value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} className="h-8 w-64" />
          <Button size="sm" variant="outline" disabled={!bulkReason.trim()} onClick={async () => {
            try { await api("/api/review/reject", { method: "POST", body: { ids: [...sel], reason: bulkReason } }); load(); } catch (e) { setError((e as Error).message); }
          }}>Reject selected</Button>
          <span className="text-xs text-muted-foreground">(Bulk approve doesn't exist, by design.)</span>
        </div>
      )}
      <div className="mt-4 space-y-4">
        {rows.map((c) => <CandidateCard key={c.id} c={c} selected={sel.has(c.id)} onDone={load}
          onSelect={(v) => setSel((s) => { const n = new Set(s); if (v) n.add(c.id); else n.delete(c.id); return n; })} />)}
        {!rows.length && <p className="text-sm text-muted-foreground">The queue is empty. Start a search on the Searches page.</p>}
      </div>
    </>
  );
}
