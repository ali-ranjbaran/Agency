import type { ReactNode, SelectHTMLAttributes } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Fit } from "@/lib/api";
import { STAGE_LABEL, type Stage } from "@shared/stages";
import { FIT_MAX } from "@shared/fit-score";
import { cn } from "@/lib/utils";

/** The fit number is never a black box: hover (or focus) shows every rule that scored. */
export function FitBadge({ fit }: { fit: Fit }) {
  return (
    <Tooltip>
      <TooltipTrigger className="rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ring-1 ring-border hover:bg-muted focus-visible:outline-2" aria-label={`Fit ${fit.score}, show breakdown`}>
        {fit.score}
      </TooltipTrigger>
      <TooltipContent side="right" className="block max-w-sm text-left">
        <div className="font-semibold">Fit {fit.score} of {FIT_MAX}{fit.override != null ? " (set by hand)" : ""}</div>
        {fit.parts.length ? (
          <ul className="mt-1 space-y-0.5">{fit.parts.map((p) => <li key={p.id}>+{p.points} {p.label}</li>)}</ul>
        ) : <div className="mt-1">No rule scored yet (no snapshot or signals).</div>}
        <div className="mt-1 opacity-70">Rules: shared/fit-score.ts</div>
      </TooltipContent>
    </Tooltip>
  );
}

export const StageBadge = ({ stage }: { stage: string }) => (
  <Badge variant={stage === "won" ? "default" : stage === "lost" || stage === "not_now" ? "outline" : "secondary"}>{STAGE_LABEL[stage as Stage] ?? stage}</Badge>
);

export function NativeSelect({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select {...p} className={cn("h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring", className)}>
      {children}
    </select>
  );
}

export const YesNo = ({ v, yes = "yes", no = "no" }: { v: number | null | undefined; yes?: string; no?: string }) =>
  v == null ? <span className="text-muted-foreground">not measured</span> : v ? <span>{yes}</span> : <span className="font-medium text-destructive">{no}</span>;

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-semibold tracking-tight">{children}</h1>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const ErrorLine = ({ error }: { error: string | null }) => (error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null);
