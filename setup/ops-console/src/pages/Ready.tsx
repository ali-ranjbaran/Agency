import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorLine, PageTitle } from "@/components/bits";
import { api } from "@/lib/api";

type Row = { id: number; name: string | null; title: string | null; email: string; email_flags: string; casl_verified_at: string; company_id: number; company: string; stage: string };

/** The send view. Suppressed contacts and companies never appear here. Nothing sends from the console. */
export default function Ready() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<{ contacts: Row[] }>("/api/ready").then((d) => setRows(d.contacts), (e) => setError(e.message)); }, []);
  return (
    <>
      <PageTitle>Ready to send ({rows.length})</PageTitle>
      <p className="mb-3 text-sm text-muted-foreground">Contacts with all four CASL fields, a checked source page, and nothing suppressed. Load them into Instantly yourself; the console never sends.</p>
      <ErrorLine error={error} />
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Contact</TableHead><TableHead>Email</TableHead><TableHead>Flags</TableHead><TableHead>Checked</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Link className="font-medium hover:underline" to={`/company/${r.company_id}`}>{r.company}</Link></TableCell>
                <TableCell>{r.name}{r.title ? `, ${r.title}` : ""}</TableCell>
                <TableCell>{r.email}</TableCell>
                <TableCell>{r.email_flags.replace("role", "role account")}</TableCell>
                <TableCell>{r.casl_verified_at.slice(0, 10)}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={5} className="text-muted-foreground">No contacts ready yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
