"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Cadence } from "../../../convex/lib/insights";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

const CADENCES: { cadence: Cadence; title: string; covers: string; sends: string }[] = [
  { cadence: "daily", title: "Daily", covers: "The day before", sends: "Every day at 07:00 UTC" },
  { cadence: "weekly", title: "Weekly", covers: "The week just ended, Monday to Sunday", sends: "Mondays at 09:00 UTC" },
  { cadence: "monthly", title: "Monthly", covers: "The month just ended", sends: "On the 1st at 09:00 UTC" },
];

/**
 * Account Settings → Insight emails (launch v1 Phase 15): a switch per cadence. The query
 * is reactive, so an unsubscribe from an email shows here at once.
 */
export default function InsightEmails() {
  const prefs = useQuery(api.insights.prefs, {});
  const [error, setError] = useState<string | null>(null);
  const setPref = useMutation(api.insights.setPref).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.insights.prefs, {});
    if (current) store.setQuery(api.insights.prefs, {}, { ...current, [args.cadence]: args.on });
  });

  async function toggle(cadence: Cadence, on: boolean) {
    setError(null);
    try {
      await setPref({ cadence, on });
    } catch {
      setError("Couldn't save that. Try again.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insight emails</CardTitle>
        <CardDescription>
          Visitors, pageviews, revenue and your key goal for each site with visitors, with the change and the top
          sources and pages. Each site&apos;s days are in its own timezone, and nothing is sent when no site had
          visitors.
        </CardDescription>
      </CardHeader>
      <ul className="flex flex-col divide-y divide-border px-(--card-spacing)">
        {CADENCES.map((c) => {
          const id = `insight-email-${c.cadence}`;
          return (
            <li key={c.cadence} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <label htmlFor={id} className="min-w-0 cursor-pointer">
                <span className="block text-sm font-medium">{c.title}</span>
                <span className="block text-sm text-muted-foreground">
                  {c.covers}. {c.sends}.
                </span>
              </label>
              <Switch
                id={id}
                checked={prefs?.[c.cadence] ?? false}
                disabled={prefs === undefined || prefs === null}
                onCheckedChange={(on) => void toggle(c.cadence, on)}
              />
            </li>
          );
        })}
      </ul>
      {error && <p className="px-(--card-spacing) text-sm text-destructive">{error}</p>}
    </Card>
  );
}
