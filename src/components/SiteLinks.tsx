"use client";

import Link from "next/link";
import { Authenticated, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

// Placeholder list until the /websites card grid lands in Phase 3.
export default function SiteLinks() {
  return (
    <Authenticated>
      <List />
    </Authenticated>
  );
}

function List() {
  const sites = useQuery(api.sites.list);
  if (sites === undefined) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (sites.length === 0) return <p className="text-sm text-zinc-500">No sites yet.</p>;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {sites.map((s) => (
        <li key={s.domain}>
          <Link href={`/sites/${s.domain}`} className="hover:underline">
            {s.domain}
          </Link>
        </li>
      ))}
    </ul>
  );
}
