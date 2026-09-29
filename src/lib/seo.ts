import { useEffect } from "react";
import { PRODUCTION_ORIGIN, resolveSiteOrigin } from "@/lib/site";

/**
 * Production site origin.
 *
 * A configured `VITE_SEO_SITE_URL` / `VITE_SITE_URL` takes precedence when it is
 * a real public origin; otherwise the project's documented production origin is
 * used. There is deliberately no fallback to `window.location` — preview,
 * development and localhost hostnames must never end up in a canonical or
 * og:url, and a Convex backend origin is never accepted.
 */
export const SITE_URL: string =
  resolveSiteOrigin(
    import.meta.env?.VITE_SEO_SITE_URL as string | undefined,
    import.meta.env?.VITE_SITE_URL as string | undefined,
  ) ?? PRODUCTION_ORIGIN;

/** Absolute URL for a path on the production origin. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Default social share image (existing branded asset). */
export const OG_IMAGE_PATH = "/apple-touch-icon.png";

/** Alt text for the share image — kept factual and brand-accurate. */
const OG_IMAGE_ALT = "Cloud Studio Code — browser-based cloud IDE";

type PageMeta = {
  title: string;
  description: string;
  /** Path beginning with "/" for canonical/og:url. Omit on non-public pages. */
  path?: string;
  /** Hide this page from search engines (and from social previews). */
  noindex?: boolean;
  /**
   * Open Graph object type. Changelog articles pass "article" so
   * `article:published_time` can carry their real publication date.
   */
  ogType?: "website" | "article";
  /** ISO date (YYYY-MM-DD) of publication, for `ogType: "article"`. */
  publishedTime?: string;
  /** JSON-LD structured data to inject (the canonical `url` is added for you). */
  structuredData?: Record<string, unknown>;
};

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function removeMeta(attr: "name" | "property", key: string) {
  document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)?.remove();
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function removeLink(rel: string) {
  document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)?.remove();
}

/**
 * Declarative per-page document metadata.
 *
 * Only pages that declare themselves public (a `path` and no `noindex`) get a
 * canonical URL and an og:url; every other page has both *removed*, so a
 * private route can never inherit the canonical of the public page the visitor
 * arrived from. `noindex` pages get a robots meta instead, which is why
 * private areas stay out of search results even if a crawler ignores
 * robots.txt.
 */
export function usePageMeta({
  title,
  description,
  path,
  noindex,
  ogType = "website",
  publishedTime,
  structuredData,
}: PageMeta) {
  useEffect(() => {
    const isPublic = !noindex && Boolean(path);

    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");

    const canonical = isPublic && path ? absoluteUrl(path) : null;
    if (canonical) upsertLink("canonical", canonical);
    else removeLink("canonical");

    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", ogType);
    upsertMeta("property", "og:site_name", "Cloud Studio Code");
    upsertMeta("property", "og:image", absoluteUrl(OG_IMAGE_PATH));
    upsertMeta("property", "og:image:alt", OG_IMAGE_ALT);
    if (canonical) upsertMeta("property", "og:url", canonical);
    else removeMeta("property", "og:url");

    if (ogType === "article" && publishedTime) {
      upsertMeta("property", "article:published_time", publishedTime);
    } else {
      removeMeta("property", "article:published_time");
    }

    upsertMeta("name", "twitter:card", "summary");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", absoluteUrl(OG_IMAGE_PATH));

    // JSON-LD structured data, replaced on each navigation. The canonical URL
    // is attached here so every schema that describes a page gets it from the
    // single origin configuration above.
    const ID = "csc-page-jsonld";
    document.getElementById(ID)?.remove();
    if (structuredData) {
      const script = document.createElement("script");
      script.id = ID;
      script.type = "application/ld+json";
      script.textContent = JSON.stringify({
        ...(canonical ? { url: canonical } : {}),
        ...structuredData,
      });
      document.head.appendChild(script);
    }
  }, [title, description, path, noindex, ogType, publishedTime, structuredData]);
}

/** Site-wide WebApplication structured data — only verifiable facts. */
export function webApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Cloud Studio Code",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    description:
      "A browser-based cloud IDE for writing, running and previewing code — with projects, files and a sandboxed runtime in the cloud.",
    url: absoluteUrl("/"),
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

/** WebSite structured data for the homepage. */
export function webSiteSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Cloud Studio Code",
    url: absoluteUrl("/"),
  };
}
