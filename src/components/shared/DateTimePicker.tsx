import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, isSameDay, isSameMonth } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function yearRange(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current - 6; y <= current + 1; y++) years.push(y);
  return years;
}
const YEAR_RANGE = yearRange();

/** Parses/serializes the exact same `YYYY-MM-DDTHH:mm` local-time string an `<input type="datetime-
 *  local">` produces, so this is a drop-in replacement wherever that string format is expected —
 *  nothing downstream (the zod schema, the `new Date(values.entry_time)` on submit) needs to change. */
function parseLocal(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toLocalString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The hour/minute box is a real text input, not just a display the arrows push around — click (or
 *  tab) into it, select-all fires automatically, and typing a number then blurring/pressing Enter
 *  commits it directly (clamped to `max`), the same "click in and type" feel Google Calendar's time
 *  field has. The arrow buttons still work as a secondary +/-1 nudge. */
function TimeStepper({ label, value, max, onCommit, onStep }: { label: string; value: number; max: number; onCommit: (v: number) => void; onStep: (delta: number) => void }) {
  const [draft, setDraft] = useState(String(value).padStart(2, "0"));

  useEffect(() => {
    setDraft(String(value).padStart(2, "0"));
  }, [value]);

  function commitDraft(raw: string) {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) {
      setDraft(String(value).padStart(2, "0"));
      return;
    }
    const clamped = Math.max(0, Math.min(max, n));
    onCommit(clamped);
    setDraft(String(clamped).padStart(2, "0"));
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button type="button" onClick={() => onStep(1)} className="text-[var(--color-text-muted)] transition-colors hover:text-[#8b5cf6]" aria-label={`Increase ${label}`}>
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onBlur={(e) => commitDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onStep(1);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            onStep(-1);
          }
        }}
        className="w-10 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] py-1 text-center text-sm font-bold tabular-nums text-[var(--color-text)] outline-none focus:border-[#8b5cf6] focus:ring-1 focus:ring-[#8b5cf6]"
      />
      <button type="button" onClick={() => onStep(-1)} className="text-[var(--color-text-muted)] transition-colors hover:text-[#8b5cf6]" aria-label={`Decrease ${label}`}>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</span>
    </div>
  );
}

/** A fully custom calendar + time picker — replacing the browser/OS-native picker that `<input
 *  type="datetime-local">` shows (that little calendar icon whose tooltip literally reads "Show Local
 *  Date and Time Picker" — it's Windows' own widget, not this app's). Same violet/gradient visual
 *  language as the rest of the app, built on the existing Radix Popover so positioning, click-outside,
 *  and escape-to-close all work correctly without a hand-rolled overlay. */
export function DateTimePicker({
  value,
  onChange,
  placeholder = "Select date & time",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseLocal(value);
  const [viewDate, setViewDate] = useState(() => selected ?? new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 });
    const arr: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) arr.push(d);
    return arr;
  }, [viewDate]);

  function commit(next: Date) {
    onChange(toLocalString(next));
  }

  function selectDay(day: Date) {
    const base = selected ?? new Date();
    const next = new Date(day);
    next.setHours(base.getHours(), base.getMinutes(), 0, 0);
    commit(next);
  }

  function adjustTime(field: "hour" | "minute", delta: number) {
    const base = selected ?? new Date();
    const next = new Date(base);
    if (field === "hour") next.setHours((next.getHours() + delta + 24) % 24);
    else next.setMinutes((next.getMinutes() + delta + 60) % 60);
    commit(next);
  }

  function setTimeField(field: "hour" | "minute", val: number) {
    const base = selected ?? new Date();
    const next = new Date(base);
    if (field === "hour") next.setHours(val);
    else next.setMinutes(val);
    commit(next);
  }

  function setNow() {
    const now = new Date();
    setViewDate(now);
    commit(now);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setViewDate(selected ?? new Date());
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm text-[var(--color-text)] transition-colors hover:border-[#8b5cf6]/50 focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]"
        >
          <span className={cn(!selected && "text-[var(--color-text-muted)]")}>{selected ? format(selected, "MMM d, yyyy · HH:mm") : placeholder}</span>
          <CalendarIcon className="h-4 w-4 text-[#8b5cf6]" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] space-y-3 p-3" align="start">
        <div className="flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => setViewDate((d) => addMonths(d, -1))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[#8b5cf6]/10 hover:text-[var(--color-text)]"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1 text-sm font-semibold text-[var(--color-text)]">
            <span>{format(viewDate, "MMMM")}</span>
            <select
              value={viewDate.getFullYear()}
              onChange={(e) =>
                setViewDate((d) => {
                  const nd = new Date(d);
                  nd.setFullYear(Number(e.target.value));
                  return nd;
                })
              }
              className="cursor-pointer rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-[var(--color-text)] hover:border-[var(--color-border)] focus:outline-none"
            >
              {YEAR_RANGE.map((y) => (
                <option key={y} value={y} className="bg-[var(--color-surface)]">
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setViewDate((d) => addMonths(d, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[#8b5cf6]/10 hover:text-[var(--color-text)]"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {days.map((day) => {
            const inMonth = isSameMonth(day, viewDate);
            const isSelected = selected && isSameDay(day, selected);
            const isToday = isSameDay(day, new Date());
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => selectDay(day)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors",
                  !inMonth && "text-[var(--color-text-muted)] opacity-40",
                  inMonth && !isSelected && "text-[var(--color-text)] hover:bg-[#8b5cf6]/15",
                  isSelected && "bg-[#8b5cf6] font-bold text-white",
                  !isSelected && isToday && "ring-1 ring-[#8b5cf6]/50",
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-3 border-t border-[var(--color-border)] pt-3">
          <TimeStepper
            label="Hour"
            value={selected ? selected.getHours() : 0}
            max={23}
            onCommit={(v) => setTimeField("hour", v)}
            onStep={(d) => adjustTime("hour", d)}
          />
          <span className="text-lg font-bold text-[var(--color-text-muted)]">:</span>
          <TimeStepper
            label="Min"
            value={selected ? selected.getMinutes() : 0}
            max={59}
            onCommit={(v) => setTimeField("minute", v)}
            onStep={(d) => adjustTime("minute", d)}
          />
          <button
            type="button"
            onClick={setNow}
            className="ml-2 self-center rounded-full border border-[#8b5cf6]/30 px-2.5 py-1 text-[11px] font-semibold text-[#8b5cf6] transition-colors hover:bg-[#8b5cf6]/10"
          >
            Now
          </button>
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="w-full rounded-md bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9] py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          Done
        </button>
      </PopoverContent>
    </Popover>
  );
}
