import { create } from "zustand";
import { type FlightPoint } from "~/data/flight";

export type FlyPanel =
  | "emer"
  | "fpl"
  | "comms"
  | "wx"
  | "chart"
  | "rwy"
  | "info"
  | "options"
  | "notifications"
  | "aircraft"
  | "position";

export type ChartSelection = {
  point: FlightPoint;
  chartId: string;
  requestId: number;
};

/** Transient tools state lets an airport chart open in Fly from either map screen. */
export const useFlyPanels = create<{
  panel: FlyPanel | null;
  fplTab: string;
  chartSelection: ChartSelection | null;
  setPanel: (panel: FlyPanel | null) => void;
  setFplTab: (fplTab: string) => void;
  openChart: (point: FlightPoint, chartId: string) => void;
}>((set) => ({
  panel: null,
  fplTab: "fpl",
  chartSelection: null,
  setPanel: (panel) => set({ panel }),
  setFplTab: (fplTab) => set({ fplTab }),
  openChart: (point, chartId) =>
    set((state) => ({
      panel: "fpl",
      fplTab: "charts",
      chartSelection: {
        point,
        chartId,
        requestId: (state.chartSelection?.requestId ?? 0) + 1,
      },
    })),
}));
