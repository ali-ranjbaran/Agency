import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorLine, PageTitle } from "@/components/bits";
import { api } from "@/lib/api";
import { IMPORT_COLUMNS, toCsv } from "@shared/csv";

type Q = { id: number; batch: string; missing: string; row: Record<string, string> };
const TEMPLATE = toCsv([...IMPORT_COLUMNS], [
  ["Northgate Heating & Air", "northgate.example", "306-555-0123", "Saskatoon", "residential", "prospect", "Call the owner", "call", "2026-10-20",
    "Pat Example", "Office manager", "office@northgate.example", "https://northgate.example/contact", "2026-10-13",
    "Contact page and footer: no refusal statement found", "Office manager at a residential HVAC firm in Saskatoon; handles inbound calls"],
]);

export default function Import() {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [quar, setQuar] = useState<Q[]>([]);
  const [error, setError] = useState<string | null>(null);
  const loadQ = () => api<{ rows: Q[] }>("/api/quarantine").then((d) => setQuar(d.rows), (e) => setError(e.message));
  useEffect(() => { loadQ(); }, []);

  const run = async () => {
    setError(null); setResult(null);
    try { setResult(await api("/api/import", { method: "POST", body: { csv } })); loadQ(); }
    catch (e) { setError((e as Error).message); }
  };

  return (
    <>
      <PageTitle actions={<Button variant="outline" render={<a href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="arkosa-import-template.csv" />}>Download template</Button>}>Import prospects (CSV)</PageTitle>
      <p className="mb-3 text-sm text-muted-foreground">
        One row per company, optionally with one contact. A row with an email needs all four CASL fields, or it goes to quarantine below.
        Suppressed rows are dropped. Imported contacts are never ready until you check the source page.
      </p>
      <div className="grid gap-2">
        <Input type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} />
        <Textarea aria-label="CSV text" rows={8} placeholder="…or paste CSV here" value={csv} onChange={(e) => setCsv(e.target.value)} className="font-mono text-xs" />
        <div><Button onClick={run} disabled={!csv.trim()}>Import</Button></div>
      </div>
      <ErrorLine error={error} />
      {result && <pre className="mt-3 rounded-md bg-muted p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>}

      <h2 className="mt-8 mb-2 text-lg font-semibold">Quarantine ({quar.length})</h2>
      {quar.map((q) => <QuarantineRow key={q.id} q={q} onDone={loadQ} />)}
      {!quar.length && <p className="text-sm text-muted-foreground">Nothing waiting.</p>}
    </>
  );
}

function QuarantineRow({ q, onDone }: { q: Q; onDone: () => void }) {
  const [row, setRow] = useState<Record<string, string>>(q.row);
  const [error, setError] = useState<string | null>(null);
  const missingKeys = q.missing.split(",").map((s) => s.trim().split(" ")[0]);
  const keys = [...new Set(["company", "email", ...missingKeys])];
  return (
    <div className="mb-3 rounded-md border p-3 text-sm">
      <div className="mb-2"><span className="font-medium">{q.row.company}</span> · missing: {q.missing}</div>
      <div className="grid gap-2 md:grid-cols-2">
        {keys.map((k) => (
          <label key={k} className="grid gap-1"><span className="text-xs">{k}</span>
            <Input type={k === "capture_date" ? "date" : "text"} value={row[k] ?? ""} onChange={(e) => setRow({ ...row, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={async () => { setError(null); try { await api(`/api/quarantine/${q.id}`, { method: "POST", body: { row } }); onDone(); } catch (e) { setError((e as Error).message); } }}>Retry import</Button>
        <Button size="sm" variant="ghost" onClick={async () => { await api(`/api/quarantine/${q.id}`, { method: "DELETE" }); onDone(); }}>Discard</Button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}
