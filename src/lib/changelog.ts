// Single source of truth for published changelog entries.
//
// The changelog index, the landing page's "What's New" section, each article's
// heading and document metadata, and the sitemap all read from here, so a
// release only has to be described once. Keep the list in newest-first order
// (the order the index shows) — ordering is still derived from `date` below, so
// a mis-ordered entry can't surface a stale one.

export type ChangelogEntry = {
  /** Route path of the post. Must match the route registered in main.tsx. */
  path: string;
  title: string;
  /** ISO date (YYYY-MM-DD). Drives ordering; the display date is derived. */
  date: string;
  /**
   * Semantic category shown on the index card and the post header, e.g.
   * "New Feature". Stored in sentence case and rendered in caps, so entries
   * stay readable here while every label reads consistently on the page.
   */
  badge: string;
  /** Link label on the index card. */
  cta: string;
  /**
   * Search/social description for the article. It doubles as the sitemap's
   * source of truth for that URL, so it lives beside the entry instead of in
   * a separate SEO file that has to be kept in sync by hand.
   */
  metaDescription: string;
};

// `as const` keeps the literal path type below, which lets each article page
// look its own entry up with compile-time checking (a typo is a type error, not
// missing metadata at runtime).
const CHANGELOG = [
  {
    path: "/changelog/ide-productivity-update",
    title: "IDE Productivity",
    date: "2026-10-08",
    badge: "Enhancement",
    cta: "Read the update",
    metaDescription:
      "Cloud Studio Code gets recent files in the command palette, Save All on Ctrl+Shift+S, more predictable tab closing, next and previous tab commands, and editor focus that follows the file you open.",
  },
  {
    path: "/changelog/mobile-experience-fixes",
    title: "Mobile Experience Fixes",
    date: "2026-10-07",
    badge: "Bug Fix",
    cta: "Read the update",
    metaDescription:
      "Two mobile fixes in Cloud Studio Code: header branding now adapts to the screen width instead of wrapping, and the IDE fits the mobile viewport so its navigation stays reachable without page-level scrolling.",
  },
  {
    path: "/changelog/workspace-project-management",
    title: "Workspace & Project Management",
    date: "2026-10-06",
    badge: "Enhancement",
    cta: "Read the update",
    metaDescription:
      "Cloud Studio Code project management gets search, ordering by recently opened, last modified, created or name, clearer recent-activity information, and safer create, rename and duplicate flows across the dashboard and the editor.",
  },
  {
    path: "/changelog/collaboration-2-0",
    title: "Redefined Collaboration",
    date: "2026-10-03",
    badge: "Enhancement",
    cta: "Read the update",
    metaDescription:
      "Redefined Collaboration refines project sharing in Cloud Studio Code: see exactly what a shared link allows, preview the visitor's view, and get a clearer read-only experience for anyone you share with.",
  },
  {
    path: "/changelog/collaboration-update",
    title: "Introducing Project Collaboration",
    date: "2026-10-02",
    badge: "New Feature",
    cta: "Read the update",
    metaDescription:
      "Share a project from Cloud Studio Code with a link: let people read the code and preview supported web projects without an account, and revoke sharing whenever you like.",
  },
  {
    path: "/changelog/ide-developer-ux-update",
    title: "Mobile & Developer UX",
    date: "2026-09-29",
    badge: "Enhancement",
    cta: "Read the update",
    metaDescription:
      "Cloud Studio Code gets Auto-Save on by default with clear per-workspace controls, a more comfortable IDE on phones, a deeper command palette, clearer terminal states and a lightweight recent run history.",
  },
  {
    path: "/changelog/ide-polish-update",
    title: "IDE Polish",
    date: "2026-09-28",
    badge: "Enhancement",
    cta: "Read the update",
    metaDescription:
      "Cloud Studio Code gets recent projects, project rename and duplicate, a more capable file explorer, stronger protection for unsaved changes, and clearer loading, empty and error states.",
  },
  {
    path: "/changelog/guest-workspace-transfer",
    title: "Guest Workspace Transfer Improvements",
    date: "2026-09-27",
    badge: "Improvement",
    cta: "Read the update",
    metaDescription:
      "Signing in from a guest workspace now moves your projects, files and databases into your account immediately — no manual refresh, and nothing to start over.",
  },
  {
    path: "/changelog/introducing-cloud-studio-code",
    title: "Introducing Cloud Studio Code",
    date: "2026-09-20",
    badge: "Initial Release",
    cta: "Read the announcement",
    metaDescription:
      "Launching Cloud Studio Code: a browser-based cloud IDE with a real editor, sandboxed code execution, live web previews and persistent cloud workspaces.",
  },
] as const satisfies readonly ChangelogEntry[];

/** Every published article path, as a literal union (compile-time checked). */
export type ChangelogPath = (typeof CHANGELOG)[number]["path"];

const ENTRY_BY_PATH = new Map<string, ChangelogEntry>(CHANGELOG.map((entry) => [entry.path, entry]));

/**
 * The entry for an article path. The argument type is the union of published
 * paths, so an article can only be looked up by a real path — a typo fails to
 * compile instead of shipping empty metadata.
 */
export function changelogEntry(path: ChangelogPath): ChangelogEntry {
  const entry = ENTRY_BY_PATH.get(path);
  if (!entry) throw new Error(`Unknown changelog entry: ${path}`);
  return entry;
}

// Pinned to IST: an ISO date is parsed as UTC midnight, then converted to
// India Standard Time so the visible day matches an IST local calendar.
// (Kept explicitly here so the timezone assumption stays readable and changeable.)
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Published entries, newest first. */
export const CHANGELOG_ENTRIES: ChangelogEntry[] = [...CHANGELOG].sort((a, b) =>
  b.date.localeCompare(a.date),
);

/** Human-readable release date, e.g. "28 September 2026". */
export function formatChangelogDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (isNaN(d.getTime())) return isoDate;
  // Convert to IST before extracting calendar fields.
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const day = ist.getUTCDate();
  const month = MONTH_NAMES[ist.getUTCMonth()];
  const year = ist.getUTCFullYear();
  // DD = always two digits, 0-padded for 1-9.
  const paddedDay = day < 10 ? `0${day}` : `${day}`;
  return `${paddedDay} ${month} ${year}`;
}

/** The most recent published entry, or null when there are none. */
export function latestChangelogEntry(): ChangelogEntry | null {
  return CHANGELOG_ENTRIES[0] ?? null;
}

/** The publication date of the newest article — the site's newest content. */
export function latestContentDate(): string | null {
  return latestChangelogEntry()?.date ?? null;
}

/**
 * Document metadata for one article, derived entirely from its entry so the
 * `<head>` can never disagree with the visible heading, category and date (and
 * so a new release needs no separate SEO edit). The canonical URL is attached
 * by `usePageMeta`.
 */
export function changelogPageMeta(entry: ChangelogEntry): {
  title: string;
  description: string;
  path: ChangelogPath;
  ogType: "article";
  publishedTime: string;
  structuredData: Record<string, unknown>;
} {
  return {
    title: `${entry.title} — Changelog`,
    description: entry.metaDescription,
    path: entry.path as ChangelogPath,
    ogType: "article",
    publishedTime: entry.date,
    // Only facts that are also visible on the page: headline, summary and the
    // publication date shown in the article header. No invented author,
    // publisher or rating.
    structuredData: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: entry.title,
      description: entry.metaDescription,
      datePublished: entry.date,
    },
  };
}
