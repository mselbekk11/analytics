import type { ReactNode } from "react";
import type { HomeSection } from "./content";
import SoonBadge from "./SoonBadge";

/** The paragraph with its highlighted phrase, if any, in the foreground colour. */
function Paragraph({ text, highlight }: { text: string; highlight?: string }) {
  const at = highlight ? text.indexOf(highlight) : -1;
  if (!highlight || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="font-medium text-foreground">{highlight}</span>
      {text.slice(at + highlight.length)}
    </>
  );
}

/**
 * One numbered feature section: eyebrow, two-line heading, paragraph, then its figures.
 * A rule separates it from the one before. `scroll-mt-20` keeps the eyebrow below the
 * sticky nav after a jump, and tabIndex lets HashLink move focus here.
 */
export default function Section({ section, children }: { section: HomeSection; children?: ReactNode }) {
  return (
    <section
      id={section.id}
      tabIndex={-1}
      aria-labelledby={`${section.id}-heading`}
      className="scroll-mt-20 border-t border-line py-16 outline-none first:border-t-0 first:pt-0 sm:py-24 lg:last:min-h-[70vh]"
    >
      <p className="flex items-center gap-2 text-[15px] text-muted-foreground">
        <span className="font-mono text-xs">{section.number}</span>
        {section.eyebrow}
        {section.soon && <SoonBadge />}
      </p>
      <h2
        id={`${section.id}-heading`}
        className="mt-5 text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-[28px]"
      >
        <span className="sm:block">{section.heading[0]}</span> <span className="sm:block">{section.heading[1]}</span>
      </h2>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-pretty text-muted-foreground">
        <Paragraph text={section.paragraph} highlight={section.highlight} />
      </p>
      {children && <div className="mt-10">{children}</div>}
    </section>
  );
}
