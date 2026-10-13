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
export function pointSymbol(
  symbol: (typeof pointSymbols)[number],
  heading: number | null = 0,
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
        ctx.strokeStyle = "#126cac";
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
        ctx.strokeStyle = "#126cac";
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
        ctx.strokeStyle = "#126cac";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (kind === "navaid") {
      if (vorNavaid) {
        ctx.strokeStyle = "#111827";
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
        ctx.fillStyle = "#111827";
        ctx.beginPath();
        ctx.arc(0, 0, vorDmeNavaid ? 1.2 : 1.7, 0, Math.PI * 2);
        ctx.fill();
      } else if (dmeNavaid) {
        ctx.strokeStyle = "#111827";
        ctx.lineWidth = 1.45;
        ctx.beginPath();
        ctx.rect(0 - 5.5, 0 - 5.5, 11, 11);
        ctx.stroke();
        ctx.fillStyle = "#111827";
        ctx.fillRect(0 - 1.25, 0 - 1.25, 2.5, 2.5);
      } else if (ndbNavaid) {
        ctx.strokeStyle = "#111827";
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
        ctx.fillStyle = "#111827";
        ctx.beginPath();
        ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "#7b2cbf";
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
        ctx.fillStyle = "#111827";
        ctx.beginPath();
        ctx.moveTo(0, 0 - 5);
        ctx.lineTo(0 + 5, 0 + 4);
        ctx.lineTo(0 - 5, 0 + 4);
        ctx.closePath();
        ctx.fill();
      } else if (ordinaryVfrPoint) {
        ctx.strokeStyle = "#111827";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, 0 - 5);
        ctx.lineTo(0 + 5, 0 + 4);
        ctx.lineTo(0 - 5, 0 + 4);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.fillStyle = kind === "vfr" ? "#1d8b57" : "#2563a7";
        ctx.beginPath();
        ctx.arc(0, 0, kind === "ifr" ? 2.2 : 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  });
}
export const airspacePalette: Record<string, { stroke: string; fill: string }> =
  {
    ATZ: { stroke: "#b35a00", fill: "rgba(255, 156, 45, 0.13)" },
    CTR: { stroke: "#682f9d", fill: "rgba(137, 82, 188, 0.12)" },
    MCTR: { stroke: "#6134b6", fill: "rgba(110, 92, 210, 0.12)" },
    TMA: { stroke: "#8540a8", fill: "rgba(173, 101, 214, 0.09)" },
    MTMA: { stroke: "#6a47b8", fill: "rgba(132, 119, 220, 0.1)" },
    MATZ: { stroke: "#80612a", fill: "rgba(201, 157, 70, 0.11)" },
    TRA: { stroke: "#20839b", fill: "rgba(73, 178, 207, 0.12)" },
    TSA: { stroke: "#22935f", fill: "rgba(72, 188, 118, 0.11)" },
    P: { stroke: "#bb2e42", fill: "rgba(225, 54, 80, 0.16)" },
    R: { stroke: "#d4576f", fill: "rgba(221, 85, 114, 0.12)" },
    D: { stroke: "#c06c00", fill: "rgba(222, 142, 31, 0.12)" },
    ADIZ: { stroke: "#354e92", fill: "rgba(77, 99, 168, 0.08)" },
    FIS: { stroke: "#307b4a", fill: "rgba(105, 180, 116, 0.05)" },
    RMZ: { stroke: "#7b6b1a", fill: "rgba(180, 168, 84, 0.10)" },
    TMZ: { stroke: "#896125", fill: "rgba(185, 137, 68, 0.10)" },
    OTHER: { stroke: "#68717f", fill: "rgba(104, 113, 127, 0.08)" },
  };
