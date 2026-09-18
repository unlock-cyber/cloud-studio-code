// Ephemeral, client-side record of the guest session held while a guest is
// upgrading to a registered account. Written when the user enters the guest
// workspace (or lands on /auth from a guest dashboard), read once by the OTP
// handler right after sign-in succeeds, then cleared.
//
// This is navigation bookkeeping only — the server independently verifies
// ownership via the guest session id before migrating anything.

const KEY = "ccs_guest_upgrade";

export type GuestUpgradeContext = {
  workspaceId: string;
  sessionId: string;
  capturedAt: number;
};

export function captureGuestContext(): GuestUpgradeContext | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestUpgradeContext;
    // Ignore stale entries: guest sessions expire after 1 hour.
    if (Date.now() - parsed.capturedAt > 60 * 60 * 1000) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function storeGuestContext(ctx: Omit<GuestUpgradeContext, "capturedAt">) {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ ...ctx, capturedAt: Date.now() }),
    );
  } catch {
    // sessionStorage unavailable — migration just won't carry context; the
    // server-side flow still works (the user simply gets a fresh workspace).
  }
}

export function clearGuestContext() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
