import { CONTAINER, LINK_FOCUS } from "./container";
import { footer } from "./content";
import HashLink from "./HashLink";

/** Copyright on the left, page links on the right. */
export default function HomeFooter() {
  return (
    <footer className="border-t border-line">
      <div className={`${CONTAINER} flex flex-wrap items-center justify-between gap-4 py-8 text-sm text-muted-foreground`}>
        <p>{footer.copyright}</p>
        <nav aria-label="Footer" className="flex items-center gap-1">
          {footer.links.map((l) => (
            <HashLink
              key={l.href}
              href={l.href}
              className={`px-2 py-1 transition-colors hover:text-foreground ${LINK_FOCUS}`}
            >
              {l.label}
            </HashLink>
          ))}
        </nav>
      </div>
    </footer>
  );
}
