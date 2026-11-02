"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Authenticated, AuthLoading, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import TopBar, { type SiteSection } from "@/components/TopBar";

export type SiteDoc = NonNullable<FunctionReturnType<typeof api.sites.get>>;

/**
 * A site view's frame: the top bar on `section`, and once signed in and the site has
 * loaded, `children` with it. A missing site, or someone else's, says so.
 */
export default function SiteShell({
  section,
  children,
}: {
  section: SiteSection;
  children: (site: SiteDoc) => ReactNode;
}) {
  const params = useParams<{ domain: string }>();
  const domain = decodeURIComponent(params.domain);
  return (
    <div className="flex flex-1 flex-col">
      <TopBar site={{ domain, section }} />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 pt-10 pb-20 sm:px-6 lg:px-8">
        <AuthLoading>
          <p className="text-sm text-muted-foreground">Connecting…</p>
        </AuthLoading>
        <Authenticated>
          <Site domain={domain}>{children}</Site>
        </Authenticated>
      </main>
    </div>
  );
}

function Site({ domain, children }: { domain: string; children: (site: SiteDoc) => ReactNode }) {
  const site = useQuery(api.sites.get, { domain });
  if (site === undefined) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (site === null) {
    return (
      <p className="text-sm text-muted-foreground">
        No site called <span className="font-mono">{domain}</span> in your account.{" "}
        <Link href="/websites" className="underline">
          Back to your sites
        </Link>
      </p>
    );
  }
  return children(site);
}
