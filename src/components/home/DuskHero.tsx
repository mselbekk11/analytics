import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LINK_FOCUS } from "./container";
import { hero, heroImage, SIGN_UP } from "./content";
import { DuskButton } from "./dusk/button";
import HashLink from "./HashLink";

// The panel behind the screenshot: a dusk sky drawn in CSS (in place of the block's
// Unsplash photo), the same in light and dark mode, as a photo would be
const BACKDROP = [
  "radial-gradient(70% 60% at 85% 100%, rgb(251 146 60 / 0.75), transparent 70%)",
  "radial-gradient(60% 55% at 15% 95%, rgb(236 72 153 / 0.55), transparent 70%)",
  "radial-gradient(80% 60% at 50% 0%, rgb(30 27 75 / 0.9), transparent 75%)",
  "linear-gradient(to bottom, #1e1b4b 0%, #3730a3 35%, #7c3aed 65%, #f0abfc 100%)",
].join(", ");

/**
 * The homepage hero (Tailark Dusk hero-section-6): an eyebrow link, the headline beside
 * the subline and Get started, then the dashboard screenshot (heroImage) in a frame over a
 * gradient panel. The frame is wider than the panel below xl, so the panel crops it at
 * the right and bottom, as in the block.
 */
export default function DuskHero() {
  return (
    <section className="overflow-hidden">
      <div className="relative pt-24 lg:pt-40">
        <div className="space-y-12 md:space-y-16">
          <div className="relative mx-auto max-w-7xl px-6">
            <HashLink
              href={hero.eyebrow.href}
              className={`flex w-fit items-center gap-2 text-sm font-medium ${LINK_FOCUS}`}
            >
              <span>{hero.eyebrow.label}</span>
              <span className="text-muted-foreground">{hero.eyebrow.text}</span>
              <ArrowRight aria-hidden className="size-3.5" />
            </HashLink>

            <div className="mt-8 grid items-end gap-6 md:grid-cols-2">
              <h1 className="text-5xl font-medium tracking-tight text-balance md:text-6xl xl:text-7xl">
                {hero.heading}
              </h1>
              <div className="flex max-w-md flex-col gap-6 md:mx-auto">
                <p className="text-lg text-balance text-muted-foreground">{hero.paragraph}</p>
                <DuskButton className="w-fit" nativeButton={false} render={<Link href={SIGN_UP} />}>
                  {hero.cta}
                </DuskButton>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-7xl max-xl:px-2">
            <div
              className="relative aspect-square overflow-hidden rounded-3xl md:aspect-5/3 lg:aspect-video"
              style={{ backgroundImage: BACKDROP }}
            >
              <div className="absolute top-4 left-4 z-10 min-w-4xl rounded-2xl bg-background p-2 shadow-lg ring ring-foreground/6.5 before:absolute before:-inset-px before:z-10 before:size-56 before:rounded-tl-2xl before:border-t before:border-l before:border-foreground/10 before:mask-radial-[100%_60%] before:mask-radial-from-65% before:mask-radial-at-top-left lg:top-16 lg:left-16 lg:min-w-5xl xl:min-w-7xl">
                <div aria-hidden className="absolute inset-0 z-1 rounded-2xl bg-foreground/2" />
                <Image
                  className="relative aspect-16/10 w-full rounded-xl bg-background"
                  src={heroImage.src}
                  alt={heroImage.alt}
                  width={heroImage.width}
                  height={heroImage.height}
                  sizes="(min-width: 1280px) 1280px, (min-width: 1024px) 1024px, 896px"
                  preload
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
