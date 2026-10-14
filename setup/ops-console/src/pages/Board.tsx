import { useEffect, useState } from "react";
import { Link } from "react-router";
import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ErrorLine, FitBadge, PageTitle } from "@/components/bits";
import { api, type Company } from "@/lib/api";
import { BOARD_STAGES, STAGE_LABEL, type Stage } from "@shared/stages";
import { cn } from "@/lib/utils";

function Card({ c }: { c: Company }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn("cursor-grab rounded-md border bg-card p-2 text-sm shadow-xs", isDragging && "z-10 opacity-80 shadow-md")}>
      <div className="flex items-start justify-between gap-2">
        <Link to={`/company/${c.id}`} className="font-medium hover:underline" onPointerDown={(e) => e.stopPropagation()}>{c.name}</Link>
        <span onPointerDown={(e) => e.stopPropagation()}><FitBadge fit={c.fit} /></span>
      </div>
      {c.next_action_due && <div className="mt-1 text-xs text-muted-foreground">{c.next_action_due} · {c.next_action}</div>}
    </div>
  );
}

function Column({ stage, rows }: { stage: Stage; rows: Company[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section ref={setNodeRef} aria-label={STAGE_LABEL[stage]} className={cn("flex w-60 shrink-0 flex-col gap-2 rounded-lg bg-muted/50 p-2", isOver && "ring-2 ring-ring")}>
      <h2 className="px-1 text-sm font-semibold">{STAGE_LABEL[stage]} <span className="font-normal text-muted-foreground">{rows.length}</span></h2>
      {rows.map((c) => <Card key={c.id} c={c} />)}
    </section>
  );
}

export default function Board() {
  const [rows, setRows] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const load = () => api<{ companies: Company[] }>("/api/companies").then((d) => setRows(d.companies.filter((c) => !c.suppressed)), (e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const onDragEnd = async (e: DragEndEvent) => {
    const id = Number(e.active.id);
    const to = e.over?.id as Stage | undefined;
    const c = rows.find((r) => r.id === id);
    if (!c || !to || c.stage === to) return;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, stage: to } : r)));
    try { await api(`/api/companies/${id}/stage`, { method: "POST", body: { stage: to } }); }
    catch (err) { setError((err as Error).message); load(); }
  };

  return (
    <>
      <PageTitle>Board</PageTitle>
      <p className="mb-3 text-sm text-muted-foreground">Drag a card to another column. Each move is logged as a touch on the company.</p>
      <ErrorLine error={error} />
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {BOARD_STAGES.map((s) => <Column key={s} stage={s} rows={rows.filter((r) => r.stage === s)} />)}
        </div>
      </DndContext>
    </>
  );
}
