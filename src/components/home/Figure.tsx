import type { ReactNode } from "react";
import type { FigureMeta } from "./content";

/**
 * A framed figure (an outer ring, then an inner panel on the card colour) with its
 * "Fig. N" caption. The mockups fill it in later phases; until then the panel is empty.
 */
export default function Figure({
  figure,
  captionHidden,
  children,
}: {
  figure: FigureMeta;
  captionHidden?: boolean; // Fig. 1 has no visible caption, only one for screen readers
  children?: ReactNode;
}) {
  return (
    <figure className="min-w-0">
      <div className="rounded-xl border border-line p-2">
        <div className="overflow-hidden rounded-lg border border-line bg-card" aria-hidden>
          {children ?? <div className="aspect-[16/10]" />}
        </div>
      </div>
      <figcaption className={captionHidden ? "sr-only" : "mt-3 text-sm"}>
        <span className="mr-2 text-muted-foreground">Fig. {figure.n}</span>
        <span className="text-foreground/85">{figure.caption}</span>
      </figcaption>
    </figure>
  );
}
