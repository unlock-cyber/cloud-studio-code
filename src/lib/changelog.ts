// Single source of truth for published changelog entries.
//
// The changelog index and the landing page's "What's New" section both read
// from here, so an entry only ever has to be added in one place. Keep the list
// in newest-first order (the order the index shows) — ordering is still derived
// from `date` below, so a mis-ordered entry can't surface a stale one.

export type ChangelogEntry = {
  /** Route path of the post. Must match the route registered in main.tsx. */
  path: string;
  title: string;
  /** ISO date (YYYY-MM-DD). Drives ordering; the display date is derived. */
  date: string;
  /** Short label shown on the index card and the post header. */
  badge: string;
  /** Link label on the index card. */
  cta: string;
};

const CHANGELOG: ChangelogEntry[] = [
  {
    path: "/changelog/ide-developer-ux-update",
    title: "Update 2: Mobile & Developer UX",
    date: "2026-09-29",
    badge: "Update 2",
    cta: "Read the update",
  },
  {
    path: "/changelog/ide-polish-update",
    title: "IDE Polish Update",
    date: "2026-09-28",
    badge: "Enhancement",
    cta: "Read the update",
  },
  {
    path: "/changelog/guest-workspace-transfer",
    title: "Guest Workspace Transfer Improvements",
    date: "2026-09-27",
    badge: "Improvement",
    cta: "Read the update",
  },
  {
    path: "/changelog/introducing-cloud-studio-code",
    title: "Introducing Cloud Studio Code",
    date: "2026-09-20",
    badge: "Initial release",
    cta: "Read the announcement",
  },
];

// Pinned to UTC: an ISO date is parsed as UTC midnight, so formatting in a
// timezone behind UTC would otherwise render the day before.
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Published entries, newest first. */
export const CHANGELOG_ENTRIES: ChangelogEntry[] = [...CHANGELOG].sort((a, b) =>
  b.date.localeCompare(a.date),
);

/** Human-readable release date, e.g. "28 September 2026". */
export function formatChangelogDate(isoDate: string): string {
  return dateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

/** The most recent published entry, or null when there are none. */
export function latestChangelogEntry(): ChangelogEntry | null {
  return CHANGELOG_ENTRIES[0] ?? null;
}
