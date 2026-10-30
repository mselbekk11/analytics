"use client";

import Link from "next/link";
import { Authenticated, AuthLoading, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import TopBar from "@/components/TopBar";
import { useNow } from "@/components/dashboard/useNow";
import SiteCard from "./SiteCard";

// Each site's "today" is worked out on the server in its own timezone from this
// timestamp; a minute step keeps the day boundary close without busy re-queries.
const NOW_STEP_MS = 60 * 1000;

export default function Websites() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar account="websites" />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 pt-10 pb-20 sm:px-6 lg:px-8">
        <AuthLoading>
          <p className="text-sm text-muted-foreground">Connecting…</p>
        </AuthLoading>
        <Authenticated>
          <SiteGrid />
        </Authenticated>
      </main>
    </div>
  );
}

function SiteGrid() {
  const now = useNow(NOW_STEP_MS);
  const sites = useQuery(api.sites.listWithStats, { now });

  const header = (
    <PageHeader title="Websites" description="Last 30 days">
      {sites !== undefined && sites.length > 0 && (
        <Button
          variant="outline"
          className="h-8 gap-1.5 px-3"
          render={<Link href="/websites/new" />}
          nativeButton={false}
        >
          <Plus aria-hidden />
          Add website
        </Button>
      )}
    </PageHeader>
  );

  if (sites === undefined) {
    return (
      <div className="flex flex-col gap-10">
        {header}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-lg border border-border bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="flex flex-col gap-10">
        {header}
        <section className="flex flex-col gap-4 rounded-lg border border-border p-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-medium">Add your first website</h2>
            <p className="text-sm text-muted-foreground">
              Add a domain, then paste one line into its HTML.
            </p>
          </div>
          <div>
            <Button render={<Link href="/websites/new" />} nativeButton={false} className="gap-1.5 px-3">
              <Plus aria-hidden />
              Add website
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const shown = [...sites].sort((a, b) => b.pageviews - a.pageviews || a.domain.localeCompare(b.domain));

  return (
    <div className="flex flex-col gap-10">
      {header}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((s) => (
          <SiteCard key={s.domain} {...s} />
        ))}
      </div>
    </div>
  );
}
