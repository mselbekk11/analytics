import type { StatFact } from "./content";

/**
 * Three facts under a top rule, in columns from sm up and stacked on phones: a short bold
 * value ("Stripe + API", "~2 KB") over a muted line. Used under Fig. 3 and in Setup.
 */
export default function StatStrip({ facts }: { facts: StatFact[] }) {
  return (
    <ul className="mt-10 grid gap-6 border-t border-line pt-8 sm:grid-cols-3 sm:gap-8">
      {facts.map((f) => (
        <li key={f.value} className="flex flex-col gap-2">
          <span className="text-xl font-semibold tracking-tight">{f.value}</span>
          <span className="text-[15px] text-muted-foreground">{f.label}</span>
        </li>
      ))}
    </ul>
  );
}
