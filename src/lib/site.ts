// The project's public website origin, defined once.
//
// Both halves of the SEO implementation need an absolute origin:
//   - client-side page metadata (canonical, og:url, og:image) in `src/lib/seo.ts`
//   - the sitemap and robots.txt served from Convex in `src/convex/seo.ts`
//
// Rather than hardcoding the hostname in each of those places (where the two
// can drift apart), both resolve it through `resolveSiteOrigin` below. A
// configured environment value still wins, so pointing the site at a different
// origin needs no code change; the constant is the documented production
// default and the guarantee that metadata never goes out with a missing,
// backend or localhost origin.
//
// Keep this module dependency-free: `src/convex/seo.ts` imports it, so it runs
// inside the Convex runtime as well as in the browser bundle.

/** Authoritative production origin for Cloud Studio Code (no trailing slash). */
export const PRODUCTION_ORIGIN = "https://www.cscode.freebuff.app";

/**
 * Normalise a configured origin into a usable absolute origin, or `null` when
 * it is missing or blank.
 */
export function resolveOrigin(raw: string | undefined | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  return value.replace(/\/+$/, "");
}

/**
 * Whether an origin belongs to the Convex backend rather than the website.
 * Convex populates `SITE_URL` for a deployment with that deployment's own
 * HTTP-actions origin (`…convex.site`), which is an API host — it must never be
 * published as the site's canonical origin or appear in the sitemap.
 */
export function isBackendOrigin(origin: string): boolean {
  return /\.convex\.(site|cloud)$/i.test(origin);
}

/**
 * The public website origin, from the first configured value that is a real
 * public origin. Candidates are read in order (a dedicated SEO variable first,
 * then the deployment's generic one), so an explicitly configured site URL
 * always wins over the fallback.
 */
export function resolveSiteOrigin(
  ...candidates: (string | undefined | null)[]
): string | null {
  for (const candidate of candidates) {
    const origin = resolveOrigin(candidate);
    if (origin && !isBackendOrigin(origin)) return origin;
  }
  return null;
}
