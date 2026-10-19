import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";

type PositionSettings = {
  source: "device" | "connector";
  url: string;
  token: string;
  enabled: boolean;
  update: (patch: Partial<Omit<PositionSettings, "update">>) => void;
};

/** Keep connection details on this device, migrating the former session-only credential. */
export const positionStorage: StateStorage = {
  getItem: (name) => {
    const saved = localStorage.getItem(name);
    if (saved !== null) return saved;
    const legacy = sessionStorage.getItem(name);
    if (legacy !== null) {
      localStorage.setItem(name, legacy);
      sessionStorage.removeItem(name);
    }
    return legacy;
  },
  setItem: (name, value) => {
    localStorage.setItem(name, value);
    sessionStorage.removeItem(name);
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
    sessionStorage.removeItem(name);
  },
};

// Never include the credential in flight records or exported files.
export const usePositionSource = create<PositionSettings>()(
  persist(
    (set) => ({
      source: "device",
      url: "",
      token: "",
      enabled: false,
      update: (patch) => set(patch),
    }),
    {
      name: "nordsweet.position-source.v1",
      storage: createJSONStorage(() => positionStorage),
    },
  ),
);
