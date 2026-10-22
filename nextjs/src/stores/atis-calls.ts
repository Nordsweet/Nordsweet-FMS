import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Only idempotency/acknowledgement IDs live locally; balances and jobs belong to the server. */
export const useAtisCallState = create<{
  keys: Record<string, string>;
  dismissed: Record<string, string[]>;
  key: (scope: string, id: string) => void;
  dismiss: (username: string, id: string) => void;
}>()(
  persist(
    (set) => ({
      keys: {},
      dismissed: {},
      key: (scope, id) => set((s) => ({ keys: { ...s.keys, [scope]: id } })),
      dismiss: (username, id) =>
        set((s) => ({
          dismissed: {
            ...s.dismissed,
            [username]: [...(s.dismissed[username] ?? []), id].slice(-200),
          },
        })),
    }),
    { name: "nordsweet.atis-calls.v1" },
  ),
);
