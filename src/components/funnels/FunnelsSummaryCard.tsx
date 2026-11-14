"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { ArrowRight } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { windowLabel } from "../../../convex/lib/funnels";
import { sitePath } from "@/components/TopBar";
import {
  CookielessExplanation,
  FunnelStatList,
  FunnelSteps,
  funnelNumbers,
  type FunnelRange,
} from "./FunnelCard";

/**
 * The Analytics tab's Funnels card (launch v1 Phase 13): the site's first funnel over the
 * range, the same query and numbers as the Funnels tab, with "All funnels →". With no
 * funnels it offers to make one; cookieless sites get the tab's explanation. Funnels
 * don't take filters, as on the tab.
 */
export default function FunnelsSummaryCard({ domain, range }: { domain: string; range: FunnelRange }) {
  const funnels = useQuery(api.funnels.list, { domain });
  const result = useQuery(api.funnels.results, { domain, range });
  const searchParams = useSearchParams();
  const rangeParam = searchParams.get("range");
  const tab = `${sitePath(domain, "funnels")}${rangeParam ? `?range=${encodeURIComponent(rangeParam)}` : ""}`;
  const first = funnels?.[0];
  const numbers = first && funnelNumbers(first, result);

  let body: ReactNode;
  if (result?.status === "cookieless") {
    body = (
      <Message>
        <p className="font-medium text-foreground">Funnels need visitor ids</p>
        <p>
          <CookielessExplanation domain={domain} />
        </p>
      </Message>
    );
  } else if (funnels === undefined || (first !== undefined && result === undefined)) {
    body = <div className="min-h-66 flex-1 animate-pulse rounded-md bg-muted" aria-busy />;
  } else if (first === undefined) {
    body = (
      <Message>
        <p>
          See how many visitors go from one page or event to the next, such as / → /pricing → signup, and where they
          leave.{" "}
          <Link href={`${sitePath(domain, "funnels")}?new=1`} className="underline hover:text-foreground">
            Create a funnel
          </Link>
        </p>
      </Message>
    );
  } else if (result?.status === "tooMany") {
    body = (
      <Message>
        <p>There are too many visits in this range to work out funnels. Pick a shorter range.</p>
      </Message>
    );
  } else {
    body = (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="truncate text-sm font-medium">{first.name}</h3>
          <p className="text-xs text-muted-foreground">
            {first.steps.length} steps · completed within {windowLabel(first.windowHours)}
          </p>
        </div>
        <FunnelSteps funnel={first} numbers={numbers} />
        <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4 min-[420px]:grid-cols-4">
          <FunnelStatList numbers={numbers} />
        </dl>
      </div>
    );
  }

  return (
    <section aria-label="Funnels" className="flex min-w-0 flex-col bg-background p-5 sm:p-6">
      <header className="flex h-6 items-center justify-between gap-4 text-[13px]">
        <h2 className="font-normal">Funnels</h2>
        {first !== undefined && result?.status !== "cookieless" && (
          <Link
            href={tab}
            className="flex shrink-0 items-center gap-1 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            All funnels <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        )}
      </header>
      <div className="mt-4 flex flex-1 flex-col">{body}</div>
    </section>
  );
}

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-66 flex-1 flex-col items-center justify-center gap-1 text-center text-sm text-balance text-muted-foreground">
      {children}
    </div>
  );
}
