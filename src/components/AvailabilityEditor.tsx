"use client";

import { useState } from "react";

type Window = { start: string; end: string };
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Weekly windows per ISO weekday (1 = Monday). Submits as start_N / end_N fields. */
export function AvailabilityEditor({ initial }: { initial: Record<number, Window[]> }) {
  const [days, setDays] = useState<Record<number, Window[]>>(initial);

  const update = (d: number, fn: (w: Window[]) => Window[]) => setDays((prev) => ({ ...prev, [d]: fn(prev[d] ?? []) }));

  return (
    <div className="divide-y divide-line">
      {DAYS.map((label, i) => {
        const d = i + 1;
        const windows = days[d] ?? [];
        return (
          <div key={d} className="flex flex-wrap items-start gap-4 py-3">
            <label className="flex w-32 items-center gap-2 pt-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={windows.length > 0}
                onChange={(e) => update(d, () => (e.target.checked ? [{ start: "18:00", end: "20:00" }] : []))}
              />
              {label}
            </label>
            <div className="flex-1 space-y-2">
              {windows.length === 0 && <p className="pt-2 text-sm text-muted">Unavailable</p>}
              {windows.map((w, j) => (
                <div key={j} className="flex items-center gap-2">
                  <input
                    type="time"
                    name={`start_${d}`}
                    value={w.start}
                    step={900}
                    onChange={(e) => update(d, (ws) => ws.map((x, k) => (k === j ? { ...x, start: e.target.value } : x)))}
                    className="input w-32"
                    required
                  />
                  <span className="text-muted">–</span>
                  <input
                    type="time"
                    name={`end_${d}`}
                    value={w.end}
                    step={900}
                    onChange={(e) => update(d, (ws) => ws.map((x, k) => (k === j ? { ...x, end: e.target.value } : x)))}
                    className="input w-32"
                    required
                  />
                  <button
                    type="button"
                    aria-label="Remove window"
                    onClick={() => update(d, (ws) => ws.filter((_, k) => k !== j))}
                    className="px-2 text-muted hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {windows.length > 0 && (
                <button
                  type="button"
                  onClick={() => update(d, (ws) => [...ws, { start: "12:00", end: "13:00" }])}
                  className="text-xs text-accent"
                >
                  + Add window
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
