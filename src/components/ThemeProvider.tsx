"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Light or dark via a `.dark` class on <html>. Follows the system until the owner picks one
 * with ThemeToggle; the choice is kept in localStorage, and next-themes sets the class before
 * the page paints, so there is no flash of the wrong theme.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
