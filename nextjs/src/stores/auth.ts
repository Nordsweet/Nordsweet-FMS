import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Session = { token: string; username: string; role: string };

type AuthStore = {
  /** null while signed out; the bearer token is `session.token`. */
  session: Session | null;
  signIn: (session: Session) => void;
  signOut: () => void;
};

/**
 * The Aviation API bearer token lives in localStorage so a reload keeps the pilot signed in
 * (and the app keeps working offline). Any script on this origin could read it (XSS), so the
 * app loads no third-party scripts; the token is revocable (logout) and expires after 30 days.
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
      storage: createJSONStorage(() => localStorage),
      partialize: ({ session }) => ({ session }),
    },
  ),
);
