// Ephemeral, client-side record of the guest session held while a guest is
// upgrading to a registered account. Written while the user is in the guest
// workspace (and refreshed the moment they confirm the upgrade dialog), read
// once by the OTP handler right after sign-in succeeds, then cleared.
//
// This is navigation bookkeeping only — the server independently verifies
// ownership via the guest session id before migrating anything.
//
// Stored in localStorage (not sessionStorage) so the context survives a new
// tab being opened on /auth; a 1-hour TTL matches the guest session lifetime
// and a version key keeps stale entries from previous sessions isolated.

const KEY = "ccs_guest_upgrade_v2";

export type GuestUpgradeContext = {
  workspaceId: string;
  sessionId: string;
  capturedAt: number;
};

export function captureGuestContext(): GuestUpgradeContext | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestUpgradeContext;
    // Ignore stale entries: guest sessions expire after 1 hour.
    if (Date.now() - parsed.capturedAt > 60 * 60 * 1000) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function storeGuestContext(ctx: Omit<GuestUpgradeContext, "capturedAt">) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...ctx, capturedAt: Date.now() }),
    );
  } catch {
    // Storage unavailable — migration just won't carry context; the
    // server-side flow still works (the user simply gets a fresh workspace).
  }
}

export function clearGuestContext() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
