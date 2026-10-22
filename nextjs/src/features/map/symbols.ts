/** The legacy canvas paths rendered locally at two pixels per CSS pixel for offline HiDPI maps. */
function sprite(size: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);
  ctx.translate(size / 2, size / 2);
  draw(ctx);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
export function aircraftSymbol(
  color: readonly [number, number, number],
  ownship = false,
) {
  return sprite(ownship ? 48 : 24, (ctx) => {
    if (ownship) {
      ctx.save();
      ctx.translate(0, 0);
      ctx.rotate((0 * Math.PI) / 180);
      ctx.fillStyle = "#244f86";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.quadraticCurveTo(2.8, -15, 2.7, -8);
      ctx.lineTo(3.1, -4.4);
      ctx.lineTo(20, -0.8);
      ctx.lineTo(20, 3.2);
      ctx.lineTo(3.5, 1.7);
      ctx.lineTo(2.6, 9.5);
      ctx.lineTo(8.8, 12.1);
      ctx.lineTo(8.8, 15.5);
      ctx.lineTo(2, 13.9);
      ctx.lineTo(1.2, 19);
      ctx.lineTo(-1.2, 19);
      ctx.lineTo(-2, 13.9);
      ctx.lineTo(-8.8, 15.5);
      ctx.lineTo(-8.8, 12.1);
      ctx.lineTo(-2.6, 9.5);
      ctx.lineTo(-3.5, 1.7);
      ctx.lineTo(-20, 3.2);
      ctx.lineTo(-20, -0.8);
      ctx.lineTo(-3.1, -4.4);
      ctx.quadraticCurveTo(-2.8, -15, 0, -18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // C172-style propeller disc and high-wing cabin reference.
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.86)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -18, 4.2, 0, Math.PI * 2);
      ctx.moveTo(0, -12.5);
      ctx.lineTo(0, 6.5);
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    } else {
      ctx.fillStyle = `rgb(${color.join(",")})`;
      ctx.strokeStyle = color.every((v) => v === 17) ? "#ffffff" : "#111111";
      ctx.lineWidth = 1.6;
      const path = new Path2D("M0 -9 L5.5 7 L0 4.5 L-5.5 7 Z");
      ctx.fill(path);
      ctx.stroke(path);
    }
  });
}
/** Twelve hour dots, with twelve o'clock ahead of the matching ownship symbol. */
export function trafficClockSymbol() {
  return sprite(104, (ctx) => {
    ctx.fillStyle = "#244f86";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    for (let hour = 0; hour < 12; hour++) {
      const angle = (hour * Math.PI) / 6;
      ctx.beginPath();
      ctx.arc(
        Math.sin(angle) * 42,
        -Math.cos(angle) * 42,
        hour === 0 ? 4 : 2.8,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
    }
  });
}

export const pointSymbols = [
  "airport",
  "controlled",
  "runway",
  "vfr",
  "reporting",
  "ifr",
  "vor",
  "vordme",
  "dme",
  "ndb",
  "navaid",
] as const;
/** Symbol colours: dark ink for the light chart, lighter inks for the dark map. */
export type PointInk = {
  airport: string;
  ink: string;
  navaid: string;
  vfr: string;
  ifr: string;
};
export const lightInk: PointInk = {
  airport: "#126cac",
  ink: "#111827",
  navaid: "#7b2cbf",
  vfr: "#1d8b57",
  ifr: "#2563a7",
};
export function pointSymbol(
  symbol: (typeof pointSymbols)[number],
  heading: number | null = 0,
  colors: PointInk = lightInk,
) {
  const kind = ["airport", "controlled", "runway"].includes(symbol)
    ? "airport"
    : ["vfr", "reporting"].includes(symbol)
      ? "vfr"
      : symbol === "ifr"
        ? "ifr"
        : "navaid";
  const controlledAirport = symbol === "controlled",
    uncontrolledIcaoAirport = symbol === "runway",
    vorNavaid = symbol === "vor" || symbol === "vordme",
    vorDmeNavaid = symbol === "vordme",
    dmeNavaid = symbol === "dme",
    ndbNavaid = symbol === "ndb",
    reportingPoint = symbol === "reporting",
    ordinaryVfrPoint = symbol === "vfr";
  return sprite(24, (ctx) => {
    ctx.save();
    if (kind === "airport") {
      if (controlledAirport) {
        ctx.strokeStyle = colors.airport;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1.35;
        ctx.beginPath();
        ctx.moveTo(0 - 9, 0);
        ctx.lineTo(0 + 9, 0);
        ctx.moveTo(0, 0 - 9);
        ctx.lineTo(0, 0 + 9);
        ctx.stroke();
      } else if (uncontrolledIcaoAirport) {
        ctx.strokeStyle = colors.airport;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.stroke();
        if (heading !== null) {
          const radians = (heading * Math.PI) / 180;
          const dx = Math.sin(radians) * 10;
          const dy = -Math.cos(radians) * 10;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(0 - dx, 0 - dy);
          ctx.lineTo(0 + dx, 0 + dy);
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = colors.airport;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (kind === "navaid") {
      if (vorNavaid) {
        ctx.strokeStyle = colors.ink;
        ctx.lineWidth = 1.45;
        if (vorDmeNavaid) {
          ctx.beginPath();
          ctx.rect(0 - 7, 0 - 7, 14, 14);
          ctx.stroke();
        }
        const radius = vorDmeNavaid ? 3.8 : 6;
        ctx.beginPath();
        for (let side = 0; side < 6; side += 1) {
          const angle = -Math.PI / 2 + (side * Math.PI) / 3;
          const x = 0 + Math.cos(angle) * radius;
          const y = 0 + Math.sin(angle) * radius;
          if (side === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = colors.ink;
        ctx.beginPath();
        ctx.arc(0, 0, vorDmeNavaid ? 1.2 : 1.7, 0, Math.PI * 2);
        ctx.fill();
      } else if (dmeNavaid) {
        ctx.strokeStyle = colors.ink;
        ctx.lineWidth = 1.45;
        ctx.beginPath();
        ctx.rect(0 - 5.5, 0 - 5.5, 11, 11);
        ctx.stroke();
        ctx.fillStyle = colors.ink;
        ctx.fillRect(0 - 1.25, 0 - 1.25, 2.5, 2.5);
      } else if (ndbNavaid) {
        ctx.strokeStyle = colors.ink;
        ctx.lineWidth = 1;
        ctx.setLineDash([1, 1.6]);
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = colors.ink;
        ctx.beginPath();
        ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = colors.navaid;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, 0 - 5);
        ctx.lineTo(0 + 5, 0);
        ctx.lineTo(0, 0 + 5);
        ctx.lineTo(0 - 5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else {
      if (reportingPoint) {
        ctx.fillStyle = colors.ink;
        ctx.beginPath();
        ctx.moveTo(0, 0 - 5);
        ctx.lineTo(0 + 5, 0 + 4);
        ctx.lineTo(0 - 5, 0 + 4);
        ctx.closePath();
        ctx.fill();
      } else if (ordinaryVfrPoint) {
        ctx.strokeStyle = colors.ink;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, 0 - 5);
        ctx.lineTo(0 + 5, 0 + 4);
        ctx.lineTo(0 - 5, 0 + 4);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.fillStyle = kind === "vfr" ? colors.vfr : colors.ifr;
        ctx.beginPath();
        ctx.arc(0, 0, kind === "ifr" ? 2.2 : 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  });
}
export { airspacePalette } from "~/domain/airspace-style";

/** Compact vector parachute shared by the map canvas and the zone inspector. */
export const PARACHUTE_PATH =
  "M2 11C2 5.5 6.5 1 12 1S22 5.5 22 11Z M8 11C8 5.5 10 1 12 1C14 1 16 5.5 16 11 M2 11L10 19 M22 11L14 19 M8 11L11 19 M16 11L13 19 M10 19H14V23H10Z";
