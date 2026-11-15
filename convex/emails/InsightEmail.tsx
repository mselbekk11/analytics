import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { Cadence } from "../lib/insights";
import { percentChange, rangeDays } from "../lib/ranges";

// The insight email (launch v1 Phase 15). Tables and inline styles only (React Email's
// Section/Row/Column), a single 560px column, and no images, so it reads the same in
// Gmail, Outlook and plain clients; a plain-text part is rendered from it too.

export type InsightSite = {
  domain: string;
  from: string;
  to: string;
  visitors: { current: number; previous: number | null };
  pageviews: { current: number; previous: number | null };
  revenue: { current: number; previous: number; currency: string } | null;
  keyGoal: { name: string; current: number; previous: number } | null;
  sources: { name: string; visitors: number }[];
  pages: { path: string; pageviews: number }[];
};

export type InsightEmailProps = {
  cadence: Cadence;
  sites: InsightSite[];
  appUrl: string;
  unsubscribeUrl: string;
};

const CADENCE_NAME: Record<Cadence, string> = { daily: "daily", weekly: "weekly", monthly: "monthly" };
const CADENCE_TITLE: Record<Cadence, string> = {
  daily: "Your daily insights",
  weekly: "Your weekly insights",
  monthly: "Your monthly insights",
};
/** What the change compares against: the equal-length range before, as the dashboard does. */
function previousLabel(cadence: Cadence, from: string, to: string): string {
  if (cadence === "daily") return "vs the day before";
  if (cadence === "weekly") return "vs the week before";
  return `vs the ${rangeDays({ from, to })} days before`;
}

const numberFormat = new Intl.NumberFormat("en-US");

export function formatCount(n: number): string {
  return numberFormat.format(n);
}

/** Minor units as money in `currency`, e.g. 123450 USD → "$1,234.50". */
export function formatMoney(minor: number, currency: string): string {
  let f: Intl.NumberFormat;
  try {
    f = new Intl.NumberFormat("en-US", { style: "currency", currency });
  } catch {
    f = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  }
  const digits = f.resolvedOptions().maximumFractionDigits ?? 2;
  return f.format(minor / 10 ** digits);
}

/** "+12%", "−8%", "0%", or null when there's nothing to compare against. */
export function formatChange(current: number, previous: number | null): string | null {
  if (previous === null) return null;
  const change = percentChange(current, previous);
  if (change === null) return null;
  const pct = Math.round(change * 100);
  if (pct === 0) return "0%";
  return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}

const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fullDay = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** "Sunday, Nov 15, 2026", "Nov 9 – 15, 2026", "Oct 26 – Nov 1, 2026" or "October 2026". */
export function formatPeriod(cadence: Cadence, from: string, to: string): string {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  if (cadence === "daily" || from === to) return fullDay.format(a);
  if (cadence === "monthly") return monthYear.format(a);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  const end = sameMonth ? String(b.getUTCDate()) : monthDay.format(b);
  return `${monthDay.format(a)} – ${end}, ${b.getUTCFullYear()}`;
}

export function dashboardUrl(appUrl: string, site: { domain: string; from: string; to: string }): string {
  return `${appUrl.replace(/\/$/, "")}/sites/${encodeURIComponent(site.domain)}?range=${site.from}_${site.to}`;
}

export function insightSubject(cadence: Cadence, sites: InsightSite[]): string {
  const first = sites[0];
  const period = first === undefined ? "" : `: ${formatPeriod(cadence, first.from, first.to)}`;
  return `${CADENCE_TITLE[cadence]}${period}`;
}

const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const s = {
  body: { backgroundColor: "#f5f5f5", margin: 0, padding: "24px 0", fontFamily: font, color: "#171717" },
  container: { backgroundColor: "#ffffff", border: "1px solid #e5e5e5", borderRadius: "8px", maxWidth: "560px", padding: "32px 28px" },
  brand: { fontSize: "13px", fontWeight: 600, color: "#737373", margin: "0 0 4px" },
  title: { fontSize: "22px", fontWeight: 600, margin: "0 0 4px", lineHeight: "28px" },
  period: { fontSize: "14px", color: "#737373", margin: 0 },
  domain: { fontSize: "17px", fontWeight: 600, margin: 0, lineHeight: "24px" },
  open: { fontSize: "13px", color: "#2563eb", textDecoration: "none" },
  sitePeriod: { fontSize: "12px", color: "#737373", margin: "2px 0 0" },
  tile: { padding: "10px 12px 10px 0", verticalAlign: "top" as const },
  tileLabel: { fontSize: "12px", color: "#737373", margin: 0, lineHeight: "16px" },
  tileValue: { fontSize: "20px", fontWeight: 600, margin: "2px 0 0", lineHeight: "26px" },
  listTitle: { fontSize: "12px", fontWeight: 600, color: "#737373", margin: "0 0 4px", textTransform: "uppercase" as const, letterSpacing: "0.04em" },
  listRow: { fontSize: "13px", margin: 0, lineHeight: "22px" },
  listCount: { fontSize: "13px", margin: 0, lineHeight: "22px", color: "#737373", textAlign: "right" as const },
  hr: { borderColor: "#e5e5e5", margin: "24px 0" },
  footer: { fontSize: "12px", color: "#737373", lineHeight: "18px", margin: "0 0 6px" },
  footerLink: { color: "#737373", textDecoration: "underline" },
};

function changeStyle(change: string | null) {
  const color = change === null || change === "0%" ? "#737373" : change.startsWith("+") ? "#15803d" : "#b91c1c";
  return { fontSize: "12px", fontWeight: 500, color, margin: "2px 0 0", lineHeight: "16px" };
}

function Tile({ label, value, change }: { label: string; value: string; change: string | null }) {
  return (
    <Column style={s.tile}>
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={s.tileValue}>{value}</Text>
      <Text style={changeStyle(change)}>{change ?? "–"}</Text>
    </Column>
  );
}

function List({ title, rows }: { title: string; rows: { label: string; count: string }[] }) {
  return (
    <Section style={{ marginTop: "12px" }}>
      <Text style={s.listTitle}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={{ ...s.listRow, color: "#737373" }}>None</Text>
      ) : (
        rows.map((r, i) => (
          <Row key={i}>
            <Column style={{ width: "80%" }}>
              <Text style={s.listRow}>{r.label}</Text>
            </Column>
            <Column style={{ width: "20%" }}>
              <Text style={s.listCount}>{r.count}</Text>
            </Column>
          </Row>
        ))
      )}
    </Section>
  );
}

function SiteBlock({ site, cadence, appUrl, showPeriod }: { site: InsightSite; cadence: Cadence; appUrl: string; showPeriod: boolean }) {
  const tiles = [
    { label: "Visitors", value: formatCount(site.visitors.current), change: formatChange(site.visitors.current, site.visitors.previous) },
    { label: "Pageviews", value: formatCount(site.pageviews.current), change: formatChange(site.pageviews.current, site.pageviews.previous) },
  ];
  if (site.revenue !== null) {
    tiles.push({
      label: "Revenue",
      value: formatMoney(site.revenue.current, site.revenue.currency),
      change: formatChange(site.revenue.current, site.revenue.previous),
    });
  }
  if (site.keyGoal !== null) {
    tiles.push({
      label: site.keyGoal.name,
      value: formatCount(site.keyGoal.current),
      change: formatChange(site.keyGoal.current, site.keyGoal.previous),
    });
  }
  return (
    <Section>
      <Row>
        <Column>
          <Heading as="h2" style={s.domain}>
            {site.domain}
          </Heading>
        </Column>
        <Column style={{ textAlign: "right" }}>
          <Link href={dashboardUrl(appUrl, site)} style={s.open}>
            Open dashboard →
          </Link>
        </Column>
      </Row>
      {showPeriod && <Text style={s.sitePeriod}>{formatPeriod(cadence, site.from, site.to)} in this site&apos;s timezone</Text>}
      <Row>
        {tiles.map((t) => (
          <Tile key={t.label} {...t} />
        ))}
      </Row>
      <List title="Top sources" rows={site.sources.map((r) => ({ label: r.name, count: formatCount(r.visitors) }))} />
      <List title="Top pages" rows={site.pages.map((r) => ({ label: r.path, count: formatCount(r.pageviews) }))} />
    </Section>
  );
}

export default function InsightEmail({ cadence, sites, appUrl, unsubscribeUrl }: InsightEmailProps) {
  const first = sites[0];
  const period = first === undefined ? "" : formatPeriod(cadence, first.from, first.to);
  const visitors = sites.reduce((n, x) => n + x.visitors.current, 0);
  const preview = `${period}: ${formatCount(visitors)} visitors across ${sites.length} ${sites.length === 1 ? "site" : "sites"}`;
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          <Text style={s.brand}>Simple Stats</Text>
          <Heading as="h1" style={s.title}>
            {CADENCE_TITLE[cadence]}
          </Heading>
          <Text style={s.period}>
            {period}
            {first !== undefined && ` · changes ${previousLabel(cadence, first.from, first.to)}`}
          </Text>
          {sites.map((site) => (
            <Section key={site.domain}>
              <Hr style={s.hr} />
              <SiteBlock
                site={site}
                cadence={cadence}
                appUrl={appUrl}
                showPeriod={first !== undefined && (site.from !== first.from || site.to !== first.to)}
              />
            </Section>
          ))}
          <Hr style={s.hr} />
          <Text style={s.footer}>
            Sites with no visitors in this period are left out. You get this because {CADENCE_NAME[cadence]} insight
            emails are on for your Simple Stats account.
          </Text>
          <Text style={s.footer}>
            <Link href={unsubscribeUrl} style={s.footerLink}>
              Unsubscribe from {CADENCE_NAME[cadence]} emails
            </Link>
            {" · "}
            <Link href={`${appUrl.replace(/\/$/, "")}/settings`} style={s.footerLink}>
              Email settings
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
