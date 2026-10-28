"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Authenticated, AuthLoading, useQuery } from "convex/react";
import { Plus, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import AddWebsiteForm from "@/components/AddWebsiteForm";
import { Button } from "@/components/ui/button";
import TopBar from "@/components/TopBar";
import { useNow } from "@/components/dashboard/useNow";
import SiteCard from "./SiteCard";

// Each site's "today" is worked out on the server in its own timezone from this
// timestamp; a minute step keeps the day boundary close without busy re-queries.
const NOW_STEP_MS = 60 * 1000;

export default function Websites() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar />
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
  // The add form is open while the URL has ?add=1, so the switcher's "Add site" opens it
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const adding = searchParams.get("add") === "1";
  function setAdding(open: boolean) {
    const params = new URLSearchParams(searchParams);
    if (open) params.set("add", "1");
    else params.delete("add");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }

  const header = (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Websites</h1>
        <p className="text-sm text-muted-foreground">Last 30 days</p>
      </div>
      {sites !== undefined && sites.length > 0 && (
        <Button variant="outline" className="h-8 gap-1.5 px-3" onClick={() => setAdding(!adding)} aria-expanded={adding}>
          {adding ? <X aria-hidden /> : <Plus aria-hidden />}
          Add website
        </Button>
      )}
    </header>
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
              Its timezone sets where each day starts and ends in the stats.
            </p>
          </div>
          <AddWebsiteForm />
        </section>
      </div>
    );
  }

  const shown = [...sites].sort((a, b) => b.pageviews - a.pageviews || a.domain.localeCompare(b.domain));

  return (
    <div className="flex flex-col gap-10">
      {header}
      {adding && (
        <section className="rounded-lg border border-border p-5 sm:p-6">
          <AddWebsiteForm />
        </section>
      )}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((s) => (
          <SiteCard key={s.domain} {...s} />
        ))}
      </div>
    </div>
  );
}
