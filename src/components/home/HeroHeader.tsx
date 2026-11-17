"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import ThemeToggle from "@/components/ThemeToggle";
import { LINK_FOCUS } from "./container";
import { header, SIGN_IN, SIGN_UP } from "./content";
import { DuskButton } from "./dusk/button";
import HashLink from "./HashLink";

/**
 * The homepage's fixed header (Tailark Dusk hero-section-6): logo and section links on the
 * left, theme toggle, Sign in and Get started on the right. Below lg the links and buttons
 * fold into a full-screen menu behind the burger; the page doesn't scroll while it's open,
 * and a link or Escape closes it.
 */
export default function HeroHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const updateOverflow = () => document.documentElement.classList.toggle("overflow-hidden", mediaQuery.matches);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    updateOverflow();
    mediaQuery.addEventListener("change", updateOverflow);
    window.addEventListener("keydown", onKey);
    return () => {
      mediaQuery.removeEventListener("change", updateOverflow);
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("overflow-hidden");
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header>
      <nav
        aria-label="Main"
        data-state={open ? "active" : undefined}
        className="fixed top-0 z-40 w-full bg-background max-lg:data-[state=active]:bottom-0 max-lg:data-[state=active]:overflow-y-auto"
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="relative flex flex-wrap items-center justify-between gap-6 py-5 lg:gap-0">
            <div className="flex w-full items-center justify-between gap-12 lg:w-auto">
              <Link
                href="/"
                className={`flex shrink-0 items-center gap-2.5 font-semibold tracking-tight ${LINK_FOCUS}`}
                onClick={close}
              >
                <LogoMark />
                <span>Simple Stats</span>
              </Link>

              <div className="flex items-center gap-2 lg:hidden">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={() => setOpen(!open)}
                  aria-label={open ? header.closeMenu : header.openMenu}
                  aria-expanded={open}
                  aria-controls="home-menu"
                  className={`relative z-20 block size-8 cursor-pointer after:absolute after:-inset-2 ${LINK_FOCUS}`}
                >
                  <span
                    aria-hidden
                    className="m-auto flex size-4.5 flex-col items-center justify-center gap-[7px] duration-200 in-data-[state=active]:scale-0 in-data-[state=active]:rotate-180 in-data-[state=active]:opacity-0"
                  >
                    <span className="h-0.5 w-full rounded-full bg-foreground" />
                    <span className="h-0.5 w-full rounded-full bg-foreground" />
                  </span>
                  <X
                    aria-hidden
                    className="absolute inset-0 m-auto size-6 scale-0 -rotate-180 opacity-0 duration-200 in-data-[state=active]:scale-100 in-data-[state=active]:rotate-0 in-data-[state=active]:opacity-100"
                  />
                </button>
              </div>

              <ul className="flex gap-8 text-sm max-lg:hidden">
                {header.links.map((l) => (
                  <li key={l.href}>
                    <HashLink
                      href={l.href}
                      className={`block text-muted-foreground duration-150 hover:text-foreground ${LINK_FOCUS}`}
                    >
                      {l.label}
                    </HashLink>
                  </li>
                ))}
              </ul>
            </div>

            <div
              id="home-menu"
              className="mb-6 hidden w-full flex-wrap items-center justify-end in-data-[state=active]:block max-lg:space-y-8 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-3 lg:in-data-[state=active]:flex"
            >
              <ul className="lg:hidden">
                {header.links.map((l) => (
                  <li key={l.href}>
                    <HashLink
                      href={l.href}
                      onClick={close}
                      className={`block py-3 text-2xl font-medium text-foreground ${LINK_FOCUS}`}
                    >
                      {l.label}
                    </HashLink>
                  </li>
                ))}
              </ul>
              <div className="max-lg:hidden">
                <ThemeToggle />
              </div>
              <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit">
                <DuskButton variant="outline" size="sm" nativeButton={false} render={<Link href={SIGN_IN} />}>
                  {header.signIn}
                </DuskButton>
                <DuskButton size="sm" nativeButton={false} render={<Link href={SIGN_UP} />}>
                  {header.signUp}
                </DuskButton>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
