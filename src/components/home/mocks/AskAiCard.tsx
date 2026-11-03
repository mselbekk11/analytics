import { formatMoney } from "@/lib/format";
import { askAiMock as data } from "./fixtures";
import { MockSourceIcon } from "./parts";

/**
 * 06 Ask AI's example: a question in a bubble, a one-line answer, and the three rows it
 * comes from as the Sources card draws them (a bar as long as the row's share of the top
 * one, the source's mark, its revenue). Laid out at its natural size, not scaled, so it
 * stays readable on phones. Static and hidden from assistive tech; the section's words
 * say what it shows.
 */
export default function AskAiCard() {
  const top = Math.max(...data.rows.map((r) => r.revenueMinor));
  return (
    <div className="rounded-xl border border-line p-2" aria-hidden inert>
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-card p-4 text-sm select-none">
        <p className="ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-muted px-3.5 py-2.5 leading-relaxed">
          {data.question}
        </p>
        <p className="leading-relaxed text-pretty">{data.answer}</p>
        <ul className="flex flex-col gap-0.5 rounded-lg border border-line p-1">
          {data.rows.map((row) => (
            <li key={row.key} className="relative isolate flex h-9 items-center gap-2 rounded-md px-2.5">
              <div
                className="absolute inset-y-0 left-0 -z-10 rounded-md bg-bar"
                style={{ width: `${Math.max((row.revenueMinor / top) * 100, 1)}%` }}
              />
              <MockSourceIcon source={row.key} className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">{row.key}</span>
              <span className="ml-auto shrink-0 pl-3 tabular-nums">
                {formatMoney(row.revenueMinor, data.currency, true)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
