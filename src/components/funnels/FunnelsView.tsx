"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  DEFAULT_WINDOW_HOURS,
  MAX_FUNNEL_NAME,
  MAX_FUNNELS,
  MAX_STEP_NAME,
  MAX_STEPS,
  MAX_WINDOW_HOURS,
  MIN_STEPS,
  stepError,
  stepTarget,
  type FunnelStep,
} from "../../../convex/lib/funnels";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SiteHeader from "@/components/dashboard/SiteHeader";
import SiteShell from "@/components/dashboard/SiteShell";
import { useSiteRange } from "@/components/dashboard/useSiteRange";
import { CookielessExplanation, FunnelCard, funnelNumbers, type Funnel } from "./FunnelCard";

export default function FunnelsView() {
  return (
    <SiteShell section="funnels">
      {(site) => (
        <Funnels
          domain={site.domain}
          timezone={site.timezone}
          tracking={site.trackingStartedAt !== null}
          cookieless={site.cookieless}
        />
      )}
    </SiteShell>
  );
}

function Funnels({
  domain,
  timezone,
  tracking,
  cookieless,
}: {
  domain: string;
  timezone: string;
  tracking: boolean;
  cookieless: boolean;
}) {
  // Funnels don't take filters yet; ?f= is kept in the URL for the other tabs
  const { today, range, preset, hourly, hourNow, searchParams, navigate, setRange } = useSiteRange(timezone, tracking);
  const funnels = useQuery(api.funnels.list, { domain });
  const result = useQuery(api.funnels.results, {
    domain,
    range: hourly !== null ? { period: hourly, now: hourNow } : range,
  });
  // Keep the last numbers on screen while the next range loads
  const [last, setLast] = useState(result);
  if (result !== undefined && result !== last) setLast(result);
  const shown = result ?? last;
  // ?new=1 (the Analytics card's "Create a funnel") opens the form. The param stays until
  // the form closes, so a remount while the site loads still opens it.
  const [creatingState, setCreatingState] = useState(false);
  const creating = creatingState || searchParams.get("new") === "1";
  function setCreating(open: boolean) {
    setCreatingState(open);
    if (!open && searchParams.get("new") !== null) navigate({ set: { new: null } });
  }
  // The funnel whose card is swapped for the form, and the one Delete asks about
  const [editing, setEditing] = useState<Id<"funnels"> | null>(null);
  const [deleting, setDeleting] = useState<Funnel | null>(null);

  const full = funnels !== undefined && funnels.length >= MAX_FUNNELS;
  const blocked = cookieless || shown?.status === "cookieless";
  return (
    <div className="flex flex-col gap-10">
      <SiteHeader
        title="Funnels"
        range={range}
        preset={preset}
        today={today}
        onRange={setRange}
        filters={[]}
        onFilters={() => {}}
        actions={
          !blocked && (
            <Button
              onClick={() => setCreating(true)}
              disabled={creating || full || funnels === undefined}
              title={full ? `A site can have at most ${MAX_FUNNELS} funnels` : undefined}
            >
              <PlusIcon />
              New funnel
            </Button>
          )
        }
      />
      {blocked ? (
        <CookielessNotice domain={domain} />
      ) : (
        <>
          {creating && <FunnelForm domain={domain} onDone={() => setCreating(false)} />}
          {shown?.status === "tooMany" && (
            <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              There are too many visits in this range to work out funnels. Pick a shorter range.
            </p>
          )}
          {funnels === undefined ? (
            <div className="h-64 animate-pulse rounded-lg border border-border bg-muted/30" />
          ) : funnels.length === 0 ? (
            !creating && <EmptyState onCreate={() => setCreating(true)} />
          ) : (
            <div className="flex flex-col gap-6">
              {funnels.map((f) =>
                editing === f.id ? (
                  <FunnelForm key={f.id} domain={domain} funnel={f} onDone={() => setEditing(null)} />
                ) : (
                  <FunnelCard
                    key={f.id}
                    funnel={f}
                    numbers={funnelNumbers(f, shown)}
                    loading={result === undefined}
                    actions={
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditing(f.id)}
                          aria-label={`Edit ${f.name}`}
                          title="Edit"
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleting(f)}
                          aria-label={`Delete ${f.name}`}
                          title="Delete"
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    }
                  />
                ),
              )}
            </div>
          )}
        </>
      )}
      <DeleteFunnelDialog domain={domain} funnel={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

/** Asks before deleting a funnel, in the app (not the browser's confirm()). */
function DeleteFunnelDialog({
  domain,
  funnel,
  onClose,
}: {
  domain: string;
  funnel: Funnel | null;
  onClose: () => void;
}) {
  const remove = useMutation(api.funnels.remove);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keep the name on screen while the dialog closes
  const [shown, setShown] = useState(funnel);
  if (funnel !== null && funnel !== shown) setShown(funnel);

  async function confirm() {
    if (funnel === null) return;
    setPending(true);
    setError(null);
    try {
      await remove({ domain, id: funnel.id });
      onClose();
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : "Could not delete the funnel");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog
      open={funnel !== null}
      onOpenChange={(open) => {
        if (!open && !pending) {
          setError(null);
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {shown ? `“${shown.name}”` : "this funnel"}?</AlertDialogTitle>
          <AlertDialogDescription>
            The funnel goes from the Funnels tab and the Analytics tab. Your pageviews and events stay, so you can
            make it again later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-down">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? "Deleting…" : "Delete funnel"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CookielessNotice({ domain }: { domain: string }) {
  return (
    <section className="flex flex-col items-start gap-2 rounded-lg border border-border px-5 py-8 sm:px-8">
      <h2 className="font-medium">Funnels need visitor ids</h2>
      <p className="max-w-2xl text-sm text-muted-foreground">
        <CookielessExplanation domain={domain} />
      </p>
    </section>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="flex flex-col items-start gap-4 rounded-lg border border-border px-5 py-8 sm:px-8">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">No funnels yet</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Line up {MIN_STEPS} to {MAX_STEPS} steps, pages or events, such as / → /pricing → /signup → signup, and see
          how many visitors reach each one within a time window, and where they leave.
        </p>
      </div>
      <Button variant="outline" onClick={onCreate}>
        <PlusIcon />
        New funnel
      </Button>
    </section>
  );
}

type DraftStep = { id: number; kind: FunnelStep["kind"]; value: string; label: string };
let nextStepId = 0;
const draftStep = (kind: FunnelStep["kind"], value = "", label = ""): DraftStep => ({
  id: ++nextStepId,
  kind,
  value,
  label,
});
const toStep = (d: DraftStep): FunnelStep => {
  const named = d.label.trim() ? { label: d.label } : {};
  return d.kind === "page" ? { kind: "page", pattern: d.value, ...named } : { kind: "event", name: d.value, ...named };
};
// Whole days of two or more open in days, as the card labels them
const inDays = (hours: number) => hours % 24 === 0 && hours >= 48;

/**
 * The New funnel form, or the Edit form pre-filled from `funnel`: a name, 2 to 8 ordered
 * steps (a page pattern or an event name, with the site's goals and recorded events
 * offered, and an optional display name) and the completion window.
 */
function FunnelForm({ domain, funnel, onDone }: { domain: string; funnel?: Funnel; onDone: () => void }) {
  const create = useMutation(api.funnels.create);
  const save = useMutation(api.funnels.update);
  const eventNames = useQuery(api.sites.goalNames, { domain });
  const goals = useQuery(api.goals.list, { domain });
  const [name, setName] = useState(funnel?.name ?? "");
  const [steps, setSteps] = useState<DraftStep[]>(() =>
    funnel
      ? funnel.steps.map((s) => draftStep(s.kind, stepTarget(s), s.label ?? ""))
      : [draftStep("page", "/"), draftStep("page")],
  );
  const startHours = funnel?.windowHours ?? DEFAULT_WINDOW_HOURS;
  const [windowValue, setWindowValue] = useState(String(inDays(startHours) ? startHours / 24 : startHours));
  const [unit, setUnit] = useState<"hours" | "days">(inDays(startHours) ? "days" : "hours");
  const title = funnel ? "Edit funnel" : "New funnel";
  const [errors, setErrors] = useState<Map<number, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const pagePaths = goals?.filter((g) => g.kind === "page").map((g) => g.key) ?? [];
  const events = [...new Set([...(goals?.filter((g) => g.kind === "event").map((g) => g.key) ?? []), ...(eventNames ?? [])])];
  const windowHours = Number(windowValue) * (unit === "days" ? 24 : 1);

  function update(id: number, patch: Partial<DraftStep>) {
    setSteps((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setErrors((all) => {
      const next = new Map(all);
      next.delete(id);
      return next;
    });
    setError(null);
  }
  function move(index: number, by: -1 | 1) {
    setSteps((all) => {
      const next = [...all];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = new Map<number, string>();
    for (const s of steps) {
      const message = stepError(toStep(s));
      if (message !== null) found.set(s.id, message);
    }
    setErrors(found);
    if (!name.trim()) return setError("Give the funnel a name");
    if (!Number.isInteger(windowHours) || windowHours < 1 || windowHours > MAX_WINDOW_HOURS) {
      return setError(`The window is 1 hour to ${MAX_WINDOW_HOURS / 24} days, in whole hours`);
    }
    if (found.size > 0) return;
    setPending(true);
    setError(null);
    try {
      const args = { domain, name, steps: steps.map(toStep), windowHours };
      if (funnel) await save({ ...args, id: funnel.id });
      else await create(args);
      onDone();
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : `Could not ${funnel ? "save" : "create"} the funnel`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} aria-label={title} className="flex flex-col gap-5 rounded-lg border border-border px-4 py-5 sm:px-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-medium">{title}</h2>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onDone} aria-label="Close">
          <XIcon />
        </Button>
      </div>
      <label className="flex max-w-md flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Name</span>
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="Signup"
          maxLength={MAX_FUNNEL_NAME}
          autoComplete="off"
          autoFocus
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-xs text-muted-foreground">
          Steps, in order. Pages take * wildcards: /blog/* is every page under /blog. A name is optional and shows
          on the card.
        </legend>
        <ol className="flex flex-col gap-2">
          {steps.map((s, i) => (
            <li key={s.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] text-muted-foreground tabular-nums">
                  {i + 1}
                </span>
                <select
                  value={s.kind}
                  onChange={(e) => update(s.id, { kind: e.target.value as FunnelStep["kind"] })}
                  aria-label={`Step ${i + 1} type`}
                  className="h-8 shrink-0 rounded-lg border border-input bg-background px-2 text-sm dark:bg-input/30"
                >
                  <option value="page">Page</option>
                  <option value="event">Event</option>
                </select>
                <Input
                  value={s.value}
                  onChange={(e) => update(s.id, { value: e.target.value })}
                  aria-label={`Step ${i + 1} ${s.kind === "page" ? "path" : "event name"}`}
                  aria-invalid={errors.has(s.id) || undefined}
                  list={s.kind === "page" ? "funnel-pages" : "funnel-events"}
                  placeholder={s.kind === "page" ? "/pricing" : "signup"}
                  autoComplete="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 font-mono"
                />
                <div className="flex shrink-0 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move step ${i + 1} up`}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => move(i, 1)}
                    disabled={i === steps.length - 1}
                    aria-label={`Move step ${i + 1} down`}
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setSteps((all) => all.filter((x) => x.id !== s.id))}
                    disabled={steps.length <= MIN_STEPS}
                    aria-label={`Remove step ${i + 1}`}
                  >
                    <XIcon />
                  </Button>
                </div>
              </div>
              <div className="pl-7">
                <Input
                  value={s.label}
                  onChange={(e) => update(s.id, { label: e.target.value })}
                  aria-label={`Step ${i + 1} name (optional)`}
                  placeholder={i === 0 ? "Name, optional: Visited the home page" : "Name, optional"}
                  maxLength={MAX_STEP_NAME}
                  autoComplete="off"
                  className="h-7 max-w-md text-[13px]"
                />
              </div>
              {errors.has(s.id) && <p className="pl-7 text-xs text-down">{errors.get(s.id)}</p>}
            </li>
          ))}
        </ol>
        <datalist id="funnel-pages">
          {pagePaths.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <datalist id="funnel-events">
          {events.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        {steps.length < MAX_STEPS && (
          <div className="pl-7">
            <Button type="button" variant="outline" size="sm" onClick={() => setSteps((all) => [...all, draftStep("page")])}>
              <PlusIcon />
              Add step
            </Button>
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <span id="funnel-window" className="text-xs text-muted-foreground">
          Completed within, from the first step
        </span>
        <div className="flex items-center gap-2" role="group" aria-labelledby="funnel-window">
          <Input
            type="number"
            min={1}
            step={1}
            value={windowValue}
            onChange={(e) => {
              setWindowValue(e.target.value);
              setError(null);
            }}
            aria-label="Window length"
            className="w-24 tabular-nums"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as "hours" | "days")}
            aria-label="Window unit"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm dark:bg-input/30"
          >
            <option value="hours">hours</option>
            <option value="days">days</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {funnel ? (pending ? "Saving…" : "Save funnel") : pending ? "Creating…" : "Create funnel"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        {error && <p className="text-sm text-down">{error}</p>}
      </div>
    </form>
  );
}
