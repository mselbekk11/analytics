"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import type { Anchor } from "./content";

/**
 * Scrolls to an in-page section (smoothly unless the visitor prefers reduced motion) and
 * puts its anchor in the URL without adding a history entry. Focus moves to the section,
 * so Tab carries on from there. Returns false when there's no such section.
 */
export function goToSection(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  window.history.replaceState(null, "", `#${id}`);
  el.focus({ preventScroll: true });
  return true;
}

/**
 * A plain `#anchor` link that jumps with `goToSection`. Modified clicks keep the browser's
 * default. On another page (`offPage`, e.g. /privacy) it links to the section on the homepage.
 */
export default function HashLink({
  href,
  offPage,
  onClick,
  ...props
}: ComponentProps<"a"> & { href: Anchor; offPage?: boolean }) {
  if (offPage) return <Link href={`/${href}`} onClick={onClick} {...props} />;
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (goToSection(href.slice(1))) e.preventDefault();
  }
  return <a href={href} onClick={handleClick} {...props} />;
}
