const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days left in the trial, rounded up, and never below 1 while it still runs. */
export function trialDaysLeft(trialEndsAt: number, now: number): number {
  return Math.max(1, Math.ceil((trialEndsAt - now) / DAY_MS));
}

/** "Trial · 6 days left", or "1 day left" on the last day. */
export function trialLabel(trialEndsAt: number, now: number): string {
  const days = trialDaysLeft(trialEndsAt, now);
  return `Trial · ${days} ${days === 1 ? "day" : "days"} left`;
}
