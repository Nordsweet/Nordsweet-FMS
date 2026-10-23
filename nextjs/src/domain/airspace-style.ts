import { type AirspaceFeature } from "~/api/aviation/schemas";
import { airspaceKind } from "./map-navigation";

/** FIS service areas remain in COMMs data but are not chart objects to draw or pick. */
export function mapAirspaceVisible(
  zone: Pick<AirspaceFeature["properties"], "name" | "class">,
) {
  return !/\bFIS\b/i.test(`${zone.name} ${zone.class}`);
}

export const airspacePalette: Record<string, { stroke: string; fill: string }> =
  {
    ATZ: { stroke: "#126cac", fill: "rgba(18, 108, 172, 0.13)" },
    CTR: { stroke: "#b35a00", fill: "rgba(255, 156, 45, 0.13)" },
    MCTR: { stroke: "#6134b6", fill: "rgba(110, 92, 210, 0.12)" },
    TMA: { stroke: "#b35a00", fill: "rgba(255, 156, 45, 0.13)" },
    MTMA: { stroke: "#6a47b8", fill: "rgba(132, 119, 220, 0.1)" },
    MATZ: { stroke: "#80612a", fill: "rgba(201, 157, 70, 0.11)" },
    TRA: { stroke: "#20839b", fill: "rgba(73, 178, 207, 0.12)" },
    TSA: { stroke: "#22935f", fill: "rgba(72, 188, 118, 0.11)" },
    P: { stroke: "#bb2e42", fill: "rgba(225, 54, 80, 0.16)" },
    R: { stroke: "#bb2e42", fill: "rgba(225, 54, 80, 0.16)" },
    D: { stroke: "#c06c00", fill: "rgba(222, 142, 31, 0.12)" },
    ADIZ: { stroke: "#354e92", fill: "rgba(77, 99, 168, 0.08)" },
    FIS: { stroke: "#307b4a", fill: "rgba(105, 180, 116, 0.05)" },
    RMZ: { stroke: "#7b6b1a", fill: "rgba(180, 168, 84, 0.10)" },
    TMZ: { stroke: "#896125", fill: "rgba(185, 137, 68, 0.10)" },
    OTHER: { stroke: "#68717f", fill: "rgba(104, 113, 127, 0.08)" },
  };

/** Preserve class colors for ATZ/CTR/TMA/P/R; missing activation data never means inactive. */
export function airspaceStyle(zone: AirspaceFeature["properties"]) {
  const kind = airspaceKind(zone.name, zone.class);
  const terminal = ["ATZ", "CTR", "TMA"].includes(kind);
  const classColor = terminal || kind === "P" || kind === "R";
  const palette =
    zone.active_now === true && !classColor
      ? { stroke: "#d92947", fill: "rgba(221,54,84,.22)" }
      : (airspacePalette[kind] ?? airspacePalette.OTHER!);
  return {
    ...palette,
    fillOpacity: terminal && zone.active_now === false ? 0.5 : 1,
    lineWidth: zone.active_now === true ? 2.2 : 1.2,
    parachuting:
      kind === "ATZ" &&
      zone.activations.some((activation) =>
        /\bPJE\b/i.test(activation.remarks ?? ""),
      ),
  };
}
