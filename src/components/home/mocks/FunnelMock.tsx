import { CornerDownRightIcon } from "lucide-react";
import { formatChange, formatNumber, formatRate } from "@/lib/format";
import { funnelSteps } from "@/lib/mockCharts";
import { funnelMock as data } from "./fixtures";
import MockViewport from "./MockViewport";
import { MOCK_COLOR, MockPanelHeader } from "./parts";

// Half the width of Figs. 2 and 3, since it shares the row with Fig. 5; at about 560px the
// frame scales it by 0.6 to 0.65 on desktop, so the step names stay readable. Same size as
// GoalsMock, so the two frames line up.
const WIDTH = 560;
const HEIGHT = 470;

/**
 * Fig. 4: a signup funnel (not built yet), drawn in the dashboard's style: the header, then
 * one card with each step's name and target, a bar as long as its share of the first
 * step, the visitors and that share, and the drop-off to the next step; beside it the
 * funnel's overall conversion, entered, completed and median time.
 */
export default function FunnelMock() {
  const steps = funnelSteps(data.steps.map((s) => s.visitors));
  const first = steps[0];
  const last = steps[steps.length - 1];
  return (
    <MockViewport width={WIDTH} height={HEIGHT}>
      <div className="flex flex-col gap-5 px-6 pt-6">
        <MockPanelHeader title={data.title} note={data.note} range={data.range} action={data.action} />
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="flex flex-col gap-0.5 border-b border-border px-5 py-3.5">
            <span className="text-sm font-medium">{data.funnel}</span>
            <span className="text-xs text-muted-foreground">{data.window}</span>
          </div>
          <div className="flex">
            <ol className="flex min-w-0 flex-1 flex-col px-5 py-4">
              {data.steps.map((step, i) => (
                <li key={step.target} className="flex flex-col">
                  {i > 0 && (
                    <span className="flex items-center gap-1.5 py-2 pl-1 text-xs text-muted-foreground tabular-nums">
                      <CornerDownRightIcon className="size-3.5" />
                      {formatNumber(steps[i].dropped)} left
                      <span className="text-down">{formatChange(steps[i].ofPrevious - 1)}</span>
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <span className="min-w-0 truncate font-medium">{step.label}</span>
                    <span className="shrink-0 truncate text-xs text-muted-foreground">
                      {step.kind} · {step.target}
                    </span>
                    <span className="ml-auto shrink-0 pl-2 font-medium tabular-nums">
                      {formatNumber(steps[i].count)}
                    </span>
                    <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                      {formatRate(steps[i].ofFirst)}
                    </span>
                  </div>
                  <div className="mt-2 ml-7 h-2 overflow-hidden rounded-full bg-bar">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(steps[i].ofFirst * 100, 1)}%`, background: MOCK_COLOR.visitors }}
                    />
                  </div>
                </li>
              ))}
            </ol>
            <dl className="flex w-32 shrink-0 flex-col gap-4 border-l border-border px-4 py-4">
              <Stat label="Conversion" value={formatRate(last.ofFirst)} big />
              <Stat label="Entered" value={formatNumber(first.count)} />
              <Stat label="Completed" value={formatNumber(last.count)} />
              <Stat label="Median time" value={data.medianTime} />
            </dl>
          </div>
        </div>
      </div>
    </MockViewport>
  );
}

/** One figure in the side panel: a muted label over the value. */
function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={big ? "text-[1.625rem] leading-8 font-semibold tracking-tight tabular-nums" : "text-sm font-medium tabular-nums"}>
        {value}
      </dd>
    </div>
  );
}
