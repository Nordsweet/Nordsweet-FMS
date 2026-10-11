import { type PageId } from "~/pages";

export type LoadScript = (src: string) => Promise<unknown>;
export type Engine = { start: (loadScript: LoadScript) => Promise<void> };

// Legacy DOM engines, loaded after hydration. Each is replaced by React code as screens migrate.
export const engines: Record<PageId, () => Promise<Engine>> = {
  "airport-frequencies-editor": () => import("./airport-frequencies-editor.js"),
  "airspaces-editor": () => import("./airspaces-editor.js"),
  "airspaces-map": () => import("./airspaces-map.js"),
  airspaces: () => import("./airspaces.js"),
  "chart-browser": () => import("./chart-browser.js"),
  "checklist-editor": () => import("./checklist-editor.js"),
  "ground-editor": () => import("./ground-editor.js"),
  index: () => import("./index.js"),
  PFD: () => import("./PFD.js"),
  traffic: () => import("./traffic.js"),
  "waypoint-procedure-editor": () => import("./waypoint-procedure-editor.js"),
};
