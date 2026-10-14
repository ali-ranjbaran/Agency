import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type UniverseRow = { search_key: string; found: number; in_review: number; approved: number; rejected: number; contacted: number };

/** Per trade + city: when "found" stops growing across re-runs and everything is approved,
 *  rejected or contacted, the universe is exhausted (plan v4, decision D2). */
export function Universe({ rows }: { rows: UniverseRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="mb-4 overflow-x-auto rounded-md border">
      <Table>
        <TableHeader><TableRow><TableHead>Universe (trade · city)</TableHead><TableHead>Found</TableHead><TableHead>In review</TableHead><TableHead>Approved</TableHead><TableHead>Rejected</TableHead><TableHead>Contacted</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => {
            const [trade, city] = r.search_key.split("|");
            return (
              <TableRow key={r.search_key}>
                <TableCell className="font-medium">{trade.toUpperCase()} · {city.replace(/\b\w/g, (m) => m.toUpperCase())}</TableCell>
                <TableCell>{r.found}</TableCell><TableCell>{r.in_review}</TableCell><TableCell>{r.approved}</TableCell><TableCell>{r.rejected}</TableCell><TableCell>{r.contacted}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
