"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import SiteShell from "./SiteShell";
import { sitePath, type SiteSection } from "@/components/TopBar";

/**
 * A site tab whose page isn't built yet (Revenue lands in launch v1 Phase 10, Outbound in
 * Phase 9): its title and where the numbers are for now. The tab bar keeps the range and
 * filters in the URL, so leaving it goes back to the same view.
 */
export default function ComingSoon({
  section,
  title,
  text,
}: {
  section: Extract<SiteSection, "revenue" | "outbound">;
  title: string;
  text: string;
}) {
  const searchParams = useSearchParams();
  return (
    <SiteShell section={section}>
      {(site) => (
        <div className="flex flex-col gap-10">
          <PageHeader title={title} />
          <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            {text}{" "}
            <Link
              href={`${sitePath(site.domain, "analytics")}${searchParams.size > 0 ? `?${searchParams}` : ""}`}
              className="underline hover:text-foreground"
            >
              Go to Analytics
            </Link>
          </p>
        </div>
      )}
    </SiteShell>
  );
}
