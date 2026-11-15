"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Renders a timestamp in the viewer's own timezone (server falls back to the mentor's). */
export function LocalTime({ iso, fallback }: { iso: string; fallback: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () =>
      new Date(iso).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }),
    () => fallback,
  );
  return <span suppressHydrationWarning>{text}</span>;
}
