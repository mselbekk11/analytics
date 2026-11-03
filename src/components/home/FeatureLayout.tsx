import ContentsSidebar from "./ContentsSidebar";
import { CONTAINER } from "./container";
import { sections } from "./content";
import Figure from "./Figure";
import Section from "./Section";

/**
 * The two-column features grid: the sticky Contents sidebar on the left (lg and up) and
 * the ten numbered sections on the right. Below lg the sidebar is hidden and the sections
 * stack. Figure frames are empty until their mockups are built.
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
            {s.figures.length > 0 && (
              <div className={s.figures.length > 1 ? "grid gap-8 md:grid-cols-2 md:gap-5" : undefined}>
                {s.figures.map((f) => (
                  <Figure key={f.n} figure={f} />
                ))}
              </div>
            )}
          </Section>
        ))}
      </div>
    </div>
  );
}
