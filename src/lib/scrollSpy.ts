/** How far down the viewport the "reading line" sits: a section is being read once its top passes it. */
export const SPY_LINE = 0.3;

export type SectionTop = { id: string; top: number };

/**
 * The section being read: the last one, in page order, whose top (px from the viewport's
 * top) has reached `line`, falling back to the first. Undefined with no sections.
 */
export function activeSection(sections: SectionTop[], line: number): string | undefined {
  let active = sections[0]?.id;
  for (const s of sections) {
    if (s.top <= line) active = s.id;
  }
  return active;
}
