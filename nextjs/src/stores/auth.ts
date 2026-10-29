import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Session = {
  token: string;
  username: string;
  role: string;
  /** Zitadel sign-in only: renews `token` (see api/oidc.ts); expiresAt is epoch ms. */
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number;
};

type AuthStore = {
  /** null while signed out; the bearer token is `session.token`. */
  session: Session | null;
  signIn: (session: Session) => void;
  signOut: () => void;
};

/**
 * The bearer token (a Zitadel access token) lives in localStorage so a reload keeps the pilot signed in
 * (and the app keeps working offline). Any script on this origin could read it (XSS), so the
 * app loads no third-party scripts; the access token is short-lived and renewed with the refresh token.
 * shortcut: no httpOnly cookie, which would need a same-origin proxy for the API.
 */
export const useAuth = create<AuthStore>()(
  persist(
    (set) => ({
      session: null,
      signIn: (session) => set({ session }),
      signOut: () => set({ session: null }),
    }),
    {
      name: "nordsweet.auth.v1",
      // Version 0 held Aviation API password sessions, which this app no longer accepts.
      version: 1,
      migrate: () => ({ session: null }),
      storage: createJSONStorage(() => localStorage),
      partialize: ({ session }) => ({ session }),
    },
  ),
);
