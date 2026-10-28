"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Authenticated, AuthLoading, useQuery } from "convex/react";
import { FiPlus, FiX } from "react-icons/fi";
import { api } from "../../../convex/_generated/api";
import AddWebsiteForm from "@/components/AddWebsiteForm";
import TopBar from "@/components/TopBar";
import { useNow } from "@/components/dashboard/useNow";
import SiteCard from "./SiteCard";

// Each site's "today" is worked out on the server in its own timezone from this
// timestamp; a minute step keeps the day boundary close without busy re-queries.
const NOW_STEP_MS = 60 * 1000;

type Sort = "pageviews" | "name";

export default function Websites() {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
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
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<Sort>("pageviews");
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

  if (sites === undefined) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-52 animate-pulse rounded-lg border border-line bg-panel/40" />
        ))}
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <section className="flex flex-col gap-4 rounded-lg border border-line bg-panel/40 p-6">
        <div>
          <h1 className="text-lg text-strong">Add your first website</h1>
          <p className="text-sm text-muted-foreground">
            Its timezone sets where each day starts and ends in the stats.
          </p>
        </div>
        <AddWebsiteForm />
      </section>
    );
  }

  const needle = filter.trim().toLowerCase();
  const shown = sites
    .filter((s) => s.domain.includes(needle))
    .sort((a, b) =>
      sort === "name"
        ? a.domain.localeCompare(b.domain)
        : b.pageviews - a.pageviews || a.domain.localeCompare(b.domain),
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter…"
          aria-label="Filter websites"
          className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm sm:w-56"
        />
        <div className="ml-auto flex items-center gap-4">
          <span className="text-xs text-muted-foreground">
            sort by{" "}
            <button
              type="button"
              onClick={() => setSort(sort === "name" ? "pageviews" : "name")}
              className="text-link underline underline-offset-2"
              title="Change sort order"
            >
              {sort}
            </button>
          </span>
          <button
            type="button"
            onClick={() => setAdding(!adding)}
            aria-expanded={adding}
            className="flex items-center gap-1.5 rounded-full bg-link px-4 py-2 text-sm font-medium text-background"
          >
            {adding ? <FiX aria-hidden /> : <FiPlus aria-hidden />}
            Add website
          </button>
        </div>
      </div>

      {adding && (
        <section className="rounded-lg border border-line bg-panel/40 p-4">
          <AddWebsiteForm />
        </section>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No websites match “{filter}”.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => (
            <SiteCard key={s.domain} {...s} />
          ))}
        </div>
      )}
    </div>
  );
}
