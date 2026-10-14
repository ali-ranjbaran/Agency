import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorLine } from "@/components/bits";
import { api, type Contact } from "@/lib/api";
import { CASL_FIELDS, CASL_LABEL, caslMissing } from "@shared/casl";

const EMPTY = { name: "", title: "", email: "", source_url: "", capture_date: "", no_refusal_checked_where: "", relevance_rationale: "" };
type Fields = typeof EMPTY;

function Fields({ f, setF, idp }: { f: Fields; setF: (f: Fields) => void; idp: string }) {
  const one = (k: keyof Fields, label: string, long = false) => (
    <div className="grid gap-1">
      <Label htmlFor={`${idp}-${k}`}>{label}</Label>
      {long ? <Textarea id={`${idp}-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        : <Input id={`${idp}-${k}`} type={k === "capture_date" ? "date" : "text"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}
    </div>
  );
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {one("name", "Name")}{one("title", "Title")}{one("email", "Email")}
      {CASL_FIELDS.map((k) => <div key={k} className={k === "relevance_rationale" || k === "no_refusal_checked_where" ? "md:col-span-2" : ""}>{one(k, CASL_LABEL[k], k === "relevance_rationale")}</div>)}
    </div>
  );
}

export function ContactCard({ k, companyStage, onChanged }: { k: Contact; companyStage: string; onChanged: () => void }) {
  const [f, setF] = useState<Fields>(Object.fromEntries(Object.keys(EMPTY).map((x) => [x, (k[x as keyof Contact] as string | null) ?? ""])) as Fields);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = caslMissing(f);
  const call = async (body: Record<string, unknown>, method = "PATCH") => {
    setError(null);
    try { await api(`/api/contacts/${k.id}`, { method, body: method === "DELETE" ? undefined : body }); onChanged(); }
    catch (e) { setError((e as Error).message); }
  };
  const dirty = Object.entries(f).some(([x, v]) => ((k[x as keyof Contact] as string | null) ?? "") !== v);

  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-medium">{k.name || k.email || "Contact"}</span>
        {k.ready_to_send ? <Badge>Ready to send</Badge> : <Badge variant="outline">Not ready</Badge>}
        {k.casl_draft ? <Badge variant="secondary">CASL draft</Badge> : null}
        {k.suppressed ? <Badge variant="destructive">Suppressed</Badge> : null}
        {k.email_flags.split(",").filter(Boolean).map((x) => <Badge key={x} variant="outline">{x === "role" ? "role account" : x}</Badge>)}
        {k.casl_verified_at && <span className="text-xs text-muted-foreground">checked {k.casl_verified_at.slice(0, 10)}</span>}
      </div>
      <Fields f={f} setF={setF} idp={`c${k.id}`} />
      {f.source_url && /^https?:\/\//.test(f.source_url) && (
        <p className="mt-1 text-xs"><a className="underline" href={f.source_url} target="_blank" rel="noreferrer noopener">Open the source page</a></p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" disabled={!dirty} onClick={() => call(f)}>Save changes</Button>
        {k.ready_to_send ? (
          <Button size="sm" variant="outline" onClick={() => call({ ready: false })}>Mark not ready</Button>
        ) : (
          <>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} /> I checked the source page
            </label>
            <Button size="sm" disabled={dirty || !!missing.length || !checked || !!k.suppressed || companyStage === "candidate"}
              onClick={() => call({ ready: true, checked_source: true })}>Mark ready to send</Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => confirm("Delete this contact?") && call({}, "DELETE")}>Delete</Button>
      </div>
      {!k.ready_to_send && missing.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Needed before it can be ready: {missing.join(", ")}.</p>}
      {dirty && <p className="mt-1 text-xs text-muted-foreground">Save first. Changing a CASL field clears an earlier check.</p>}
      <ErrorLine error={error} />
    </div>
  );
}

export function NewContact({ companyId, onAdded }: { companyId: number; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Fields>({ ...EMPTY, capture_date: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState<string | null>(null);
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Add contact</Button>;
  return (
    <div className="rounded-md border border-dashed p-3">
      <Fields f={f} setF={setF} idp="new" />
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={async () => {
          setError(null);
          try { await api(`/api/companies/${companyId}/contacts`, { method: "POST", body: f }); setOpen(false); setF({ ...EMPTY }); onAdded(); }
          catch (e) { setError((e as Error).message); }
        }}>Save contact</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}
