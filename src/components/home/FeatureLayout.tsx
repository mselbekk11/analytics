import type { ReactNode } from "react";
import { buildOrigin, embedSnippet } from "@/lib/snippet";
import AskAi from "./AskAi";
import CodeBlock from "./CodeBlock";
import ContentsSidebar from "./ContentsSidebar";
import { CONTAINER } from "./container";
import { type HomeSection, type SectionId, sections, setup } from "./content";
import Faq from "./Faq";
import Figure from "./Figure";
import FunnelMock from "./mocks/FunnelMock";
import GoalsMock from "./mocks/GoalsMock";
import LiveMock from "./mocks/LiveMock";
import PagesMock from "./mocks/PagesMock";
import RevenueMock from "./mocks/RevenueMock";
import SearchMock from "./mocks/SearchMock";
import Pricing from "./Pricing";
import Quotes from "./Quotes";
import Section from "./Section";
import StatStrip from "./StatStrip";

// Sections whose body is something other than figures
const BODIES: Partial<Record<SectionId, ReactNode>> = {
  "s-ai": <AskAi />,
  // The same tag the dashboard's Snippet shows, for a placeholder domain
  "s-setup": <CodeBlock comment={setup.comment} code={embedSnippet(setup.domain, buildOrigin())} />,
  "s-pricing": <Pricing />,
  "s-customers": <Quotes />,
  "s-faq": <Faq />,
};

// The mockup in each figure frame, by figure number; the others stay empty until built
const MOCKS: Partial<Record<number, ReactNode>> = {
  2: <PagesMock />,
  3: <RevenueMock />,
  4: <FunnelMock />,
  5: <GoalsMock />,
  6: <SearchMock />,
  7: <LiveMock />,
};

/**
 * The two-column features grid: the sticky Contents sidebar on the left (lg and up) and
 * the ten numbered sections on the right. Below lg the sidebar is hidden and the sections
 * stack. A figure frame without a mockup in MOCKS is an empty panel. A section's stat
 * strip, if it has one, follows its figures.
 */
export default function FeatureLayout() {
  return (
    <div className={`${CONTAINER} pt-16 sm:pt-24 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-14`}>
      <aside className="hidden lg:block">
        <ContentsSidebar />
      </aside>
      <div className="min-w-0">
        {sections.map((s) => (
          <Section key={s.id} section={s}>
            {body(s)}
          </Section>
        ))}
      </div>
    </div>
  );
}

/** A section's body, its figures or nothing, then its stat strip if it has one. */
function body(s: HomeSection): ReactNode {
  const main =
    BODIES[s.id] ??
    (s.figures.length > 0 && (
      <div className={s.figures.length > 1 ? "grid gap-8 md:grid-cols-2 md:gap-5" : undefined}>
        {s.figures.map((f) => (
          <Figure key={f.n} figure={f}>
            {MOCKS[f.n]}
          </Figure>
        ))}
      </div>
    ));
  if (!main && !s.strip) return undefined;
  return (
    <>
      {main}
      {s.strip && <StatStrip facts={s.strip} />}
    </>
  );
}
