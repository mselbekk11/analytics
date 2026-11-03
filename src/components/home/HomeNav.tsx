import Link from "next/link";
import LogoMark from "@/components/LogoMark";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { CONTAINER, LINK_FOCUS } from "./container";
import { nav, SIGN_IN } from "./content";
import HashLink from "./HashLink";

/** The sticky top bar: logo, in-page links, theme toggle and Dashboard. `offPage` when not on the homepage. */
export default function HomeNav({ offPage }: { offPage?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background">
      <div className={`${CONTAINER} flex h-14 items-center gap-1 sm:gap-6`}>
        <Link href="/" className={`flex shrink-0 items-center gap-2.5 font-semibold tracking-tight ${LINK_FOCUS}`}>
          <LogoMark />
          <span className="max-sm:sr-only">Analytics</span>
        </Link>
        <nav aria-label="Main" className="flex items-center">
          {nav.links.map((l) => (
            <HashLink
              key={l.href}
              href={l.href}
              offPage={offPage}
              className={`px-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground sm:px-2.5 sm:text-sm ${LINK_FOCUS}`}
            >
              {l.label}
            </HashLink>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Button render={<Link href={SIGN_IN} />} nativeButton={false}>
            {nav.cta}
          </Button>
        </div>
      </div>
    </header>
  );
}
