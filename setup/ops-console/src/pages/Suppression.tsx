import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorLine, NativeSelect, PageTitle } from "@/components/bits";
import { api } from "@/lib/api";

type Row = { kind: string; value: string; reason: string; at: string };

export default function Suppression() {
  const [rows, setRows] = useState<Row[]>([]);
  const [f, setF] = useState({ kind: "email", value: "", reason: "" });
  const [error, setError] = useState<string | null>(null);
  const load = () => api<{ suppression: Row[] }>("/api/suppression").then((d) => setRows(d.suppression), (e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const add = async () => {
    setError(null);
    try { await api("/api/suppression", { method: "POST", body: f }); setF({ ...f, value: "", reason: "" }); load(); }
    catch (e) { setError((e as Error).message); }
  };
  return (
    <>
      <PageTitle>Suppression ({rows.length})</PageTitle>
      <p className="mb-3 text-sm text-muted-foreground">Append-only. A match hides the contact from every send view and blocks "ready to send". Rows can't be edited or removed.</p>
      <form className="mb-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <NativeSelect aria-label="Kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option>email</option><option>domain</option><option>phone</option></NativeSelect>
        <Input aria-label="Value" placeholder="Email, domain or phone" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} className="w-64" />
        <Input aria-label="Reason" placeholder="Reason (e.g. asked not to be contacted)" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} className="w-80" />
        <Button type="submit" disabled={!f.value.trim() || !f.reason.trim()}>Suppress</Button>
      </form>
      <ErrorLine error={error} />
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Kind</TableHead><TableHead>Value</TableHead><TableHead>Reason</TableHead><TableHead>Added</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((r, i) => <TableRow key={i}><TableCell>{r.kind}</TableCell><TableCell>{r.value}</TableCell><TableCell>{r.reason}</TableCell><TableCell>{r.at.slice(0, 10)}</TableCell></TableRow>)}</TableBody>
        </Table>
      </div>
    </>
  );
}
