import { httpAction } from "./_generated/server";

/**
 * SEO endpoint origin.
 *
 * Uses the SITE_URL environment variable configured on the Convex deployment
 * (the app's public origin). If it is not set, the sitemap is served without
 * absolute origins rather than emitting localhost/preview URLs.
 */
function siteOrigin(): string | null {
  const raw = process.env.SITE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

const PUBLIC_PATHS = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/changelog", priority: "0.8", changefreq: "weekly" },
  { path: "/changelog/introducing-cloud-studio-code", priority: "0.7", changefreq: "monthly" },
  { path: "/about", priority: "0.6", changefreq: "monthly" },
  { path: "/contributions", priority: "0.5", changefreq: "monthly" },
  { path: "/privacy", priority: "0.3", changefreq: "yearly" },
  { path: "/terms", priority: "0.3", changefreq: "yearly" },
];

export const serveRobots = httpAction(async () => {
  const origin = siteOrigin();
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /backstage",
    "Disallow: /dashboard",
    "Disallow: /ide/",
    "Disallow: /auth",
    ...(origin ? [`Sitemap: ${origin}/sitemap.xml`] : []),
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
});

export const serveSitemap = httpAction(async () => {
  const origin = siteOrigin();
  const lastmod = "2026-09-20";
  const urls = PUBLIC_PATHS.map(({ path, priority, changefreq }) => {
    const loc = origin ? `${origin}${path}` : path;
    return [
      "  <url>",
      `    <loc>${loc}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
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
