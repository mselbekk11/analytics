/**
 * The words on /privacy, adapted from docs/PRIVACY.md (which is written for the tracked
 * sites' own policies) to cover the product: tracked sites' visitors, account holders and
 * the services we use. A draft for the owner to review; keep it true to what the script
 * and the app do.
 */

export type PrivacyBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "email" }; // the contact address as a link

export type PrivacySection = { heading: string; blocks: PrivacyBlock[] };

export const privacy: {
  title: string;
  description: string;
  updated: string;
  intro: string;
  sections: PrivacySection[];
} = {
  title: "Privacy",
  description: "What Analytics collects about the visitors of the sites it measures and about its own customers.",
  updated: "Last updated 2 November 2026",
  intro:
    "Analytics is a website analytics service. Site owners add our script to their sites, and we count visits for them. This page explains what we collect about the people who visit those sites, what we keep about our own customers, and what we never do.",
  sections: [
    {
      heading: "The short version",
      blocks: [
        {
          kind: "list",
          items: [
            "We don't use Google Analytics or advertising trackers, and we don't sell or share the data we collect.",
            "Visitor ids are random. They hold no name, email address or other personal details, and they aren't used across sites.",
            "We never store IP addresses.",
            "Any site can run without cookies.",
          ],
        },
      ],
    },
    {
      heading: "Visitors to sites that use Analytics",
      blocks: [
        {
          kind: "p",
          text: "When you visit a site that uses Analytics, the site's owner decides to measure it and is responsible for telling you so. We collect the data on their behalf and use it only to show them statistics about their own site. With each page you view, the script records:",
        },
        {
          kind: "list",
          items: [
            "the page address, without any query string;",
            "the website you came from (its domain only), and any campaign tags on the link you followed (utm_source, utm_medium, utm_campaign, utm_term, utm_content, ref or via), but nothing else from its address;",
            "your browser, device type and operating system;",
            "your approximate location (country, region and city), and for each visit a rough position, accurate to about 10 km, to show on a map;",
            "how long the page was open in a visible tab;",
            "actions the site counts, such as a signup, and the links to other websites you click (without any query string).",
          ],
        },
        {
          kind: "p",
          text: "Your IP address is used by our hosting provider only to work out your approximate location. We never store it.",
        },
      ],
    },
    {
      heading: "Cookies",
      blocks: [
        {
          kind: "p",
          text: "By default the script sets two first-party cookies on the site you're visiting, so that a returning visitor is counted once and page views are grouped into visits:",
        },
        {
          kind: "table",
          head: ["Cookie", "What it holds", "How long it lasts"],
          rows: [
            ["_va_vid", "A random id for your browser", "400 days, renewed on each visit"],
            ["_va_sid", "A random id for your current visit", "30 minutes after your last activity"],
          ],
        },
        {
          kind: "p",
          text: "You can delete these cookies at any time in your browser's settings, and blocking them doesn't stop the site from working.",
        },
      ],
    },
    {
      heading: "Cookieless mode",
      blocks: [
        {
          kind: "p",
          text: "A site owner can run Analytics without cookies. With data-cookieless on the script tag, the script sets no cookies and stores nothing on your device, and nothing it records is linked to you or to your other visits.",
        },
        {
          kind: "p",
          text: "A site can also be switched to cookieless in its settings. Then no visitor or session ids are stored either, but the script keeps one flag in your browser's local storage that records only that the site runs without cookies, and the first page you ever view there may briefly set the cookies above until the script learns the setting and deletes them.",
        },
      ],
    },
    {
      heading: "Sign-ins and payments",
      blocks: [
        {
          kind: "p",
          text: "If a site tells us who you are when you sign in or create an account there, we link your user id, email address and name to the random browser id, so its owner can see which pages and sources led to your sign-up.",
        },
        {
          kind: "p",
          text: "If a site connects its Stripe account or sends its payments through our API, we record each payment's amount, currency and date, the customer and payment ids from the payment provider, and the email address used to pay, and link them to the visit, so its owner can see which pages and sources led to the purchase. We never receive or store card or bank details.",
        },
      ],
    },
    {
      heading: "Our own customers",
      blocks: [
        {
          kind: "p",
          text: "If you have an Analytics account, signing in is handled by Clerk, which holds your email address and name. We use them only to run your account and to contact you about it. Signing in sets the cookies Clerk needs to keep you signed in.",
        },
        {
          kind: "p",
          text: "Your choice of light or dark theme is kept in your browser's local storage.",
        },
      ],
    },
    {
      heading: "Services we use",
      blocks: [
        {
          kind: "list",
          items: [
            "Vercel hosts the app and works out approximate locations from IP addresses.",
            "Convex stores the analytics data.",
            "Clerk handles signing in.",
            "Stripe, only for sites whose owners connect their own Stripe account to report payments.",
          ],
        },
      ],
    },
    {
      heading: "How long we keep data",
      blocks: [
        {
          kind: "p",
          text: "Analytics data is kept for as long as the site's owner keeps the site in Analytics. Deleting a site deletes all of its data, including visits, visitors, events and payments. To close your account and delete everything in it, email us.",
        },
        {
          kind: "p",
          text: "If you visited a site that uses Analytics and want your data removed, contact that site's owner, who controls it, or email us.",
        },
      ],
    },
    {
      heading: "Contact",
      blocks: [
        { kind: "p", text: "Questions about this page, or a request about your data:" },
        { kind: "email" },
      ],
    },
  ],
};
