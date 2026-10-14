import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorLine, FitBadge, NativeSelect, PageTitle, StageBadge } from "@/components/bits";
import { AddCompany } from "@/components/AddCompany";
import { api, fmtDate, todayLocal, type Company } from "@/lib/api";
import { SEGMENTS, STAGES, STAGE_LABEL } from "@shared/stages";

type SortKey = "name" | "stage" | "fit" | "next_action_due" | "last_touch_at" | "segment" | "source";
const STAGE_ORDER = Object.fromEntries(STAGES.map((s, i) => [s, i]));

export default function Companies() {
  const [rows, setRows] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [segment, setSegment] = useState("");
  const [source, setSource] = useState("");
  const [casl, setCasl] = useState("");
  const [due, setDue] = useState("");
  const [minFit, setMinFit] = useState("");
  const [showSuppressed, setShowSuppressed] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "next_action_due", dir: 1 });

  const load = () => api<{ companies: Company[] }>("/api/companies").then((d) => setRows(d.companies), (e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const sources = useMemo(() => [...new Set(rows.map((r) => r.source))].sort(), [rows]);
  const view = useMemo(() => {
    const t = todayLocal();
    const week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const needle = q.trim().toLowerCase();
    const val = (r: Company, k: SortKey): string | number => k === "fit" ? r.fit.score : k === "stage" ? STAGE_ORDER[r.stage] ?? 99 : (r[k] ?? "") as string;
    return rows
      .filter((r) => showSuppressed || !r.suppressed)
      .filter((r) => !stage || r.stage === stage)
      .filter((r) => !segment || r.segment === segment)
      .filter((r) => !source || r.source === source)
      .filter((r) => !casl || (casl === "yes" ? !!r.casl_complete : !r.casl_complete))
      .filter((r) => !minFit || r.fit.score >= Number(minFit))
      .filter((r) => !due || (r.next_action_due && (due === "overdue" ? r.next_action_due < t : due === "today" ? r.next_action_due <= t : r.next_action_due <= week)))
      .filter((r) => !needle || [r.name, r.domain, r.city, r.next_action].some((v) => v?.toLowerCase().includes(needle)))
      .sort((a, b) => {
        const x = val(a, sort.key), y = val(b, sort.key);
        if (x === "" && y !== "") return 1;
        if (y === "" && x !== "") return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
      });
  }, [rows, q, stage, segment, source, casl, due, minFit, showSuppressed, sort]);

  const Th = ({ k, children }: { k: SortKey; children: string }) => (
    <TableHead aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button className="font-medium hover:underline" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : k === "fit" ? -1 : 1 }))}>
        {children}{sort.key === k ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </TableHead>
  );

  return (
    <>
      <PageTitle actions={<>
        <AddCompany onAdded={load} />
        <Button variant="outline" render={<a href="/api/export" />}>Export counts (CSV)</Button>
      </>}>Companies ({view.length})</PageTitle>
      <ErrorLine error={error} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input placeholder="Search name, domain, city, action" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" aria-label="Search" />
        <NativeSelect aria-label="Stage" value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">All stages</option>{STAGES.filter((s) => s !== "candidate").map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Segment" value={segment} onChange={(e) => setSegment(e.target.value)}>
          <option value="">All segments</option>{SEGMENTS.map((s) => <option key={s}>{s}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All sources</option>{sources.map((s) => <option key={s}>{s}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="CASL complete" value={casl} onChange={(e) => setCasl(e.target.value)}>
          <option value="">CASL: any</option><option value="yes">CASL complete</option><option value="no">CASL incomplete</option>
        </NativeSelect>
        <NativeSelect aria-label="Next action due" value={due} onChange={(e) => setDue(e.target.value)}>
          <option value="">Due: any</option><option value="overdue">Overdue</option><option value="today">Due today or earlier</option><option value="week">Due within 7 days</option>
        </NativeSelect>
        <Input type="number" min={0} placeholder="Min fit" value={minFit} onChange={(e) => setMinFit(e.target.value)} className="w-24" aria-label="Minimum fit score" />
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={showSuppressed} onChange={(e) => setShowSuppressed(e.target.checked)} /> Show suppressed</label>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <Th k="name">Company</Th><Th k="stage">Stage</Th><Th k="fit">Fit</Th><Th k="next_action_due">Next action</Th>
              <Th k="last_touch_at">Last touch</Th><Th k="segment">Segment</Th><Th k="source">Source</Th><TableHead>CASL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.map((r) => (
              <TableRow key={r.id} className={r.suppressed ? "opacity-50" : ""}>
                <TableCell>
                  <Link to={`/company/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                  <div className="text-xs text-muted-foreground">{[r.domain, r.city].filter(Boolean).join(" · ")}{r.suppressed ? " · suppressed" : ""}</div>
                </TableCell>
                <TableCell><StageBadge stage={r.stage} /></TableCell>
                <TableCell><FitBadge fit={r.fit} /></TableCell>
                <TableCell className="max-w-xs">
                  <div className={r.next_action_due && r.next_action_due < todayLocal() ? "text-destructive" : ""}>{r.next_action_due ?? ""}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.next_action}</div>
                </TableCell>
                <TableCell>{fmtDate(r.last_touch_at)}</TableCell>
                <TableCell>{r.segment}</TableCell>
                <TableCell>{r.source}</TableCell>
                <TableCell>{r.casl_complete ? "complete" : <span className="text-muted-foreground">incomplete</span>}{r.ready_contacts ? ` · ${r.ready_contacts} ready` : ""}</TableCell>
              </TableRow>
            ))}
            {!view.length && <TableRow><TableCell colSpan={8} className="text-muted-foreground">No companies match.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
