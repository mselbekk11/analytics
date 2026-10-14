// Snippets must point at the stable production address, never a deployment-specific
// URL (those sit behind Vercel's login). Vercel sets this at build time and switches it
// to the custom domain once one is attached; locally it is unset, so use this origin.
// Client-only: reads window.location when the variable is unset.
export function appOrigin(): string {
  const host = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : window.location.origin;
}

/** The one-line embed snippet for a site. */
export function embedSnippet(domain: string): string {
  return `<script async src="${appOrigin()}/script.js" data-site="${domain}"></script>`;
}
