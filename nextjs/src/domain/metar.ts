import { inHgToHpa, mpsToKt } from "./units";

export type MetarValues = {
  /** null for variable (VRB) or calm wind. Direction is true. */
  windDirectionDeg: number | null;
  windSpeedKt: number;
  gustKt: number | null;
  temperatureC: number | null;
  qnhHpa: number | null;
};

const temp = (s: string) =>
  s.startsWith("M") ? -Number(s.slice(1)) : Number(s);

/** The values performance planning needs from a METAR: surface wind, temperature and QNH. */
export function parseMetar(raw: string): MetarValues {
  const wind = /\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)\b/.exec(raw);
  const toKt = (v: string | undefined) =>
    v === undefined
      ? null
      : wind?.[4] === "MPS"
        ? mpsToKt(Number(v))
        : Number(v);
  const temps = /\s(M?\d{2})\/(M?\d{2})?(?=\s|$)/.exec(raw);
  const q = /\sQ(\d{4})\b/.exec(raw);
  const a = /\sA(\d{4})\b/.exec(raw);
  const speed = toKt(wind?.[2]) ?? 0;
  return {
    windDirectionDeg:
      !wind || wind[1] === "VRB" || speed === 0 ? null : Number(wind[1]),
    windSpeedKt: speed,
    gustKt: toKt(wind?.[3]),
    temperatureC: temps ? temp(temps[1]!) : null,
    qnhHpa: q
      ? Number(q[1])
      : a
        ? Math.round(inHgToHpa(Number(a[1]) / 100))
        : null,
  };
}
