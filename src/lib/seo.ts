import { useEffect } from "react";

/**
 * Production site origin.
 *
 * Read from VITE_SITE_URL. Do NOT fall back to localhost, preview URLs, or a
 * guessed hostname — if the variable is not set, origin-dependent metadata
 * (canonical, og:url, sitemap link) is omitted rather than emitted with a
 * wrong value. Supply the real production origin via the VITE_SITE_URL
 * environment variable after deployment.
 */
export const SITE_URL: string | null = (() => {
  const raw = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
})();

/** Absolute URL for a path, or null when the production origin is unknown. */
export function absoluteUrl(path: string): string | null {
  if (!SITE_URL) return null;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Default social share image (existing branded asset). */
export const OG_IMAGE_PATH = "/apple-touch-icon.png";

type PageMeta = {
  title: string;
  description: string;
  /** Path beginning with "/" for canonical/og:url. */
  path?: string;
  /** Hide this page from search engines. */
  noindex?: boolean;
  /** JSON-LD structured data to inject. */
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

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Declarative per-page document metadata. Restores nothing on unmount — each
 * page sets its own values, so the last-rendered page's metadata is always
 * correct. `noindex` pages (404) get a robots meta instead of a canonical.
 */
export function usePageMeta({ title, description, path, noindex, structuredData }: PageMeta) {
  useEffect(() => {
    document.title = title;

    upsertMeta("name", "description", description);

    if (noindex) {
      upsertMeta("name", "robots", "noindex, nofollow");
    } else {
      upsertMeta("name", "robots", "index, follow");
      if (path) {
        const canonical = absoluteUrl(path);
        // Only emit a canonical when the production origin is configured —
        // never a localhost/preview URL.
        if (canonical) upsertLink("canonical", canonical);
      }
    }

    const ogUrl = path ? absoluteUrl(path) : null;
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", "Cloud Studio Code");
    if (ogUrl) upsertMeta("property", "og:url", ogUrl);
    upsertMeta("property", "og:image", `${SITE_URL ?? ""}${OG_IMAGE_PATH}`);

    upsertMeta("name", "twitter:card", "summary");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);

    // JSON-LD structured data, replaced on each navigation.
    const ID = "csc-page-jsonld";
    document.getElementById(ID)?.remove();
    if (structuredData) {
      const script = document.createElement("script");
      script.id = ID;
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }
  }, [title, description, path, noindex, structuredData]);
}

/** Site-wide WebApplication structured data — only verifiable facts. */
export function webApplicationSchema() {
  const url = absoluteUrl("/");
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Cloud Studio Code",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    description:
      "A browser-based cloud IDE for writing, running and previewing code — with projects, files and a sandboxed runtime in the cloud.",
    ...(url ? { url } : {}),
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
}

/** WebSite structured data with the public-page SearchAction-free base. */
export function webSiteSchema() {
  const url = absoluteUrl("/");
  if (!url) return null;
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Cloud Studio Code",
    url,
  };
}
