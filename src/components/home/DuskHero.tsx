import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { LINK_FOCUS } from "./container";
import { hero, SIGN_UP } from "./content";
import { DuskButton } from "./dusk/button";
import HashLink from "./HashLink";
import HeroChart from "./HeroChart";

// The hero's background fades from the page colour into this tint, which the analytics
// line below continues, so the line reads as the hero's lower edge in both themes
const TINT = "color-mix(in oklab, var(--foreground) 6%, var(--background))";

// The analytics line: a jagged traffic trace drawn from a fixed seed, so the server and
// every visit draw the same line
const WAVE_W = 1440;
const WAVE_H = 160;
const WAVE_POINTS = (() => {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const count = 56;
  return Array.from({ length: count }, (_, i) => {
    const trend = Math.sin(i / 4.5) * 30 + Math.sin(i / 1.7) * 12;
    const y = Math.min(WAVE_H - 8, Math.max(8, 72 + trend + (random() - 0.5) * 70));
    return [(i * WAVE_W) / (count - 1), y] as const;
  });
})();
const WAVE_LINE = WAVE_POINTS.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const WAVE_FILL = `${WAVE_LINE} L${WAVE_W},0 L0,0 Z`;

/**
 * The homepage hero, side by side: the fact tiles, headline, subline, Get started with a
 * link to the Ask AI section, and the checks on the left; the illustrative visits-to-revenue
 * chart on the right (stacked below lg). Then the "Works with" row and a full-width
 * analytics line that separates the hero from the sections below.
 */
export default function DuskHero() {
  return (
    <section
      className="overflow-hidden"
      style={{ "--hero-tint": TINT } as CSSProperties}
    >
      <div className="bg-linear-to-b from-background to-(--hero-tint)">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 pt-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:pt-40">
          <div>
            <ul className="flex flex-wrap gap-2">
              {hero.badges.map(({ icon: Icon, label, value, tag }) => (
                <li
                  key={label}
                  className="relative flex flex-col gap-1 rounded-xl bg-foreground/5 px-3 py-2 ring-1 ring-foreground/5"
                >
                  {tag && (
                    <span className="absolute -top-2 right-2 rounded-full bg-primary px-1.5 py-px text-[9px] font-semibold tracking-wide text-primary-foreground uppercase">
                      {tag}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                    <Icon aria-hidden className="size-3" />
                    {label}
                  </span>
                  <span className="text-sm font-semibold">{value}</span>
                </li>
              ))}
            </ul>

            <h1 className="mt-8 text-5xl font-medium tracking-tight text-balance md:text-6xl">{hero.heading}</h1>
            <p className="mt-6 max-w-xl text-lg text-balance text-muted-foreground">{hero.paragraph}</p>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <DuskButton size="lg" nativeButton={false} render={<Link href={SIGN_UP} />}>
                {hero.cta}
              </DuskButton>
              <HashLink
                href={hero.secondary.href}
                className={`flex items-center gap-1.5 text-sm font-medium underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground ${LINK_FOCUS}`}
              >
                {hero.secondary.label}
                <ArrowRight aria-hidden className="size-3.5" />
              </HashLink>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {hero.checks.map((c) => (
                <li key={c} className="flex items-center gap-1.5">
                  <Check aria-hidden className="size-3.5 text-foreground" />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <HeroChart />
        </div>

        <div className="mx-auto mt-16 max-w-7xl px-6 pb-6 lg:mt-20">
          <p className="sr-only">{hero.worksWith.label}:</p>
          <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {hero.worksWith.names.map((n) => (
              <li key={n} className="text-xl font-semibold tracking-tight text-foreground/35">
                {n}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <svg
        aria-hidden
        viewBox={`0 0 ${WAVE_W} ${WAVE_H}`}
        preserveAspectRatio="none"
        className="block h-20 w-full text-foreground sm:h-32 lg:h-40"
      >
        <path d={WAVE_FILL} fill="var(--hero-tint)" />
        <path
          d={WAVE_LINE}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.7"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </section>
  );
}
