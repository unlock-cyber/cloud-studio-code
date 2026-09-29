import { httpAction } from "./_generated/server";
import { CHANGELOG_ENTRIES, latestContentDate } from "../lib/changelog";
import { PRODUCTION_ORIGIN, resolveSiteOrigin } from "../lib/site";

/**
 * SEO endpoint origin.
 *
 * `SEO_SITE_URL` is the intended way to point these endpoints at the public
 * website. `SITE_URL` is consulted as a generic fallback, but NOTE that Convex
 * populates it with the deployment's own HTTP-actions origin
 * (`…convex.site`), which `resolveSiteOrigin` deliberately rejects — publishing
 * that as the site origin would put a backend host in every sitemap URL.
 * Failing both, the project's documented production origin is used, so a
 * sitemap or robots file can never go out pointing at localhost, a preview
 * hostname or the Convex API.
 */
function siteOrigin(): string {
  return resolveSiteOrigin(process.env.SEO_SITE_URL, process.env.SITE_URL) ?? PRODUCTION_ORIGIN;
}

type SitemapUrl = {
  path: string;
  priority: string;
  changefreq: string;
  /**
   * Meaningful modification/publication date (YYYY-MM-DD). Omitted when the
   * project has no reliable source for it — see PAGE_URLS below.
   */
  lastmod?: string;
};

/**
 * The index pages. Both genuinely change when a release is published (the
 * homepage's "What's New" section and the changelog index both follow the
 * newest entry), so their lastmod is the most recent publication date rather
 * than a date invented at request time.
 */
const INDEX_URLS: SitemapUrl[] = [
  { path: "/", priority: "1.0", changefreq: "weekly", lastmod: latestContentDate() ?? undefined },
  { path: "/changelog", priority: "0.8", changefreq: "weekly", lastmod: latestContentDate() ?? undefined },
];

/**
 * Changelog articles, derived from the changelog source of truth: a new release
 * is published in `src/lib/changelog.ts` and appears here — URL and publication
 * date — without touching this file.
 */
const CHANGELOG_URLS: SitemapUrl[] = CHANGELOG_ENTRIES.map((entry) => ({
  path: entry.path,
  priority: "0.7",
  changefreq: "monthly",
  lastmod: entry.date,
}));

/**
 * Static public pages. These carry no `lastmod`: the project does not track a
 * modification date for them, and a sitemap must not claim a page changed on a
 * date nobody can substantiate. `lastmod` is optional in the sitemap protocol,
 * so omitting it is the honest option — and better than repeating one stale
 * date, or stamping every request with "today".
 */
const PAGE_URLS: SitemapUrl[] = [
  { path: "/about", priority: "0.6", changefreq: "monthly" },
  { path: "/contributions", priority: "0.5", changefreq: "monthly" },
  { path: "/privacy", priority: "0.3", changefreq: "yearly" },
  { path: "/terms", priority: "0.3", changefreq: "yearly" },
];

const PUBLIC_PATHS: SitemapUrl[] = [...INDEX_URLS, ...CHANGELOG_URLS, ...PAGE_URLS];

export const serveRobots = httpAction(async () => {
  const origin = siteOrigin();
  const body = [
    "User-agent: *",
    "Allow: /",
    // Signed-in and internal areas: never indexable, and never linked from the
    // sitemap. Share links are unguessable bearer URLs, so they are excluded on
    // top of the noindex the shared page itself sends.
    "Disallow: /backstage",
    "Disallow: /dashboard",
    "Disallow: /ide/",
    "Disallow: /s/",
    "Disallow: /auth",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
});

export const serveSitemap = httpAction(async () => {
  const origin = siteOrigin();
  const urls = PUBLIC_PATHS.map(({ path, priority, changefreq, lastmod }) => {
    return [
      "  <url>",
      `    <loc>${origin}${path}</loc>`,
      ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority}</priority>`,
      "  </url>",
    ].join("\n");
  });
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
});
