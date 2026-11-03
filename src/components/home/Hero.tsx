import Link from "next/link";
import { persona } from "@/lib/names";
import { Button, buttonVariants } from "@/components/ui/button";
import { hero, SIGN_IN } from "./content";
import Figure from "./Figure";
import HashLink from "./HashLink";
import { CONTAINER, LINK_FOCUS } from "./container";

/** Pill, headline, paragraph, buttons, avatars, integrations, then the framed dashboard (Fig. 1). */
export default function Hero() {
  return (
    <section className={`${CONTAINER} pt-16 text-center sm:pt-24`}>
      <HashLink
        href={hero.pill.href}
        className={`inline-block px-1 text-sm text-pretty text-muted-foreground transition-colors hover:text-foreground ${LINK_FOCUS}`}
      >
        <span className="mr-2 inline-block size-1.5 rounded-full bg-up align-middle" aria-hidden />
        {hero.pill.label} · {hero.pill.text} <span aria-hidden>→</span>
      </HashLink>
      <h1 className="mx-auto mt-6 max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl">
        <span className="sm:block">{hero.heading[0]}</span> <span className="sm:block">{hero.heading[1]}</span>
      </h1>
      <p className="mx-auto mt-6 max-w-[560px] text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
        {hero.paragraph}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <Button size="lg" className="h-10 px-5 text-[15px]" render={<Link href={SIGN_IN} />} nativeButton={false}>
          {hero.primary}
        </Button>
        <HashLink
          href={hero.secondary.href}
          className={buttonVariants({ variant: "outline", size: "lg", className: "h-10 px-5 text-[15px]" })}
        >
          {hero.secondary.label}
        </HashLink>
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
        <span className="flex -space-x-1.5" aria-hidden>
          {hero.avatarSeeds.map((seed) => {
            const p = persona(seed);
            return (
              <span
                key={seed}
                className="flex size-6 items-center justify-center rounded-full text-[13px] ring-2 ring-background"
                style={{ backgroundColor: p.color }}
              >
                {p.emoji}
              </span>
            );
          })}
        </span>
        {hero.socialLine}
      </div>
      <div className="mt-14">
        <p className="text-[13px] text-muted-foreground">{hero.integrationsLabel}</p>
        <ul className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          {hero.integrations.map(({ name, icon: Icon }) => (
            <li key={name}>
              <span
                role="img"
                aria-label={name}
                title={name}
                className="flex size-8 items-center justify-center rounded-md border border-line text-foreground/75"
              >
                <Icon className="size-4" aria-hidden />
              </span>
            </li>
          ))}
        </ul>
      </div>
      {/* Fig. 1: the dashboard mockup arrives in Phase 3; the fold cuts the frame off */}
      <div className="relative mt-16 text-left">
        <Figure figure={hero.figure} captionHidden>
          <div className="h-[280px] sm:h-[460px]" />
        </Figure>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
      </div>
    </section>
  );
}
