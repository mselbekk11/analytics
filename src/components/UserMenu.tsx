"use client";

import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { CreditCardIcon, LayoutGridIcon, LogOutIcon, SettingsIcon, UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/initials";

const LINKS = [
  { href: "/websites", label: "Websites", icon: LayoutGridIcon },
  { href: "/billing", label: "Billing", icon: CreditCardIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

/**
 * Initials circle and email (email from `sm` up); opens who is signed in, the account
 * pages and Sign out (to `/`). Replaces Clerk's UserButton in the top bar.
 */
export default function UserMenu() {
  const { user } = useUser();
  const clerk = useClerk();
  const router = useRouter();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const letters = user ? initials(user.firstName, user.lastName, email) : "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex min-w-0 items-center gap-2 rounded-md p-1 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-accent data-popup-open:text-foreground sm:pr-2"
      >
        <Avatar size="sm">
          <AvatarFallback className="text-[10px] font-medium text-foreground">
            {letters || <UserIcon aria-hidden className="size-3.5" />}
          </AvatarFallback>
        </Avatar>
        {email && <span className="hidden max-w-48 truncate sm:block">{email}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span>Signed in as</span>
            <span className="truncate font-medium text-foreground">{email || "…"}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {LINKS.map((l) => (
            <DropdownMenuItem key={l.href} onClick={() => router.push(l.href)} className="gap-2 py-1.5">
              <l.icon aria-hidden className="text-muted-foreground" />
              {l.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => clerk.signOut({ redirectUrl: "/" })}
            className="gap-2 py-1.5"
          >
            <LogOutIcon aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
