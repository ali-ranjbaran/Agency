"use client";
import { useId, useState } from "react";

export type CalcValues = { missedPerWeek: number; bookRate: number; jobValue: number };
export const CALC_EVENT = "arkosa:calc";

const WEEKS_PER_MONTH = 52 / 12;
const money = (n: number) => n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

function Slider(props: {
  label: string; hint: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; format: (v: number) => string;
}) {
  const id = useId();
  const text = props.format(props.value);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="font-semibold">{props.label}</label>
        <output htmlFor={id} className="text-title font-semibold tabular-nums">{text}</output>
      </div>
      <p id={`${id}-h`} className="mt-1 text-sm text-muted">{props.hint}</p>
      {/* Pinned to the bottom so the three sliders line up when labels wrap differently. */}
      <div className="mt-auto pt-4">
        <input
          id={id} type="range" aria-describedby={`${id}-h`} aria-valuetext={text}
          min={props.min} max={props.max} step={props.step ?? 1}
          value={props.value} onChange={(e) => props.onChange(Number(e.target.value))}
          className="h-6 w-full cursor-pointer accent-accent"
        />
        <div aria-hidden="true" className="mt-1 flex justify-between text-sm text-muted tabular-nums">
          <span>{props.format(props.min)}</span><span>{props.format(props.max)}</span>
        </div>
      </div>
    </div>
  );
}

export function MissedCallCalculator({ canSend }: { canSend: boolean }) {
  const [missed, setMissed] = useState(5);
  const [rate, setRate] = useState(40);
  const [value, setValue] = useState(350);

  const v: CalcValues = { missedPerWeek: missed, bookRate: rate, jobValue: value };
  const jobsPerMonth = v.missedPerWeek * WEEKS_PER_MONTH * (v.bookRate / 100);
  const perMonth = jobsPerMonth * v.jobValue;
  const rounded = Math.round(perMonth);

  const send = () => {
    window.dispatchEvent(new CustomEvent<CalcValues>(CALC_EVENT, { detail: v }));
    document.getElementById("intake")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="grid gap-[clamp(32px,5vw,64px)] md:grid-cols-[3fr_2fr] md:items-end">
      <div className="grid gap-8 sm:grid-cols-3">
        <Slider label="Missed calls a week" hint="Calls nobody picked up." value={missed} onChange={setMissed} min={0} max={60} format={String} />
        <Slider label="Would have booked" hint="Out of every 100 of those callers." value={rate} onChange={setRate} min={0} max={100} step={5} format={(n) => `${n}%`} />
        <Slider label="Average job" hint="What a typical job bills." value={value} onChange={setValue} min={50} max={10000} step={50} format={money} />
      </div>
      <div className="border-t-2 border-fg pt-6" aria-live="polite">
        <p className="label text-accent-ink">Work going to someone else</p>
        <p className="mt-2 text-h2 font-semibold tabular-nums tracking-tight">
          <span className="text-accent-ink">
            {rounded > 0 && <><span aria-hidden="true">&minus;</span><span className="sr-only">minus </span></>}
            {money(rounded)}
          </span>
          <span className="text-title text-muted"> /month</span>
        </p>
        <p className="mt-2 text-sm text-muted">
          About {jobsPerMonth.toFixed(1)} jobs a month. Your numbers, your estimate.
        </p>
        {canSend && (
          <button type="button" onClick={send} className="btn btn-sm mt-6 cursor-pointer">Send me these numbers</button>
        )}
      </div>
    </div>
  );
}
