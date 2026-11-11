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
import { TIERS, type Tier } from "@/lib/pricing";

/**
 * Every word on the homepage, kept apart from the layout so it can be edited without
 * touching components. Claims about the live product must stay true: unbuilt features
 * carry `soon: true`, and the script size, Stripe + API, cookieless mode and MCP are real.
 */

/** Every call to action goes here. Sign-up stays invite-only. */
export const SIGN_IN = "/sign-in";

/** Placeholder: the owner fills in the real address. Used by the FAQ and /privacy. */
export const CONTACT_EMAIL = "hello@example.com";

/** An in-page anchor such as "#s-pricing". */
export type Anchor = `#${string}`;
export type PageLink = { label: string; href: Anchor };

export const meta = {
  title: "Simple Stats: website analytics that ties revenue to traffic",
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
    "Simple Stats counts your visitors, shows where they came from, and ties each payment to the visit that brought it. One script of about 2\u00a0KB, with a cookieless mode when you need one.",
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
  figure: { n: 1, caption: "The Simple Stats dashboard: visitors, pageviews, revenue and signups over the last 24 hours." },
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

/** One fact of a stat strip: a short value over a muted line. Must be true of the live product. */
export type StatFact = { value: string; label: string };

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
  strip?: StatFact[]; // three facts under the figures, with a top rule
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
    strip: [
      { value: "Stripe + API", label: "payments credited to a visit" },
      { value: "Journeys", label: "every session before a payment" },
      { value: "Key goal", label: "signups counted as conversions" },
    ],
    soon: true,
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
      "Connect Claude Code, Claude Desktop or Cursor through the MCP server and ask about visitors, pages, sources and revenue. It works today.",
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
      "Works on any site or framework. By default the script sets first-party cookies, so a returning visitor is counted once. Switch a site to cookieless under Settings\u00a0→\u00a0Privacy\u00a0→\u00a0Visitor\u00a0identity and it stores no visitor ids at all.",
    highlight: "Switch a site to cookieless",
    figures: [],
    strip: [
      { value: "~2 KB", label: "gzipped, loads async" },
      { value: "30 s", label: "to your first visitor" },
      { value: "0", label: "cookies in cookieless mode" },
    ],
  },
  {
    id: "s-pricing",
    number: "08",
    eyebrow: "Pricing",
    label: "Pricing",
    icon: Tag,
    heading: ["One plan with every feature.", "You only choose the volume."],
    paragraph:
      "Up to 20 sites and the full feature set at every tier: slide to the number of events you send each month. Try it free for 7 days, no card needed.",
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

/**
 * One way to ask about your stats, beside the Ask AI card. `soon` shows a Soon badge in place
 * of `via`; `hidden` keeps a row in the content but off the page.
 */
export type Connection = { name: string; description: string; via?: string; soon?: boolean; hidden?: boolean };

/**
 * 06 Ask AI's list. The MCP rows name only the clients the setup guide in Settings covers
 * (src/components/McpSetup.tsx): Claude Code, Claude Desktop and Cursor. The card's
 * question and answer are mockup data, in `askAiMock` (mocks/fixtures.ts).
 */
export const askAi = {
  label: "Ways to connect",
  connections: [
    // Hidden until it's decided whether a built-in assistant gets built.
    { name: "Ask AI", description: "Built into the dashboard", soon: true, hidden: true },
    { name: "Claude Code", description: "In your terminal", via: "MCP" },
    { name: "Claude Desktop", description: "The desktop app", via: "MCP" },
    { name: "Cursor", description: "Ask while you build", via: "MCP" },
  ] satisfies Connection[],
};

/**
 * 07 Setup's code block: a muted comment, then the real embed tag for a placeholder
 * domain, built with the dashboard's own snippet helper (src/lib/snippet.ts).
 */
export const setup = {
  comment: "<!-- paste before </head> -->",
  domain: "your-site.com",
};

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

export type Feature = { label: string; soon?: boolean };

/**
 * The one plan, priced by events on a slider. The tiers and their prices come from
 * convex/lib/tiers.ts, which also makes the Stripe prices, so the homepage, /billing and
 * Stripe can't disagree. The last step of the slider is "Get in touch".
 */
export const pricing: {
  monthly: string;
  yearly: string;
  yearlyNote: string;
  eventsLabel: string;
  tiers: readonly Tier[];
  cta: string;
  ctaNote: string;
  contact: { heading: string; note: string; cta: string };
  includesLabel: string;
  includes: Feature[];
} = {
  monthly: "Monthly",
  yearly: "Yearly",
  yearlyNote: "2 months free",
  eventsLabel: "events / month",
  tiers: TIERS,
  cta: "Start free trial",
  ctaNote: "7 days free, no card needed",
  contact: {
    heading: "More than 10M events a month?",
    note: "Tell us about your traffic and we'll put a plan together.",
    cta: "Get in touch",
  },
  includesLabel: "Every tier includes",
  includes: [
    { label: "Revenue and goal attribution", soon: true },
    { label: "Customer journeys, session by session" },
    { label: "Realtime map and visitor feed" },
    { label: "MCP access for Claude and Cursor" },
    { label: "Cookieless mode" },
    { label: "Excluded paths and path grouping" },
    { label: "Funnels", soon: true },
    { label: "Search Console and Bing", soon: true },
  ],
};

/**
 * A quote card. While `placeholder` is set the card shows an "Example" label and the name
 * comes from the persona generator (`seed`), so no real person is implied. To use a real
 * quote, set `name` and `role`, replace `quote` and drop `placeholder`.
 */
export type Quote = {
  seed: string; // avatar (emoji on a colour), and the name when `name` is unset
  name?: string;
  role: string;
  quote: string;
  placeholder?: boolean;
};

export const customers: { exampleLabel: string; quotes: Quote[] } = {
  exampleLabel: "Example",
  quotes: [
    {
      seed: "quote-1",
      role: "Indie maker, newsletter tool",
      quote: "I finally know which posts bring in paying customers, not just traffic.",
      placeholder: true,
    },
    {
      seed: "quote-2",
      role: "Solo founder, SaaS",
      quote: "Pasted the tag, and my first visitor was on the live map before I'd closed the tab.",
      placeholder: true,
    },
    {
      seed: "quote-3",
      role: "Marketer, two-person studio",
      quote: "Seeing ChatGPT and Perplexity as their own channel changed what we write about.",
      placeholder: true,
    },
    {
      seed: "quote-4",
      role: "Developer, open-source project",
      quote: "I ask Claude about last week's numbers from my terminal instead of opening another tab.",
      placeholder: true,
    },
    {
      seed: "quote-5",
      role: "Small team, developer tools",
      quote: "Switching our docs site to cookieless was one setting, and the numbers kept coming in.",
      placeholder: true,
    },
    {
      seed: "quote-6",
      role: "Founder, online course",
      quote: "Opening a customer and seeing every session before they paid is the part I use most.",
      placeholder: true,
    },
  ],
};

/** One FAQ entry. `email` adds the contact address as a link after the answer. */
export type FaqEntry = { question: string; answer: string; soon?: boolean; email?: boolean };

// Billing isn't built: the answers on events, limits and cancelling describe the intended
// plans, so the owner should confirm them before taking payments.
export const faq: FaqEntry[] = [
  {
    question: "How is this different from Plausible or Fathom?",
    answer:
      "Both count visits well. Simple Stats also ties each payment from Stripe or the API to the visit that brought it, gives AI assistants such as ChatGPT, Claude and Perplexity their own traffic channel, and lets you ask about your stats from Claude or Cursor through an MCP server.",
  },
  {
    question: "What counts as an event?",
    answer:
      "Each pageview counts as one, and so does each custom event, such as a signup or a click on a link to another site. The small pings that measure time on page don't count.",
  },
  {
    question: "Do I need a cookie banner?",
    answer:
      "Not if you run it cookieless: with data-cookieless on the script tag it sets no cookies and stores nothing in the browser. By default it sets two first-party cookies to recognise returning visitors, and in the EU and UK analytics cookies generally need consent. This is general information, not legal advice.",
  },
  {
    question: "What happens if I go over my plan's events?",
    answer:
      "Nothing stops. Every event is still counted and your dashboard keeps working. If you stay over the limit, we'll get in touch about moving up a plan.",
  },
  {
    question: "Will the script slow my site down?",
    answer:
      "No. It's about 2\u00a0KB gzipped, loads with async so it never holds up the page, and sends small requests in the background.",
  },
  {
    question: "Can I import data from another tool?",
    answer:
      "Not yet. Importing your history from other analytics tools is on the way. Until then, counting starts with the first visit after you add the script.",
    soon: true,
  },
  {
    question: "Can I cancel at any time?",
    answer:
      "Yes. There's no contract: cancel whenever you like and you won't be charged again. Deleting a site from its settings removes all of its data.",
  },
  {
    question: "How do I get in touch?",
    answer: "Email us and we'll get back to you:",
    email: true,
  },
];

/** Links to other pages (rather than sections), shown after the section links. */
export type RouteLink = { label: string; href: `/${string}` };

export const footer = {
  copyright: "© 2026 Simple Stats",
  links: [
    { label: "Features", href: "#s-traffic" },
    { label: "Pricing", href: "#s-pricing" },
    { label: "FAQ", href: "#s-faq" },
  ] satisfies PageLink[],
  pages: [{ label: "Privacy", href: "/privacy" }] satisfies RouteLink[],
};
