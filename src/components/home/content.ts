import type { LucideIcon } from "lucide-react";
import {
  ChartLine,
  CircleDollarSign,
  CircleQuestionMark,
  Code,
  Funnel,
  Radio,
  Search,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import type { IconType } from "react-icons";
import {
  SiClaude,
  SiCursor,
  SiNextdotjs,
  SiReact,
  SiShopify,
  SiStripe,
  SiVercel,
  SiWebflow,
  SiWordpress,
} from "react-icons/si";

/**
 * Every word on the homepage, kept apart from the layout so it can be edited without
 * touching components. Claims about the live product must stay true: unbuilt features
 * carry `soon: true`, and the script size, Stripe + API, cookieless mode and MCP are real.
 */

/** Every call to action goes here. Sign-up stays invite-only. */
export const SIGN_IN = "/sign-in";

/** An in-page anchor such as "#s-pricing". */
export type Anchor = `#${string}`;
export type PageLink = { label: string; href: Anchor };

export const meta = {
  title: "Analytics: website analytics that ties revenue to traffic",
  description:
    "See where your visitors come from and which visits turn into payments. One small script, Stripe and API revenue, a live map, a cookieless mode and an MCP server.",
};

export const nav = {
  links: [
    { label: "Features", href: "#s-traffic" },
    { label: "Pricing", href: "#s-pricing" },
    { label: "FAQ", href: "#s-faq" },
  ] satisfies PageLink[],
  cta: "Dashboard",
};

export type Integration = { name: string; icon: IconType };

export const hero = {
  pill: { label: "New", text: "MCP server: ask Claude or Cursor about your stats", href: "#s-ai" as Anchor },
  heading: ["Know which visits", "turn into revenue."] as [string, string],
  paragraph:
    "Analytics counts your visitors, shows where they came from, and ties each payment to the visit that brought it. One script of about 2\u00a0KB, with a cookieless mode when you need one.",
  primary: "Go to dashboard",
  secondary: { label: "See features", href: "#s-traffic" as Anchor },
  // Seeds for the persona generator (emoji on a colour), not real people
  avatarSeeds: ["hero-2", "maker-c", "hero-3", "maker-d", "hero-1"],
  socialLine: "Built for founders & small teams · 7-day free trial, no card",
  integrationsLabel: "Integrates with",
  // Only things that work today: the script tag runs on any site, Stripe and MCP are built
  integrations: [
    { name: "Stripe", icon: SiStripe },
    { name: "Claude", icon: SiClaude },
    { name: "Cursor", icon: SiCursor },
    { name: "Vercel", icon: SiVercel },
    { name: "Next.js", icon: SiNextdotjs },
    { name: "React", icon: SiReact },
    { name: "WordPress", icon: SiWordpress },
    { name: "Shopify", icon: SiShopify },
    { name: "Webflow", icon: SiWebflow },
  ] satisfies Integration[],
  figure: { n: 1, caption: "The Analytics dashboard: visitors, pageviews, revenue and signups over the last 24 hours." },
};

export type SectionId =
  | "s-traffic"
  | "s-revenue"
  | "s-funnels"
  | "s-search"
  | "s-live"
  | "s-ai"
  | "s-setup"
  | "s-pricing"
  | "s-customers"
  | "s-faq";

export type FigureMeta = { n: number; caption: string };

export type HomeSection = {
  id: SectionId;
  number: string; // "01"
  eyebrow: string; // after the number, above the heading
  label: string; // in the Contents sidebar
  icon: LucideIcon;
  heading: [string, string]; // two lines on wider screens
  paragraph: string;
  highlight?: string; // a phrase of `paragraph` set in the foreground colour
  figures: FigureMeta[];
  soon?: boolean; // not built yet: shows a "Soon" badge in the section and the sidebar
};

export const sections: HomeSection[] = [
  {
    id: "s-traffic",
    number: "01",
    eyebrow: "Traffic",
    label: "Traffic",
    icon: ChartLine,
    heading: ["Every visit, traced back", "to where it started."],
    paragraph:
      "Sources, referrers, campaigns, pages, countries and devices, each one ranked. Visits from ChatGPT, Claude and Perplexity land in their own AI channel. Click any row and the whole dashboard filters to it.",
    highlight: "Click any row and the whole dashboard filters to it.",
    figures: [{ n: 2, caption: "Pages ranked by views, with a trend line and the revenue each one led to." }],
  },
  {
    id: "s-revenue",
    number: "02",
    eyebrow: "Revenue",
    label: "Revenue",
    icon: CircleDollarSign,
    heading: ["Each payment, credited", "to the visit behind it."],
    paragraph:
      "Connect Stripe, or send payments from your own backend through the API. Each one is tied to the visitor who paid, so you can see which sources, countries and pages bring in money, not just clicks.",
    figures: [{ n: 3, caption: "Revenue by day, with the sources and countries that brought it in." }],
  },
  {
    id: "s-funnels",
    number: "03",
    eyebrow: "Funnels and goals",
    label: "Funnels",
    icon: Funnel,
    heading: ["Find the step", "where people drop off."],
    paragraph:
      "Line up two to eight steps, pages or goals, and see how many visitors reach each one and how many leave along the way. Goals count signups and other key actions as conversions.",
    figures: [
      { n: 4, caption: "A signup funnel, step by step, over 24 hours." },
      { n: 5, caption: "Goals with their conversion rate and top source." },
    ],
    soon: true,
  },
  {
    id: "s-search",
    number: "04",
    eyebrow: "Search",
    label: "Search",
    icon: Search,
    heading: ["Your search rankings,", "on the same page."],
    paragraph:
      "Clicks, impressions, click-through rate and average position from Google Search Console and Bing Webmaster Tools, for every page and keyword, beside the visits they bring.",
    figures: [{ n: 6, caption: "Search clicks, impressions and average position over four weeks." }],
    soon: true,
  },
  {
    id: "s-live",
    number: "05",
    eyebrow: "Realtime and visitors",
    label: "Realtime",
    icon: Radio,
    heading: ["See who is on your site", "right now."],
    paragraph:
      "A live map shows each visitor's page, location and source as it happens. Open any visitor to see every session they've had, from the first landing page to the payment.",
    figures: [{ n: 7, caption: "The live view: who's online, where they are and what they're reading." }],
  },
  {
    id: "s-ai",
    number: "06",
    eyebrow: "Ask AI",
    label: "Ask AI",
    icon: Sparkles,
    heading: ["Ask about your stats", "in plain English."],
    paragraph:
      "Connect Claude Code, Claude Desktop or Cursor through the MCP server and ask about visitors, pages, sources and revenue. It works today. An assistant built into the dashboard is coming soon.",
    figures: [],
  },
  {
    id: "s-setup",
    number: "07",
    eyebrow: "Setup and privacy",
    label: "Setup",
    icon: Code,
    heading: ["Paste one tag,", "see your first visitor."],
    paragraph:
      "Works on any site or framework. By default the script sets first-party cookies, so a returning visitor is counted once. Switch a site to cookieless in its settings and it stores no visitor ids at all.",
    highlight: "Switch a site to cookieless",
    figures: [],
  },
  {
    id: "s-pricing",
    number: "08",
    eyebrow: "Pricing",
    label: "Pricing",
    icon: Tag,
    heading: ["Every feature on every plan.", "You only choose the volume."],
    paragraph:
      "Up to 20 sites and the full feature set on all plans; they only change how many events you can send each month. Try any of them free for 7 days, no card needed.",
    figures: [],
  },
  {
    id: "s-customers",
    number: "09",
    eyebrow: "Customers",
    label: "Customers",
    icon: Users,
    heading: ["Made for people", "who ship small products."],
    paragraph:
      "Founders, indie makers and small teams who want to know what brings in visitors and revenue, without another tool to look after.",
    figures: [],
  },
  {
    id: "s-faq",
    number: "10",
    eyebrow: "FAQ",
    label: "FAQ",
    icon: CircleQuestionMark,
    heading: ["Questions,", "answered."],
    paragraph: "The short version of what people ask before they sign in for the first time.",
    figures: [],
  },
];

export const sidebar = {
  title: "Contents",
  cta: "Go to dashboard",
  note: "7 days free, then from $5/mo",
};

export const finalCta = {
  heading: ["Find out what's working", "on your site."] as [string, string],
  button: "Start free trial",
  note: "7 days free, then from $5/mo",
};

// /privacy joins these in Phase 2
export const footer = {
  copyright: "© 2026 Analytics",
  links: [
    { label: "Features", href: "#s-traffic" },
    { label: "Pricing", href: "#s-pricing" },
    { label: "FAQ", href: "#s-faq" },
  ] satisfies PageLink[],
};
