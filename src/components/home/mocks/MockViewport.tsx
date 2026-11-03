import type { ReactNode } from "react";

/**
 * Lays a mockup out at a fixed desktop size (`width` × `height` CSS px) and scales it down to
 * fit the figure's panel, so every screen sees the same picture, small text included, and
 * nothing scrolls sideways. Pure CSS: the panel is a size container, the scale is
 * 100cqw ÷ width (tan(atan2()) turns that ratio of lengths into a number), never above 1,
 * and the box's height follows the same ratio, so there is no layout shift and no client JS.
 * Whatever falls below `height` is cut off. Not interactive and hidden from assistive tech;
 * the figure's caption describes it.
 */
export default function MockViewport({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <div className="@container" aria-hidden inert>
      <div
        className="overflow-hidden select-none"
        style={{ height: `min(${height}px, ${((height / width) * 100).toFixed(4)}cqw)` }}
      >
        <div
          className="origin-top-left bg-background text-foreground"
          style={{ width, transform: `scale(min(1, tan(atan2(100cqw, ${width}px))))` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
