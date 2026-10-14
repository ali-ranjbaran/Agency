import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorLine, FitBadge, PageTitle, StageBadge } from "@/components/bits";
import { api, fmtDate, type Company, type Lead } from "@/lib/api";
import { POSSIBLE_CLIENT_STAGES } from "@shared/stages";

/** Saved view: conversation and beyond (still open), plus inbound leads not yet in the pipeline,
 *  sorted by next_action_due (a lead's date is the day it came in). */
export default function PossibleClients() {
  const [rows, setRows] = useState<({ kind: "company"; c: Company; due: string } | { kind: "lead"; l: Lead; due: string })[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([api<{ companies: Company[] }>("/api/companies"), api<{ leads: Lead[] }>("/api/leads")]).then(([a, b]) => {
      const cs = a.companies.filter((c) => (POSSIBLE_CLIENT_STAGES as string[]).includes(c.stage) && !c.suppressed)
        .map((c) => ({ kind: "company" as const, c, due: c.next_action_due ?? "9999" }));
      const ls = b.leads.filter((l) => !l.company_id && l.status !== "archived").map((l) => ({ kind: "lead" as const, l, due: fmtDate(l.created_at) }));
      setRows([...cs, ...ls].sort((x, y) => x.due.localeCompare(y.due)));
    }, (e) => setError(e.message));
  }, []);
  return (
    <>
      <PageTitle>Possible clients ({rows.length})</PageTitle>
      <ErrorLine error={error} />
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Due</TableHead><TableHead>Name</TableHead><TableHead>Stage</TableHead><TableHead>Fit</TableHead><TableHead>Next action</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => r.kind === "company" ? (
              <TableRow key={`c${r.c.id}`}>
                <TableCell>{r.c.next_action_due ?? ""}</TableCell>
                <TableCell><Link className="font-medium hover:underline" to={`/company/${r.c.id}`}>{r.c.name}</Link></TableCell>
                <TableCell><StageBadge stage={r.c.stage} /></TableCell>
                <TableCell><FitBadge fit={r.c.fit} /></TableCell>
                <TableCell>{r.c.next_action}</TableCell>
              </TableRow>
            ) : (
              <TableRow key={`l${r.l.id}`}>
                <TableCell>{r.due}</TableCell>
                <TableCell><span className="font-medium">{r.l.company}</span> <span className="text-muted-foreground">({r.l.name})</span></TableCell>
                <TableCell>Inbound lead</TableCell>
                <TableCell>-</TableCell>
                <TableCell><Link className="underline" to="/leads">Reply / add to pipeline</Link></TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={5} className="text-muted-foreground">Nothing at conversation stage or beyond, and no open inbound leads.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
