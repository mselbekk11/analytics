import { persona } from "@/lib/names";
import { customers } from "./content";

/**
 * The quote cards: 1 column on phones, 2 on md, 3 on lg. Placeholder quotes carry an
 * "Example" label and a persona name, so none reads as a real review.
 */
export default function Quotes() {
  return (
    <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {customers.quotes.map((q) => {
        const p = persona(q.seed);
        const name = q.name ?? p.name;
        return (
          <li key={q.seed} className="flex flex-col rounded-xl border border-line bg-card p-5">
            <figure className="flex flex-1 flex-col">
              <blockquote className="flex-1 text-[15px] leading-relaxed text-pretty">“{q.quote}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-2.5">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-base"
                  style={{ backgroundColor: p.color }}
                  aria-hidden
                >
                  {p.emoji}
                </span>
                <span className="min-w-0 flex-1 text-[13px] leading-snug">
                  <span className="block font-medium capitalize">{name}</span>
                  <span className="block text-muted-foreground">{q.role}</span>
                </span>
                {q.placeholder && (
                  <span className="shrink-0 rounded-sm border border-line px-1.5 text-[11px] leading-[18px] text-muted-foreground">
                    {customers.exampleLabel}
                  </span>
                )}
              </figcaption>
            </figure>
          </li>
        );
      })}
    </ul>
  );
}
