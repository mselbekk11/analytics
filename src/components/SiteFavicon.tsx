"use client";

import { useState } from "react";
import { cn } from "cn";

/** The site's own favicon in a small white tile; its first letter if there is none. */
export default function SiteFavicon({ domain, className }: { domain: string; className?: string }) {
  const [failed, setFailed] = useState(domain === "localhost");
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center overflow-hidden rounded bg-white text-[11px] font-medium text-zinc-700 ring-1 ring-foreground/10",
        className,
      )}
    >
      {failed ? (
        domain[0]?.toUpperCase()
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- external favicon, any size
        <img
          src={`https://${domain}/favicon.ico`}
          alt=""
          className="size-3.5"
          onError={() => setFailed(true)}
          // The server-rendered <img> can fail before React hydrates and misses onError
          ref={(img) => {
            if (img?.complete && img.naturalWidth === 0) setFailed(true);
          }}
        />
      )}
    </span>
  );
}
