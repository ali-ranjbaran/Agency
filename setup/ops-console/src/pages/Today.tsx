import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorLine, FitBadge, PageTitle } from "@/components/bits";
import { api, fmtDate, type Company, type Lead } from "@/lib/api";

type TodayData = {
  date: string; calls_due: Company[]; follow_ups_due: Company[]; new_leads: Lead[];
  docs: { awaiting_review: number; changed_since_approved: number; open_lawyer: number; decisions_unsigned: number };
  demo_calls: { at: string; last4: string; sms_sent: number; reply_sent: number; company: { id: number; name: string } | null }[];
};

function DueList({ rows }: { rows: Company[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nothing due.</p>;
  return (
    <ul className="divide-y">
      {rows.map((c) => (
        <li key={c.id} className="flex items-center gap-3 py-2 text-sm">
          <FitBadge fit={c.fit} />
          <div className="min-w-0 flex-1">
            <Link to={`/company/${c.id}`} className="font-medium underline-offset-2 hover:underline">{c.name}</Link>
            <div className="truncate text-muted-foreground">{c.next_action || "No action written"}</div>
          </div>
          <span className={c.next_action_due! < (new Date().toISOString().slice(0, 10)) ? "text-destructive" : ""}>{c.next_action_due}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Today() {
  const [d, setD] = useState<TodayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<TodayData>("/api/today").then(setD, (e) => setError(e.message)); }, []);
  return (
    <>
      <PageTitle>Today{d ? `, ${d.date}` : ""}</PageTitle>
      <ErrorLine error={error} />
      {d && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader><CardTitle>Calls due ({d.calls_due.length})</CardTitle></CardHeader><CardContent><DueList rows={d.calls_due} /></CardContent></Card>
          <Card><CardHeader><CardTitle>Follow-ups due ({d.follow_ups_due.length})</CardTitle></CardHeader><CardContent><DueList rows={d.follow_ups_due} /></CardContent></Card>
          <Card>
            <CardHeader><CardTitle>New inbound leads ({d.new_leads.length})</CardTitle></CardHeader>
            <CardContent>
              {d.new_leads.length ? (
                <ul className="divide-y text-sm">
                  {d.new_leads.map((l) => (
                    <li key={l.id} className="py-2"><span className="font-medium">{l.company}</span> · {l.name} · {l.trade ?? ""} {l.city ?? ""}
                      <span className="ml-2 text-muted-foreground">{fmtDate(l.created_at)}</span> · <Link to="/leads" className="underline">open</Link></li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">None in the last 14 days.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                <li>{d.docs.awaiting_review} awaiting review</li>
                <li className={d.docs.changed_since_approved ? "text-destructive" : ""}>{d.docs.changed_since_approved} changed since approval</li>
                <li>{d.docs.open_lawyer} open [LAWYER] tags</li>
                <li>{d.docs.decisions_unsigned} decisions unsigned · <Link to="/documents?tab=decisions" className="underline">sign off</Link></li>
              </ul>
              <Link to="/documents" className="mt-2 inline-block text-sm underline">Open documents</Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Demo-line calls, last 7 days ({d.demo_calls.length})</CardTitle></CardHeader>
            <CardContent>
              {d.demo_calls.length ? (
                <ul className="divide-y text-sm">
                  {d.demo_calls.map((c, i) => (
                    <li key={i} className="py-2">
                      …{c.last4} · {c.at.slice(0, 16)} · text {c.sms_sent ? "sent" : "not sent"}{c.reply_sent ? " · replied" : ""}
                      {c.company ? <> · <Link to={`/company/${c.company.id}`} className="underline">{c.company.name}</Link></> : <span className="text-muted-foreground"> · no matching company</span>}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No demo calls (or the demo line isn't live yet).</p>}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
