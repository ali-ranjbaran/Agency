import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorLine, PageTitle } from "@/components/bits";
import { api, fmtDate, type Lead } from "@/lib/api";

/** Inbound website leads, read-only from the website's `leads` table. */
export default function Leads() {
  const [rows, setRows] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();
  useEffect(() => { api<{ leads: Lead[] }>("/api/leads").then((d) => setRows(d.leads), (e) => setError(e.message)); }, []);
  const promote = async (id: number) => {
    try { const r = await api<{ id: number }>(`/api/leads/${id}/promote`, { method: "POST", body: {} }); nav(`/company/${r.id}`); }
    catch (e) { setError((e as Error).message); }
  };
  return (
    <>
      <PageTitle>Inbound leads ({rows.length})</PageTitle>
      <p className="mb-3 text-sm text-muted-foreground">From the thearkosa.com form. Read-only here. The Mac lead runner still writes the brief and draft reply.</p>
      <ErrorLine error={error} />
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Company</TableHead><TableHead>Name</TableHead><TableHead>Trade / city</TableHead><TableHead>Message</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {rows.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{fmtDate(l.created_at)}</TableCell>
                <TableCell className="font-medium">{l.company}</TableCell>
                <TableCell>{l.name}<div className="text-xs text-muted-foreground">{l.email}{l.phone ? ` · ${l.phone}` : ""}</div></TableCell>
                <TableCell>{[l.trade, l.city].filter(Boolean).join(" · ")}</TableCell>
                <TableCell className="max-w-sm truncate" title={l.message ?? ""}>{l.message}</TableCell>
                <TableCell>{l.status}</TableCell>
                <TableCell>{l.company_id ? <Link className="underline" to={`/company/${l.company_id}`}>Open</Link> : <Button size="sm" variant="outline" onClick={() => promote(l.id)}>Add to pipeline</Button>}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={7} className="text-muted-foreground">No inbound leads yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
