import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ErrorLine, NativeSelect, PageTitle } from "@/components/bits";
import { api, fmtDate } from "@/lib/api";
import { renderMarkdown } from "@/lib/markdown";
import { KIND_LABEL, headings, lineDiff, type Decision, type Doc } from "@shared/docs";

type DocRow = { path: string; title: string; kind: string; sha256: string; commit: string | null; dirty: boolean; placeholders: number; lawyer: number;
  status: string; changed_since_approved: boolean; open_comments: number };
type Signoff = { decision_id: string; decision_sha: string; choice: string; note: string | null; reviewer: string; at: string };
type DecisionRow = Decision & { signoff: Signoff | null; changed_since_signoff: boolean };
type Comment = { id: number; content_sha: string; anchor: string; body: string; reviewer: string; resolved: number; at: string };
type Item = { doc: Doc; status: string; changed_since_approved: boolean; last_approved: { content_sha: string; at: string; content: string | null } | null;
  history: { content_sha: string; status: string; note: string | null; reviewer: string; at: string }[]; comments: Comment[] };

const STATUS_LABEL: Record<string, string> = { unread: "unread", in_review: "in review", changes_requested: "changes requested", approved: "approved" };
export const StatusBadge = ({ status }: { status: string }) => (
  <Badge variant={status === "approved" ? "default" : status === "changes_requested" ? "destructive" : "secondary"}>{STATUS_LABEL[status] ?? status}</Badge>
);
const Markers = ({ p, l }: { p: number; l: number }) => (
  <>{p > 0 && <Badge variant="outline">{p} placeholder{p === 1 ? "" : "s"}</Badge>}{l > 0 && <Badge variant="outline" className="border-amber-500">{l} [LAWYER]</Badge>}</>
);

function DocList({ docs }: { docs: DocRow[] }) {
  const groups = useMemo(() => {
    const m = new Map<string, DocRow[]>();
    for (const d of docs) m.set(d.kind, [...(m.get(d.kind) ?? []), d]);
    const order = Object.keys(KIND_LABEL);
    return [...m.entries()].sort(([a], [b]) => (order.indexOf(a) + 99 * +(order.indexOf(a) < 0)) - (order.indexOf(b) + 99 * +(order.indexOf(b) < 0)));
  }, [docs]);
  return (
    <div className="space-y-4">
      {groups.map(([kind, rows]) => (
        <Card key={kind}>
          <CardHeader><CardTitle>{KIND_LABEL[kind] ?? kind} ({rows.length})</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {rows.map((d) => (
                <li key={d.path} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <Link to={`/documents/view?path=${encodeURIComponent(d.path)}`} className="font-medium hover:underline">{d.title}</Link>
                  <span className="text-xs text-muted-foreground">{d.path}</span>
                  <span className="flex-1" />
                  <StatusBadge status={d.status} />
                  {d.changed_since_approved && <Badge variant="destructive">changed since approved</Badge>}
                  <Markers p={d.placeholders} l={d.lawyer} />
                  {d.open_comments > 0 && <Badge variant="outline">{d.open_comments} open comment{d.open_comments === 1 ? "" : "s"}</Badge>}
                  {d.dirty && <Badge variant="outline">not committed</Badge>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
      {!docs.length && <p className="text-sm text-muted-foreground">No documents in this build.</p>}
    </div>
  );
}

function Decisions({ rows, onDone }: { rows: DecisionRow[]; onDone: () => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rows.map((d) => <DecisionCard key={d.id} d={d} onDone={onDone} />)}
    </div>
  );
}

function DecisionCard({ d, onDone }: { d: DecisionRow; onDone: () => void }) {
  const [choice, setChoice] = useState("accept");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const strip = (s: string) => s.replace(/\*\*/g, "").replace(/\*/g, "");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">{d.id} · {strip(d.decision)} <span className="text-xs font-normal text-muted-foreground">{d.section}</span></CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {d.problem && <p><span className="text-muted-foreground">Problem: </span>{strip(d.problem)}</p>}
        <p><span className="text-muted-foreground">Recommended default: </span>{strip(d.recommended)}</p>
        <p className="text-xs text-muted-foreground">Affects {d.affects}</p>
        {d.signoff ? (
          <p>Signed: <Badge variant={d.signoff.choice === "accept" ? "default" : "secondary"}>{d.signoff.choice}</Badge> {d.signoff.note ?? ""} <span className="text-xs text-muted-foreground">{d.signoff.reviewer}, {fmtDate(d.signoff.at)}</span>
            {d.changed_since_signoff && <Badge variant="destructive" className="ml-1">text changed since sign-off</Badge>}</p>
        ) : <p className="text-muted-foreground">Not signed off.</p>}
        <div className="flex flex-wrap items-start gap-2 border-t pt-2">
          <NativeSelect aria-label={`Choice for ${d.id}`} value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="accept">Accept</option><option value="reject">Reject</option><option value="amend">Amend</option>
          </NativeSelect>
          <Textarea aria-label={`Note for ${d.id}`} placeholder={choice === "accept" ? "Note (optional)" : "Note (required)"} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-8 flex-1" />
          <Button size="sm" disabled={choice !== "accept" && !note.trim()} onClick={async () => {
            setError(null);
            try { await api("/api/decisions/signoff", { method: "POST", body: { id: d.id, sha: d.sha256, choice, note } }); setNote(""); onDone(); } catch (e) { setError((e as Error).message); }
          }}>Sign off</Button>
        </div>
        <ErrorLine error={error} />
      </CardContent>
    </Card>
  );
}

export default function Documents() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "decisions" ? "decisions" : "docs";
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = () => api<{ docs: DocRow[]; decisions: DecisionRow[] }>("/api/docs").then((d) => { setDocs(d.docs); setDecisions(d.decisions); }, (e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const lawyer = docs.reduce((n, d) => n + d.lawyer, 0);
  return (
    <>
      <PageTitle actions={<>
        <Button size="sm" variant={tab === "docs" ? "default" : "outline"} onClick={() => setParams({})}>Documents ({docs.length})</Button>
        <Button size="sm" variant={tab === "decisions" ? "default" : "outline"} onClick={() => setParams({ tab: "decisions" })}>Decisions ({decisions.filter((d) => !d.signoff).length} unsigned)</Button>
      </>}>Documents</PageTitle>
      <p className="mb-3 text-sm text-muted-foreground">Git is the source; edits happen in the repo. This page holds review state only. An approval covers one exact version: when the text changes it goes back to review. {lawyer} [LAWYER] tags open.</p>
      <ErrorLine error={error} />
      {tab === "docs" ? <DocList docs={docs} /> : <Decisions rows={decisions} onDone={load} />}
    </>
  );
}

export function DocumentView() {
  const [params] = useSearchParams();
  const path = params.get("path") ?? "";
  const [item, setItem] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [anchor, setAnchor] = useState("top");
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");
  const load = () => api<Item>(`/api/docs/item?path=${encodeURIComponent(path)}`).then(setItem, (e) => setError(e.message));
  useEffect(() => { load(); }, [path]);
  const html = useMemo(() => (item ? renderMarkdown(item.doc.content) : ""), [item]);
  const toc = useMemo(() => (item ? headings(item.doc.content) : []), [item]);
  const act = async (f: () => Promise<unknown>) => { setError(null); try { await f(); await load(); } catch (e) { setError((e as Error).message); } };
  if (!item) return <><PageTitle>Document</PageTitle><ErrorLine error={error} /></>;
  const { doc } = item;
  const open = item.comments.filter((c) => !c.resolved);
  const ph = (doc.content.match(/\{[A-Z][A-Z0-9_]*\}/g) ?? []).length, lw = (doc.content.match(/\[LAWYER\]/g) ?? []).length;
  const review = (status: string) => act(() => api("/api/docs/review", { method: "POST", body: { path: doc.path, sha: doc.sha256, status, note } }).then(() => setNote("")));

  return (
    <>
      <PageTitle actions={<Link to="/documents" className="text-sm underline">All documents</Link>}>{doc.title}</PageTitle>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge status={item.status} />
        {item.changed_since_approved && <Badge variant="destructive">changed since approved {fmtDate(item.last_approved?.at)}</Badge>}
        <Markers p={ph} l={lw} />
        <span className="text-xs text-muted-foreground">{doc.path} · sha {doc.sha256.slice(0, 10)} · commit {doc.commit?.slice(0, 7) ?? "none"}{doc.dirty ? " (not committed)" : ""}</span>
      </div>
      <ErrorLine error={error} />
      <div className="grid gap-4 lg:grid-cols-[14rem_1fr_20rem]">
        <nav aria-label="Contents" className="text-sm lg:sticky lg:top-2 lg:self-start">
          <div className="mb-1 font-medium">Contents</div>
          <ul className="space-y-0.5">{toc.map((h) => (
            <li key={h.anchor} style={{ paddingLeft: `${(h.level - 1) * 0.6}rem` }}>
              <a href={`#${h.anchor}`} className="hover:underline">{h.text.replace(/\*\*|`/g, "")}</a>
              {open.some((c) => c.anchor === h.anchor) && <span className="ml-1 text-xs text-muted-foreground">({open.filter((c) => c.anchor === h.anchor).length})</span>}
            </li>
          ))}</ul>
        </nav>
        <article className="doc-body min-w-0">
          {item.changed_since_approved && item.last_approved?.content != null && (
            <div className="mb-3"><Button size="sm" variant="outline" onClick={() => setShowDiff(!showDiff)}>{showDiff ? "Hide" : "Show"} diff against last approved</Button></div>
          )}
          {showDiff && item.last_approved?.content != null ? (
            <pre aria-label="Diff against last approved" className="overflow-x-auto rounded-md border p-2 text-xs">{lineDiff(item.last_approved.content, doc.content).map((l, i) => (
              <div key={i} className={l.op === "+" ? "bg-green-500/15" : l.op === "-" ? "bg-red-500/15" : "text-muted-foreground"}>{l.op} {l.line}</div>
            ))}</pre>
          ) : <div dangerouslySetInnerHTML={{ __html: html }} />}
        </article>
        <aside className="space-y-3 text-sm">
          <Card>
            <CardHeader><CardTitle>Review</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Textarea aria-label="Review note" placeholder="Note (required to request changes)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => review("approved")}>Approve this version</Button>
                <Button size="sm" variant="outline" disabled={!note.trim()} onClick={() => review("changes_requested")}>Request changes</Button>
                {item.status === "unread" && <Button size="sm" variant="ghost" onClick={() => review("in_review")}>Mark in review</Button>}
              </div>
              {item.history.length > 0 && <ul className="space-y-1 border-t pt-2 text-xs">{item.history.slice(-5).reverse().map((h, i) => (
                <li key={i}>{STATUS_LABEL[h.status]} · {h.reviewer} · {fmtDate(h.at)}{h.content_sha !== doc.sha256 ? " (older version)" : ""}{h.note ? `: ${h.note}` : ""}</li>
              ))}</ul>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Comments ({open.length} open)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <NativeSelect aria-label="Heading" value={anchor} onChange={(e) => setAnchor(e.target.value)} className="w-full">
                <option value="top">Whole document</option>
                {toc.map((h) => <option key={h.anchor} value={h.anchor}>{h.text.replace(/\*\*|`/g, "")}</option>)}
              </NativeSelect>
              <Textarea aria-label="Comment" placeholder="Comment on this heading" value={comment} onChange={(e) => setComment(e.target.value)} />
              <Button size="sm" disabled={!comment.trim()} onClick={() => act(() => api("/api/docs/comments", { method: "POST", body: { path: doc.path, sha: doc.sha256, anchor, body: comment } }).then(() => setComment("")))}>Add comment</Button>
              <ul className="space-y-2 border-t pt-2">{item.comments.map((c) => (
                <li key={c.id} className={c.resolved ? "opacity-60" : ""}>
                  <a href={`#${c.anchor}`} className="text-xs underline">#{c.anchor}</a>{c.content_sha !== doc.sha256 && <span className="text-xs text-muted-foreground"> (older version)</span>}
                  <p>{c.body}</p>
                  <span className="text-xs text-muted-foreground">{c.reviewer} · {fmtDate(c.at)}</span>
                  {!c.resolved && <Button size="sm" variant="ghost" className="ml-1 h-6" onClick={() => act(() => api("/api/docs/comments", { method: "PATCH", body: { id: c.id, resolved: true } }))}>Resolve</Button>}
                </li>
              ))}</ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
