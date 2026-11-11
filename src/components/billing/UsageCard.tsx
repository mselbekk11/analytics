"use client";

import type { FunctionReturnType } from "convex/server";
import { CONTACT_EMAIL } from "@/components/home/content";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fittingTierIndex, formatEvents, formatPrice, TIERS } from "@/lib/pricing";
import type { api } from "../../../convex/_generated/api";

export type Usage = FunctionReturnType<typeof api.billing.usage>;

const TOP = TIERS[TIERS.length - 1];
const LINK = "underline underline-offset-3 hover:text-foreground disabled:opacity-50";

const plural = (n: number, one: string, many: string) => `${formatEvents(n)} ${n === 1 ? one : many}`;

/**
 * The usage meter (launch v1 Phase 6): this UTC month's pageviews plus custom events
 * across every site. With a tier it's "X of Y events" and a bar, and "Over your tier
 * this month" past the limit, which changes nothing but points to the portal (or to
 * "Get in touch" past the top tier). Without one (trial, locked, comped) it's the count,
 * and with `showFit` (trial or locked) the tier it fits.
 */
export default function UsageCard({
  usage,
  limit,
  showFit = false,
  resetsOn,
  onMoveUp,
  moveUpPending = false,
}: {
  usage: Usage | undefined;
  limit: number | null;
  showFit?: boolean;
  resetsOn: string; // "December 1"
  onMoveUp?: () => void;
  moveUpPending?: boolean;
}) {
  if (usage === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This month</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { total, pageviews, events } = usage;
  const over = limit !== null && total > limit;
  const pct = limit === null || limit === 0 ? 0 : Math.min(100, (total / limit) * 100);
  const fit = TIERS[fittingTierIndex(total)] ?? null;
  const getInTouch = (label: string) => (
    <a className={LINK} href={`mailto:${CONTACT_EMAIL}`}>
      {label}
    </a>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {limit === null
            ? `${plural(total, "event", "events")} this month`
            : `${formatEvents(total)} of ${formatEvents(limit)} events this month`}
        </CardTitle>
        <CardDescription>
          {plural(pageviews, "pageview", "pageviews")} and {plural(events, "custom event", "custom events")} across all
          your sites. The count starts over on {resetsOn} (UTC).
        </CardDescription>
      </CardHeader>
      {(limit !== null || showFit) && (
        <CardContent className="flex flex-col gap-3">
          {limit !== null && (
            <div
              role="meter"
              aria-label="Events this month"
              aria-valuemin={0}
              aria-valuemax={limit}
              aria-valuenow={Math.min(total, limit)}
              aria-valuetext={`${formatEvents(total)} of ${formatEvents(limit)} events`}
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div className={`h-full rounded-full ${over ? "bg-down" : "bg-foreground"}`} style={{ width: `${pct}%` }} />
            </div>
          )}
          {over && (
            <div className="flex flex-col gap-1">
              <p className="font-medium">Over your tier this month</p>
              <p className="text-muted-foreground">
                Nothing stops working: your sites keep tracking and your dashboard stays open.{" "}
                {fit === null ? (
                  <>That&apos;s more than our largest tier, {getInTouch("get in touch")}.</>
                ) : (
                  <>
                    If it keeps up,{" "}
                    <button type="button" className={LINK} disabled={moveUpPending} onClick={onMoveUp}>
                      move up to {fit.label}
                    </button>{" "}
                    in Manage subscription.
                  </>
                )}
              </p>
            </div>
          )}
          {showFit && (
            <p className="text-muted-foreground">
              {fit === null ? (
                <>
                  That&apos;s more than {TOP.label} a month, our largest tier. {getInTouch("Get in touch")} for a plan
                  that fits.
                </>
              ) : (
                <>
                  You&apos;d be on{" "}
                  <span className="font-medium text-foreground">
                    {fit.label} · {formatPrice(fit.monthly)}/mo
                  </span>
                  .
                </>
              )}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
