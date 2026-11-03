"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { activeSection, SPY_LINE } from "@/lib/scrollSpy";
import { SIGN_IN, sections, sidebar } from "./content";
import HashLink from "./HashLink";
import SoonBadge from "./SoonBadge";

/**
 * The sticky "Contents" list beside the feature sections (lg and up). It highlights the
 * section whose top has passed a line 30% down the viewport. An IntersectionObserver
 * with a one-line root fires whenever a section crosses that line (and once on start),
 * and each time the active one is worked out again from the sections' positions.
 */
export default function ContentsSidebar() {
  const [active, setActive] = useState<string>(sections[0].id);

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((el) => el !== null);
    function update() {
      const id = activeSection(
        els.map((el) => ({ id: el.id, top: el.getBoundingClientRect().top })),
        window.innerHeight * SPY_LINE,
      );
      if (id) setActive(id);
    }
    const line = SPY_LINE * 100;
    const observer = new IntersectionObserver(update, {
      rootMargin: `-${line}% 0px -${100 - line - 1}% 0px`,
    });
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <nav aria-label={sidebar.title} className="sticky top-24 flex flex-col">
      <p className="mb-3 text-[13px] text-muted-foreground">{sidebar.title}</p>
      <ul className="flex flex-col gap-0.5">
        {sections.map((s) => {
          const current = s.id === active;
          const Icon = s.icon;
          return (
            <li key={s.id}>
              <HashLink
                href={`#${s.id}`}
                aria-current={current ? "true" : undefined}
                className={`flex h-9 items-center gap-2.5 rounded-md px-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 ${
                  current ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActive(s.id)}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {s.label}
                {s.soon && <SoonBadge className="ml-auto" />}
              </HashLink>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 border-t border-line pt-5">
        <Button className="w-full" size="lg" render={<Link href={SIGN_IN} />} nativeButton={false}>
          {sidebar.cta}
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">{sidebar.note}</p>
      </div>
    </nav>
  );
}
