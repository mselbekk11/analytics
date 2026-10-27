// Where a visit came from: a named source ("Google", "ChatGPT", "test") and a channel.
// Shared by ingest, the backfill and the dashboard (for source favicons).
//
// The source list and rules are adapted from minilytics' src/shared/sources.ts
// (https://github.com/surendrapandar/minilytics), MIT licensed.

export const CHANNELS = [
  "Direct",
  "Organic Search",
  "Organic Social",
  "AI",
  "Referral",
  "Email",
  "Paid",
] as const;

export type Channel = (typeof CHANNELS)[number];

type KnownSource = {
  name: string;
  domain: string; // for the favicon; empty when there is none
  channel: Channel;
  match: RegExp; // tested against utm_source, ref and the referrer hostname, lowercased
};

export const KNOWN_SOURCES: KnownSource[] = [
  { name: "X", domain: "x.com", channel: "Organic Social", match: /^(t\.co|(.*\.)?(x|twitter)\.com|x|twitter|tw)$/ },
  { name: "Google", domain: "google.com", channel: "Organic Search", match: /^((www\.)?google\.[a-z.]+|google)$/ },
  { name: "Bing", domain: "bing.com", channel: "Organic Search", match: /^((.*\.)?bing\.com|bing)$/ },
  { name: "DuckDuckGo", domain: "duckduckgo.com", channel: "Organic Search", match: /^((.*\.)?duckduckgo\.com|duckduckgo|ddg)$/ },
  { name: "Yahoo", domain: "yahoo.com", channel: "Organic Search", match: /^((.*\.)?search\.yahoo\.[a-z.]+|yahoo\.[a-z.]+|yahoo)$/ },
  { name: "Yandex", domain: "yandex.com", channel: "Organic Search", match: /^((.*\.)?yandex\.[a-z.]+|yandex)$/ },
  { name: "Baidu", domain: "baidu.com", channel: "Organic Search", match: /^((.*\.)?baidu\.com|baidu)$/ },
  { name: "Ecosia", domain: "ecosia.org", channel: "Organic Search", match: /^((.*\.)?ecosia\.org|ecosia)$/ },
  { name: "Brave Search", domain: "search.brave.com", channel: "Organic Search", match: /^(search\.brave\.com)$/ },
  { name: "ChatGPT", domain: "chatgpt.com", channel: "AI", match: /^((.*\.)?(chatgpt\.com|openai\.com)|chatgpt|openai)$/ },
  { name: "Claude", domain: "claude.ai", channel: "AI", match: /^((.*\.)?claude\.ai|claude)$/ },
  { name: "Perplexity", domain: "perplexity.ai", channel: "AI", match: /^((.*\.)?perplexity\.ai|perplexity)$/ },
  { name: "Gemini", domain: "gemini.google.com", channel: "AI", match: /^(gemini\.google\.com|gemini|bard\.google\.com)$/ },
  { name: "Copilot", domain: "copilot.microsoft.com", channel: "AI", match: /^(copilot\.microsoft\.com|copilot)$/ },
  { name: "DeepSeek", domain: "deepseek.com", channel: "AI", match: /^((.*\.)?deepseek\.com|deepseek)$/ },
  { name: "Grok", domain: "grok.com", channel: "AI", match: /^((.*\.)?grok\.com|grok)$/ },
  { name: "YouTube", domain: "youtube.com", channel: "Organic Social", match: /^((.*\.)?(youtube\.com|youtu\.be)|youtube|yt)$/ },
  { name: "LinkedIn", domain: "linkedin.com", channel: "Organic Social", match: /^((.*\.)?(linkedin\.com|lnkd\.in)|linkedin)$/ },
  { name: "Reddit", domain: "reddit.com", channel: "Organic Social", match: /^((.*\.)?reddit\.com|reddit)$/ },
  { name: "Facebook", domain: "facebook.com", channel: "Organic Social", match: /^((.*\.)?(facebook\.com|fb\.com|fb\.me)|facebook|fb)$/ },
  { name: "Instagram", domain: "instagram.com", channel: "Organic Social", match: /^((.*\.)?instagram\.com|instagram|ig)$/ },
  { name: "Threads", domain: "threads.net", channel: "Organic Social", match: /^((.*\.)?threads\.(net|com)|threads)$/ },
  { name: "TikTok", domain: "tiktok.com", channel: "Organic Social", match: /^((.*\.)?tiktok\.com|tiktok)$/ },
  { name: "Pinterest", domain: "pinterest.com", channel: "Organic Social", match: /^((.*\.)?pinterest\.[a-z.]+|pinterest)$/ },
  { name: "Bluesky", domain: "bsky.app", channel: "Organic Social", match: /^((.*\.)?bsky\.app|bluesky|bsky)$/ },
  { name: "Mastodon", domain: "mastodon.social", channel: "Organic Social", match: /^((.*\.)?mastodon\.[a-z.]+|mastodon)$/ },
  { name: "Hacker News", domain: "news.ycombinator.com", channel: "Organic Social", match: /^(news\.ycombinator\.com|hackernews|hn)$/ },
  { name: "Product Hunt", domain: "producthunt.com", channel: "Referral", match: /^((.*\.)?producthunt\.com|producthunt|ph)$/ },
  { name: "Medium", domain: "medium.com", channel: "Referral", match: /^((.*\.)?medium\.com|medium)$/ },
  { name: "Substack", domain: "substack.com", channel: "Referral", match: /^((.*\.)?substack\.com|substack)$/ },
  { name: "Dev.to", domain: "dev.to", channel: "Referral", match: /^(dev\.to|devto)$/ },
  { name: "Indie Hackers", domain: "indiehackers.com", channel: "Referral", match: /^((.*\.)?indiehackers\.com|indiehackers)$/ },
  { name: "GitHub", domain: "github.com", channel: "Referral", match: /^((.*\.)?github\.com|github)$/ },
  { name: "Gmail", domain: "mail.google.com", channel: "Email", match: /^(mail\.google\.com|gmail)$/ },
  { name: "Outlook", domain: "outlook.com", channel: "Email", match: /^((.*\.)?(outlook\.(com|live\.com)|outlook\.office\.com))$/ },
  { name: "Newsletter", domain: "", channel: "Email", match: /^(newsletter|email|mail)$/ },
];

const PAID_MEDIUM = /^(cpc|ppc|cpm|cpv|paid|paid[_-]?(social|search)|paidsearch|ads?|display|retargeting|sponsored)$/i;
const EMAIL_MEDIUM = /^(e-?mail|newsletter)$/i;
const SOCIAL_MEDIUM = /^(social|social[_-]?media|sm)$/i;

/** The source name for a visit with no referrer and no tags. */
export const DIRECT = "Direct";

function findKnownSource(key: string | undefined): KnownSource | undefined {
  if (!key) return undefined;
  const k = key.toLowerCase().trim();
  return KNOWN_SOURCES.find((s) => s.match.test(k));
}

/**
 * Classifies a visit. A tag (utm_source, then ref) wins over the referrer, because
 * that is how a specific post or ad is labelled. `referrer` is a hostname without
 * "www." or "(direct)", as /api/collect stores it.
 */
export function classify(input: {
  referrer: string;
  utmSource?: string;
  utmMedium?: string;
  refTag?: string;
}): { source: string; channel: Channel } {
  const { utmSource, utmMedium, refTag } = input;
  const referrer = input.referrer === "(direct)" ? "" : input.referrer;
  const tag = utmSource || refTag || "";
  // An unknown tag still wins over a known referrer (minilytics lets the referrer win)
  const known = findKnownSource(tag || referrer);

  const source = known?.name ?? (tag || referrer || DIRECT);

  let channel: Channel;
  if (utmMedium && PAID_MEDIUM.test(utmMedium)) channel = "Paid";
  else if (utmMedium && EMAIL_MEDIUM.test(utmMedium)) channel = "Email";
  else if (known) channel = known.channel;
  else if (utmMedium && SOCIAL_MEDIUM.test(utmMedium)) channel = "Organic Social";
  else if (tag || referrer) channel = "Referral";
  else channel = "Direct";

  return { source, channel };
}

/**
 * The domain whose favicon stands for a source: a known source's own domain, or the
 * source itself when it is a hostname (an unknown referrer). Null for plain tags.
 */
export function sourceDomain(source: string): string | null {
  const known = KNOWN_SOURCES.find((s) => s.name === source);
  if (known) return known.domain || null;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(source) ? source.toLowerCase() : null;
}
