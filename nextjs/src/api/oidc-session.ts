import { useAuth, type Session } from "~/stores/auth";

import { refreshTokens } from "./oidc";

/** Renew this long before the access token expires, so a request never carries a stale one. */
const SKEW_MS = 60_000;
const LOCK = "nordsweet.oidc.refresh";

export const expiring = (session: Session | null) =>
  Boolean(
    session?.refreshToken &&
    session.expiresAt &&
    session.expiresAt - Date.now() < SKEW_MS,
  );

let pending: Promise<void> | undefined;

/** The bearer token after a renewal when it was about to expire; one renewal at a time. */
export async function renewedToken() {
  pending ??= locked(renew).finally(() => (pending = undefined));
  await pending;
  return useAuth.getState().session?.token;
}

/** Other tabs of this browser share the refresh token, and Zitadel rotates it on every use. */
async function locked(task: () => Promise<void>) {
  const locks = globalThis.navigator?.locks;
  if (!locks) return task();
  return locks.request(LOCK, async () => {
    await useAuth.persist.rehydrate(); // another tab may have renewed while this one waited
    return task();
  });
}

async function renew() {
  const session = useAuth.getState().session;
  if (!session?.refreshToken || !expiring(session)) return;
  try {
    const next = await refreshTokens(session.refreshToken);
    useAuth.setState({
      session: {
        ...session,
        token: next.accessToken,
        refreshToken: next.refreshToken,
        idToken: next.idToken ?? session.idToken,
        expiresAt: next.expiresAt,
      },
    });
  } catch (error) {
    // A revoked or expired refresh token ends the session. Offline or a server error keeps the
    // old token: the pilot stays signed in and the next request tries again.
    if ((error as { error?: string }).error === "invalid_grant")
      useAuth.getState().signOut();
  }
}
