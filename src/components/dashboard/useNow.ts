"use client";

import { useEffect, useState } from "react";

/**
 * The current time, snapped down to `stepMs` and refreshed every step. Snapping keeps
 * query arguments derived from it identical between ticks, so Convex subscriptions
 * only change when the step does.
 */
export function useNow(stepMs: number): number {
  const [now, setNow] = useState(() => snap(Date.now(), stepMs));
  useEffect(() => {
    const id = setInterval(() => setNow(snap(Date.now(), stepMs)), stepMs);
    return () => clearInterval(id);
  }, [stepMs]);
  return now;
}

function snap(ts: number, stepMs: number): number {
  return Math.floor(ts / stepMs) * stepMs;
}
