import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorLine, FitBadge, NativeSelect, PageTitle, YesNo } from "@/components/bits";
import { ContactCard, NewContact } from "@/components/ContactCard";
import { api, type Company, type Contact, type Touch } from "@/lib/api";
import { firstLines } from "@shared/first-line";
import { BOARD_STAGES, NEXT_ACTION_TYPES, SEGMENTS, STAGE_LABEL, TOUCH_TYPES } from "@shared/stages";

type Snapshot = {
  id: number; captured_at: string; url: string | null; desktop_url: string | null; mobile_url: string | null; lh_mobile_perf: number | null;
  phone_above_fold_mobile: number | null; tel_link: number | null; form: number | null; https: number | null;
  review_count: number | null; competitor_review_count: number | null; competitor_name: string | null; error: string | null; last_error: string | null;
};
type Source = { source: string; source_ref: string; attribution: string | null };
type Detail = { company: Company; contacts: Contact[]; touches: Touch[]; demo_calls: { at: string; last4: string; sms_sent: number; reply_sent: number }[]; snapshot: Snapshot | null; sources: Source[] };

export default function CompanyPage() {
  const { id } = useParams();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const load = () => api<Detail>(`/api/companies/${id}`).then(setD, (e) => setError(e.message));
  useEffect(() => { load(); }, [id]);
  const run = async (f: () => Promise<unknown>) => { setError(null); try { await f(); await load(); } catch (e) { setError((e as Error).message); } };

  if (!d) return <ErrorLine error={error} />;
  const c = d.company;
  const s = d.snapshot;
  const lines = firstLines(c.domain ?? c.name, s);
  const timeline = [
    ...d.touches.map((t) => ({ at: t.at, label: `${t.type.replace("_", " ")}${t.outcome ? `: ${t.outcome}` : ""}`, notes: t.notes })),
    ...d.demo_calls.map((x) => ({ at: x.at, label: `demo line call from …${x.last4}${x.sms_sent ? ", text-back sent" : ""}${x.reply_sent ? ", replied" : ""}`, notes: null })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <PageTitle actions={<FitBadge fit={c.fit} />}>{c.name}</PageTitle>
      <ErrorLine error={error} />
      <p className="mb-4 text-sm text-muted-foreground">
        {c.domain && <><a className="underline" href={`https://${c.domain}`} target="_blank" rel="noreferrer noopener">{c.domain}</a> · </>}
        {c.phone_e164 ?? "no phone"} · {c.city ?? "no city"} · source: {c.source}{c.suppressed ? " · SUPPRESSED" : ""}
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Site, first screen {s ? `(captured ${s.captured_at.slice(0, 10)})` : ""}</CardTitle></CardHeader>
          <CardContent>
            {s?.desktop_url || s?.mobile_url ? (
              <div className="flex flex-wrap items-start gap-3">
                {s.desktop_url && <figure className="min-w-0 flex-[3]"><img src={s.desktop_url} alt={`Desktop first screen of ${c.domain}`} className="w-full rounded border" /><figcaption className="text-xs text-muted-foreground">Desktop 1440</figcaption></figure>}
                {s.mobile_url && <figure className="w-40 flex-none"><img src={s.mobile_url} alt={`Mobile first screen of ${c.domain}`} className="w-full rounded border" /><figcaption className="text-xs text-muted-foreground">Mobile 390</figcaption></figure>}
              </div>
            ) : <p className="text-sm text-muted-foreground">No screenshots yet. On the Mac: <code>npm run snapshot -- --company {c.id}</code></p>}
            {s?.last_error && <p className="mt-2 text-xs text-muted-foreground">Last failed capture: {s.last_error}</p>}
            <p className="mt-2 text-xs text-muted-foreground">Internal sales research only. Never published, never reused in a rebuild.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Signals</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>Lighthouse mobile performance: {s?.lh_mobile_perf ?? <span className="text-muted-foreground">not measured</span>}</div>
            <div>Phone visible in first mobile screen: <YesNo v={s?.phone_above_fold_mobile} /></div>
            <div>Tap-to-call (tel:) link: <YesNo v={s?.tel_link} /></div>
            <div>Contact form: <YesNo v={s?.form} /></div>
            <div>HTTPS: <YesNo v={s?.https} /></div>
            <ReviewForm s={s} onSave={(body) => run(() => api(`/api/companies/${c.id}/reviews`, { method: "POST", body }))} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Copy first line</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {lines.length ? lines.map((l) => (
              <div key={l.id} className="flex items-start gap-2">
                <div className="flex-1"><p>{l.text}</p><p className="text-xs text-muted-foreground">Basis: {l.basis}</p></div>
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(l.text).then(() => setCopied(l.id))}>{copied === l.id ? "Copied" : "Copy"}</Button>
              </div>
            )) : <p className="text-muted-foreground">No verified signal to write from yet. A draft needs a measured problem.</p>}
            <p className="text-xs text-muted-foreground">A draft for you to edit. Nothing sends from the console.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Pipeline</CardTitle></CardHeader>
          <CardContent>
            <CompanyForm c={c} onStage={(stage) => run(() => api(`/api/companies/${c.id}/stage`, { method: "POST", body: { stage } }))}
              onSave={(body) => run(() => api(`/api/companies/${c.id}`, { method: "PATCH", body }))} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Contacts and CASL record</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {d.contacts.map((k) => <ContactCard key={k.id} k={k} companyStage={c.stage} onChanged={load} />)}
            <NewContact companyId={c.id} onAdded={load} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
          <CardContent>
            <TouchForm onAdd={(body) => run(() => api(`/api/companies/${c.id}/touches`, { method: "POST", body }))} />
            <ol className="mt-3 space-y-2 text-sm">
              {timeline.map((t, i) => <li key={i}><span className="text-muted-foreground">{t.at.slice(0, 16)}</span> · {t.label}{t.notes && <div className="text-muted-foreground">{t.notes}</div>}</li>)}
              {!timeline.length && <li className="text-muted-foreground">No touches yet.</li>}
            </ol>
            {d.sources.length > 0 && (
              <div className="mt-4 text-xs text-muted-foreground">
                Found via: {d.sources.map((x, i) => <span key={i}>{x.source}{x.attribution ? ` (${x.attribution})` : ""}{i < d.sources.length - 1 ? ", " : ""}</span>)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ReviewForm({ s, onSave }: { s: Snapshot | null; onSave: (b: Record<string, unknown>) => void }) {
  const [f, setF] = useState({ review_count: s?.review_count ?? "", competitor_review_count: s?.competitor_review_count ?? "", competitor_name: s?.competitor_name ?? "" });
  return (
    <form className="mt-3 grid gap-2 border-t pt-3" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <div className="text-xs font-medium">Google reviews (entered by hand)</div>
      <div className="flex gap-2">
        <Input aria-label="Their review count" placeholder="Theirs" value={String(f.review_count)} onChange={(e) => setF({ ...f, review_count: e.target.value })} />
        <Input aria-label="Top competitor's review count" placeholder="Top competitor" value={String(f.competitor_review_count)} onChange={(e) => setF({ ...f, competitor_review_count: e.target.value })} />
      </div>
      <Input aria-label="Top competitor's name" placeholder="Competitor name" value={f.competitor_name} onChange={(e) => setF({ ...f, competitor_name: e.target.value })} />
      <Button size="sm" variant="outline" type="submit">Save reviews</Button>
    </form>
  );
}

function CompanyForm({ c, onStage, onSave }: { c: Company; onStage: (s: string) => void; onSave: (b: Record<string, unknown>) => void }) {
  const [f, setF] = useState({ next_action: c.next_action ?? "", next_action_type: c.next_action_type ?? "", next_action_due: c.next_action_due ?? "", segment: c.segment, fit_override: c.fit_override ?? "", notes: c.notes ?? "", phone: c.phone_e164 ?? "", domain: c.domain ?? "", city: c.city ?? "" });
  return (
    <div className="grid gap-2 text-sm">
      <Label htmlFor="cf-stage">Stage</Label>
      {c.stage === "candidate" ? <p>In the review queue. Approve it there.</p> : (
        <NativeSelect id="cf-stage" value={c.stage} onChange={(e) => onStage(e.target.value)}>{BOARD_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</NativeSelect>
      )}
      <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
        <Label htmlFor="cf-na">Next action</Label>
        <Input id="cf-na" value={f.next_action} onChange={(e) => setF({ ...f, next_action: e.target.value })} />
        <div className="flex gap-2">
          <NativeSelect aria-label="Next action type" value={f.next_action_type} onChange={(e) => setF({ ...f, next_action_type: e.target.value })}>
            <option value="">type</option>{NEXT_ACTION_TYPES.map((t) => <option key={t}>{t}</option>)}
          </NativeSelect>
          <Input aria-label="Next action due" type="date" value={f.next_action_due} onChange={(e) => setF({ ...f, next_action_due: e.target.value })} />
        </div>
        <Label htmlFor="cf-seg">Segment</Label>
        <NativeSelect id="cf-seg" value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value })}>{SEGMENTS.map((s) => <option key={s}>{s}</option>)}</NativeSelect>
        <Label htmlFor="cf-dom">Domain</Label><Input id="cf-dom" value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} />
        <Label htmlFor="cf-ph">Phone</Label><Input id="cf-ph" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Label htmlFor="cf-city">City</Label><Input id="cf-city" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
        <Label htmlFor="cf-fit">Fit override (blank = computed)</Label>
        <Input id="cf-fit" type="number" value={String(f.fit_override)} onChange={(e) => setF({ ...f, fit_override: e.target.value })} />
        <Label htmlFor="cf-notes">Notes</Label><Textarea id="cf-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        <Button type="submit" size="sm">Save</Button>
      </form>
    </div>
  );
}

function TouchForm({ onAdd }: { onAdd: (b: Record<string, unknown>) => void }) {
  const [f, setF] = useState({ type: "call", outcome: "", notes: "" });
  return (
    <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); onAdd(f); setF({ ...f, outcome: "", notes: "" }); }}>
      <div className="flex gap-2">
        <NativeSelect aria-label="Touch type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          {TOUCH_TYPES.filter((t) => t !== "stage_change").map((t) => <option key={t}>{t}</option>)}
        </NativeSelect>
        <Input aria-label="Outcome" placeholder="Outcome" value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })} />
      </div>
      <Textarea aria-label="Notes" placeholder="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      <Button size="sm" type="submit">Log touch</Button>
    </form>
  );
}
