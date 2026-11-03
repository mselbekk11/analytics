import { askAi } from "./content";
import AskAiCard from "./mocks/AskAiCard";
import SoonBadge from "./SoonBadge";

/**
 * 06 Ask AI's body: the example card beside the ways to connect, each row between rules
 * (name, what it is, then MCP or a Soon badge). Side by side from md, stacked below.
 */
export default function AskAi() {
  return (
    <div className="grid items-start gap-8 md:grid-cols-2 md:gap-5">
      <AskAiCard />
      <ul aria-label={askAi.label} className="border-t border-line text-sm">
        {askAi.connections.filter((c) => !c.hidden).map((c) => (
          <li key={c.name} className="flex items-baseline gap-3 border-b border-line py-3.5">
            <span className="w-32 shrink-0 font-medium">{c.name}</span>
            <span className="min-w-0 flex-1 text-muted-foreground">{c.description}</span>
            {c.soon ? (
              <SoonBadge className="shrink-0 self-center" />
            ) : (
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{c.via}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
