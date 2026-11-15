"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { bookSlot } from "@/app/actions/booking";

type SessionOption = { id: string; title: string; durationMinutes: number; price: string };
type SlotsResponse = { tz: string; days: Record<string, string[]> };
type Loaded = SlotsResponse & { key: string };
const noopSubscribe = () => () => {};

function viewerTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function BookingWidget({ mentorName, sessionTypes }: { mentorName: string; sessionTypes: SessionOption[] }) {
  const [sessionTypeId, setSessionTypeId] = useState(sessionTypes[0]!.id);
  const tz = useSyncExternalStore(noopSubscribe, viewerTz, () => "UTC");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [reloadKey, setReloadKey] = useState(0);

  const session = sessionTypes.find((s) => s.id === sessionTypeId)!;

  const requestKey = `${sessionTypeId}|${tz}|${reloadKey}`;
  const loading = loaded?.key !== requestKey;
  const data = loaded;

  useEffect(() => {
    let cancelled = false;
    const key = `${sessionTypeId}|${tz}|${reloadKey}`;
    fetch(`/api/slots?sessionTypeId=${encodeURIComponent(sessionTypeId)}&tz=${encodeURIComponent(tz)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: SlotsResponse) => {
        if (cancelled) return;
        setLoaded({ ...d, key });
        setDay((prev) => (prev && d.days[prev] ? prev : (Object.keys(d.days).sort()[0] ?? null)));
      })
      .catch(() => {
        if (!cancelled) setLoaded({ tz, days: {}, key });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionTypeId, tz, reloadKey]);

  const dayKeys = useMemo(() => Object.keys(data?.days ?? {}).sort(), [data]);
  const fmtDay = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, d!, 12)).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  };
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });

  function submit(form: FormData) {
    if (!slot) return;
    setError(null);
    startTransition(async () => {
      const res = await bookSlot({
        sessionTypeId,
        startIso: slot,
        menteeName: String(form.get("name") ?? ""),
        menteeEmail: String(form.get("email") ?? ""),
        menteeNotes: String(form.get("notes") ?? ""),
      });
      if ("error" in res) {
        setError(res.error);
        setSlot(null);
        setReloadKey((k) => k + 1);
        return;
      }
      window.location.href = res.redirectUrl;
    });
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold">Book {mentorName.split(" ")[0]}</h2>

      {sessionTypes.length > 1 && (
        <div className="mt-4 space-y-2">
          {sessionTypes.map((s) => (
            <label
              key={s.id}
              className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                s.id === sessionTypeId ? "border-accent bg-accent-soft/40" : "border-line"
              }`}
            >
              <span className="flex items-center gap-2">
                <input type="radio" name="st" checked={s.id === sessionTypeId} onChange={() => {
                    setSessionTypeId(s.id);
                    setSlot(null);
                  }} />
                {s.title}
              </span>
              <span className="font-medium">{s.price}</span>
            </label>
          ))}
        </div>
      )}

      <p className="mt-4 text-sm text-muted">
        {session.durationMinutes} min · {session.price} · times in {tz.replace(/_/g, " ")}
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading availability…</p>
      ) : dayKeys.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No open times in the next few weeks. Check back soon.</p>
      ) : (
        <>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {dayKeys.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setDay(k);
                  setSlot(null);
                }}
                className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-medium ${
                  k === day ? "border-accent bg-accent text-accent-ink" : "border-line hover:border-accent"
                }`}
              >
                {fmtDay(k)}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(day ? data!.days[day] ?? [] : []).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSlot(s)}
                className={`rounded-lg border px-2 py-2 text-sm ${
                  s === slot ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line hover:border-accent"
                }`}
              >
                {fmtTime(s)}
              </button>
            ))}
          </div>
        </>
      )}

      {slot && (
        <form action={submit} className="mt-6 space-y-3 border-t border-line pt-5">
          <p className="text-sm font-medium">
            {fmtDay(day!)} at {fmtTime(slot)}
          </p>
          <input name="name" required placeholder="Your name" className="input" autoComplete="name" />
          <input name="email" type="email" required placeholder="Email for the invite" className="input" autoComplete="email" />
          <textarea
            name="notes"
            rows={3}
            maxLength={2000}
            placeholder="What do you want to get out of the call? Links to your resume welcome."
            className="input"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={pending}>
            {pending ? "Holding your slot…" : `Continue to payment · ${session.price}`}
          </button>
          <p className="text-center text-xs text-muted">Full refund if you cancel at least 24h before.</p>
        </form>
      )}
      {!slot && error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
