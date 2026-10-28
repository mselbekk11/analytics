"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpDown, ArrowUpRight, Check, ChevronDown } from "lucide-react";
import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type StatsRow = {
  key: string;
  label: ReactNode;
  /** The formatted number on the right */
  value: string;
  /** 0 to 1: the row's count against the top row's, sets the bar width */
  share: number;
  /** Icon, favicon or flag before the label */
  icon?: ReactNode;
  /** An external page for the row (a referrer, an outbound link), opened from a small ↗ */
  href?: string;
  /** Adds this row as a filter when clicked */
  onSelect?: () => void;
  /** The row is the current filter of its list */
  active?: boolean;
  /** A small badge after the label (the key goal's) */
  badge?: ReactNode;
  /** More numbers for the row, shown on hover */
  tooltip?: ReactNode;
};

export type CardTab = { id: string; label: string };

type Props = {
  /** Names the tab list for screen readers */
  title: string;
  tabs: CardTab[];
  /** Tabs in the "More ▾" menu; the chosen one takes the menu's place as the active tab */
  more?: CardTab[];
  tab: string;
  onTab: (id: string) => void;
  /** What the numbers count, on the right of the header ("Visitors", "Pageviews", ...) */
  metric?: string;
  /** Makes the metric a "⇅" button that switches it (Visitors and Revenue) */
  onMetricSwitch?: () => void;
  /** undefined while loading */
  rows: StatsRow[] | undefined;
  /** Shown when there are no rows; "No data for this range" by default */
  empty?: ReactNode;
  /** Shown in place of the rows, once they have loaded (the Countries card's map) */
  body?: ReactNode;
};

/** Rows shown before "View all N →" */
const COLLAPSED_ROWS = 7;

/**
 * One card of the grid under the chart: text tabs (and a More ▾ menu) with the metric on
 * the right, then bar rows. It shows the top 7 rows; "View all N →" expands it in place.
 * Empty and loading states keep the height of 7 rows, so the grid doesn't jump.
 */
export default function StatsCard({
  title,
  tabs,
  more,
  tab,
  onTab,
  metric,
  onMetricSwitch,
  rows,
  empty,
  body,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const select = (id: string) => {
    setExpanded(false);
    onTab(id);
  };
  const visible = expanded ? rows : rows?.slice(0, COLLAPSED_ROWS);

  return (
    <section className="flex min-w-0 flex-col bg-background p-5 sm:p-6">
      <header className="flex h-6 items-center justify-between gap-4 text-[13px]">
        <div role="tablist" aria-label={title} className="flex min-w-0 items-center gap-4">
          {tabs.map((t) => (
            <TabButton key={t.id} active={t.id === tab} onClick={() => select(t.id)}>
              {t.label}
            </TabButton>
          ))}
          {more && <MoreMenu items={more} tab={tab} onSelect={select} />}
        </div>
        {onMetricSwitch ? (
          <button
            type="button"
            onClick={onMetricSwitch}
            title="Switch between visitors and revenue"
            className="flex shrink-0 items-center gap-1 rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {metric}
            <ArrowUpDown aria-hidden className="size-3.5" />
          </button>
        ) : (
          metric !== undefined && <span className="shrink-0 text-muted-foreground">{metric}</span>
        )}
      </header>
      <div className="mt-4 flex flex-1 flex-col">
        {visible === undefined ? (
          <ul className="flex flex-col gap-0.5" aria-busy>
            {Array.from({ length: COLLAPSED_ROWS }, (_, i) => (
              <li
                key={i}
                className="h-9 animate-pulse rounded-md bg-muted"
                style={{ width: `${100 - i * 11}%` }}
              />
            ))}
          </ul>
        ) : body !== undefined ? (
          body
        ) : visible.length === 0 ? (
          <p className="flex min-h-66 flex-1 items-center justify-center text-center text-sm text-muted-foreground">
            {empty ?? "No data for this range"}
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {visible.map((row) => (
              <Row key={row.key} row={row} />
            ))}
          </ul>
        )}
      </div>
      {body === undefined && rows !== undefined && rows.length > COLLAPSED_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 self-start rounded-sm text-[13px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {expanded ? (
            "Show less"
          ) : (
            <>
              View all {rows.length} <ArrowRight aria-hidden className="size-3.5" />
            </>
          )}
        </button>
      )}
    </section>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function MoreMenu({ items, tab, onSelect }: { items: CardTab[]; tab: string; onSelect: (id: string) => void }) {
  const current = items.find((t) => t.id === tab);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        role="tab"
        aria-selected={current !== undefined}
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
          current ? "text-foreground" : "text-muted-foreground hover:text-foreground data-popup-open:text-foreground",
        )}
      >
        {current?.label ?? "More"}
        <ChevronDown aria-hidden className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {items.map((t) => (
          <DropdownMenuItem key={t.id} onClick={() => onSelect(t.id)} className="py-1.5">
            {t.label}
            {t.id === tab && <Check aria-hidden className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * A bar from the left, as wide as the row's share of the top row, behind the icon and
 * label, with the number on the right. When the row can filter, its label is a button
 * stretched over the whole row, with the ↗ link on top of it.
 */
function Row({ row }: { row: StatsRow }) {
  const item = (
    <li
      className={cn(
        "relative isolate flex h-9 items-center gap-2 rounded-md px-2.5 text-sm",
        row.onSelect && "hover:bg-muted/40",
        row.active && "ring-1 ring-ring",
      )}
    >
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 -z-10 rounded-md bg-muted dark:bg-muted/60"
        style={{ width: `${Math.max(row.share * 100, 1)}%` }}
      />
      {row.icon && (
        <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
          {row.icon}
        </span>
      )}
      {row.onSelect ? (
        <button
          type="button"
          onClick={row.onSelect}
          aria-pressed={row.active}
          title={row.active ? "Remove this filter" : "Filter by this"}
          className="min-w-0 truncate rounded-md text-left outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring/50"
        >
          {row.label}
        </button>
      ) : (
        <span className="min-w-0 truncate">{row.label}</span>
      )}
      {row.badge}
      {row.href !== undefined && (
        <a
          href={row.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          aria-label="Open in a new tab"
          className="relative z-10 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ArrowUpRight aria-hidden className="size-3.5" />
        </a>
      )}
      <span className="ml-auto shrink-0 pl-3 tabular-nums">{row.value}</span>
    </li>
  );
  if (row.tooltip === undefined) return item;
  return (
    <Tooltip>
      <TooltipTrigger render={item} />
      <TooltipContent side="top">{row.tooltip}</TooltipContent>
    </Tooltip>
  );
}
