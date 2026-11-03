import Link from "next/link";
import { CONTAINER, LINK_FOCUS } from "./container";
import { footer } from "./content";
import HashLink from "./HashLink";

const LINK = `px-2 py-1 transition-colors hover:text-foreground ${LINK_FOCUS}`;

/** Copyright on the left, section and page links on the right. `offPage` when not on the homepage. */
export default function HomeFooter({ offPage }: { offPage?: boolean }) {
  return (
    <footer className="border-t border-line">
      <div className={`${CONTAINER} flex flex-wrap items-center justify-between gap-4 py-8 text-sm text-muted-foreground`}>
        <p>{footer.copyright}</p>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-1">
          {footer.links.map((l) => (
            <HashLink key={l.href} href={l.href} offPage={offPage} className={LINK}>
              {l.label}
            </HashLink>
          ))}
          {footer.pages.map((l) => (
            <Link key={l.href} href={l.href} className={LINK}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
