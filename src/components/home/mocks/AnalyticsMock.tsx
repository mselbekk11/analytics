import BarLineChart from "./BarLineChart";
import { analyticsMock as data } from "./fixtures";
import MockViewport from "./MockViewport";
import { MOCK_COLUMN, MockHeader, MockLegend, MockTiles, MockTopBar } from "./parts";

// Drawn at a wide desktop size so the dashboard's 1200px column sits with margins either
// side, as in the hero screenshot; the fold (and the hero's fade) cuts the chart off.
const WIDTH = 1440;
const HEIGHT = 720;
// The chart's width inside the column: 1200 − 2 × 32 padding − 2 × 1 border − 2 × 24 padding
const CHART_WIDTH = 1086;

/**
 * Fig. 1: the Analytics tab of a made-up site, as the dashboard draws it: top bar and tabs,
 * the header with the range controls, seven joined tiles, a legend and the bar-and-line chart.
 */
export default function AnalyticsMock() {
  return (
    <MockViewport width={WIDTH} height={HEIGHT}>
      <MockTopBar site={data.site} online={data.online} initials={data.initials} active="Analytics" />
      <div className={`${MOCK_COLUMN} flex flex-col gap-10 pt-10`}>
        <MockHeader header={data.header} />
        <div className="overflow-hidden rounded-lg border border-border">
          <MockTiles tiles={data.tiles} />
          <div className="flex flex-col gap-4 border-t border-border px-6 pt-6 pb-4">
            <MockLegend chart={data.chart} />
            <BarLineChart id="mock-analytics" chart={data.chart} width={CHART_WIDTH} />
          </div>
        </div>
      </div>
    </MockViewport>
  );
}
