"use client";

import { useSyncExternalStore } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

// next-themes only knows the stored choice in the browser, so the server renders no selection
const subscribeNever = () => () => {};

/** Account settings: who is signed in, Clerk's profile, the theme and sign out. */
export default function AccountSettings() {
  const { user, isLoaded } = useUser();
  const clerk = useClerk();
  const { theme, setTheme } = useTheme();
  const inBrowser = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-10 px-4 pt-10 pb-20 sm:px-6 lg:px-8">
      <PageHeader title="Settings" />
      <div className="flex max-w-xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription className="truncate">
              {isLoaded ? (email ?? "No email address") : "Loading…"}
            </CardDescription>
            <CardAction>
              <Button variant="outline" onClick={() => clerk.openUserProfile()}>
                Manage account
              </Button>
            </CardAction>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>System follows your device&apos;s light or dark mode.</CardDescription>
          </CardHeader>
          <div className="px-(--card-spacing)">
            <ToggleGroup
              value={inBrowser && theme ? [theme] : []}
              onValueChange={(value) => {
                // Clicking the pressed option again reports an empty value; keep the theme
                if (value[0]) setTheme(value[0]);
              }}
              spacing={0}
              size="sm"
              aria-label="Theme"
              className="rounded-lg border border-border p-0.5"
            >
              {THEMES.map((t) => (
                <ToggleGroupItem
                  key={t.value}
                  value={t.value}
                  className="gap-1.5 rounded-md! px-3 text-muted-foreground data-pressed:text-foreground"
                >
                  <t.icon aria-hidden />
                  {t.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </Card>

        <div>
          <Button variant="destructive" onClick={() => clerk.signOut({ redirectUrl: "/" })}>
            <LogOut aria-hidden />
            Sign out
          </Button>
        </div>
      </div>
    </main>
  );
}
