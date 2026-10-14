/**
 * Legacy ATIS pad: a note pad for copying a spoken ATIS by tapping tiles. Every field is built from
 * digit/option buttons (tap a value to set it, tap it again to clear it); the composed text fills
 * the ATIS board. Formats, profiles and readiness rules are the legacy ones.
 */

export type AtisField =
  | "location"
  | "information"
  | "time"
  | "arrival"
  | "approach"
  | "runway"
  | "transition"
  | "wind"
  | "visibility"
  | "weather"
  | "clouds"
  | "temperature"
  | "dewPoint"
  | "qnh"
  | "clearance"
  | "specialInstructions"
  | "remarks";

/** Legacy ATIS_PROFILE_LIBRARY: Polish airports (EP…) and the default field order. */
const PROFILES: Record<"PL" | "default", AtisField[]> = {
  PL: [
    "location",
    "information",
    "time",
    "arrival",
    "approach",
    "runway",
    "transition",
    "wind",
    "visibility",
    "clouds",
    "temperature",
    "dewPoint",
    "qnh",
    "clearance",
    "specialInstructions",
  ],
  default: [
    "location",
    "information",
    "time",
    "runway",
    "wind",
    "visibility",
    "weather",
    "clouds",
    "temperature",
    "dewPoint",
    "qnh",
    "transition",
    "remarks",
  ],
};
export const atisFields = (icao: string) =>
  PROFILES[icao.toUpperCase().startsWith("EP") ? "PL" : "default"];

/** Multi-value fields (legacy ATIS_MULTI_VALUE_FIELDS). */
const MULTI = new Set<AtisField>([
  "weather",
  "clouds",
  "remarks",
  "specialInstructions",
]);
/** Fields whose completion scrolls to the next card (legacy ATIS_AUTO_ADVANCE_FIELDS). */
export const AUTO_ADVANCE = new Set<AtisField>([
  "information",
  "time",
  "arrival",
  "approach",
  "runway",
  "transition",
  "wind",
  "visibility",
  "weather",
  "clouds",
  "temperature",
  "dewPoint",
  "qnh",
  "clearance",
]);

/** Legacy airport ATIS data: arrival flow letters (with their runway) and approach variants. */
export const ATIS_AIRPORTS: Record<
  string,
  {
    arrivals?: { letter: string; runway: string }[];
    approachVariants?: Record<string, string[]>;
  }
> = {
  EPKK: {
    arrivals: [
      { letter: "G", runway: "25" },
      { letter: "H", runway: "07" },
    ],
  },
  EPKT: {
    arrivals: [
      { letter: "N", runway: "" },
      { letter: "X", runway: "" },
    ],
  },
  EPPO: {
    arrivals: [
      { letter: "T", runway: "10" },
      { letter: "D", runway: "28" },
      { letter: "M", runway: "28" },
    ],
  },
  EPRZ: {
    arrivals: [
      { letter: "G", runway: "" },
      { letter: "T", runway: "" },
    ],
  },
  EPWA: {
    arrivals: [
      { letter: "E", runway: "" },
      { letter: "W", runway: "" },
    ],
    approachVariants: { ILS: ["Y", "Z"] },
  },
};

export const CLOUD_TYPES = ["FEW", "SCT", "BKN", "OVC"] as const;
export type CloudType = (typeof CLOUD_TYPES)[number];
export const WEATHER_OPTIONS = [
  "DZ",
  "RA",
  "SN",
  "BR",
  "FG",
  "HZ",
  "TSRA",
  "SHRA",
  "FZRA",
  "GR",
];
const INTENSITY = new Set(["DZ", "RA", "SN", "TSRA", "SHRA", "FZRA", "GR"]);
export const APPROACH_OPTIONS = ["ILS", "RNAV", "RNP", "VOR", "VISUAL"];

type Digits<K extends string> = Record<K, string>;
type DistanceDigits = Digits<"thousands" | "hundreds" | "tens">;

export type AtisPad = {
  /** Plain values: location, information, arrival, approach, runway, clearance, multi fields. */
  values: Partial<Record<AtisField, string | string[]>>;
  /** Board tiles marked as copied. */
  checked: Partial<Record<AtisField, boolean>>;
  time: Digits<"hourTens" | "hourOnes" | "minuteTens" | "minuteOnes">;
  wind: Digits<
    | "directionHundreds"
    | "directionTens"
    | "speedTens"
    | "speedOnes"
    | "gustTens"
    | "gustOnes"
    | "varyingFromHundreds"
    | "varyingFromTens"
    | "varyingToHundreds"
    | "varyingToTens"
  > & {
    mode: "numeric" | "calm" | "vrb";
    gust: boolean;
    varying: boolean;
  };
  visibility: DistanceDigits & { mode: "numeric" | "cavok" | "max" };
  rvr: {
    enabled: boolean;
    parts: [DistanceDigits, DistanceDigits, DistanceDigits];
  };
  rcr: { enabled: boolean; parts: [string, string, string] };
  weather: { modifier: "" | "-" | "+"; phenomena: string[] };
  clouds: {
    expanded: CloudType[];
    layers: Record<CloudType, Digits<"thousands" | "hundreds">>;
  };
  temp: Digits<"tens" | "ones"> & { negative: boolean };
  dew: Digits<"tens" | "ones"> & { negative: boolean };
  qnh: Digits<"base" | "tens" | "ones">;
  transition: { addHundred: boolean; five: boolean; tens: string };
};

const rvrDefault = (): DistanceDigits => ({
  thousands: "1",
  hundreds: "5",
  tens: "",
});
export const emptyAtisPad = (): AtisPad => ({
  values: {},
  checked: {},
  time: { hourTens: "", hourOnes: "", minuteTens: "", minuteOnes: "" },
  wind: {
    mode: "numeric",
    gust: false,
    varying: false,
    directionHundreds: "",
    directionTens: "",
    speedTens: "",
    speedOnes: "",
    gustTens: "",
    gustOnes: "",
    varyingFromHundreds: "",
    varyingFromTens: "",
    varyingToHundreds: "",
    varyingToTens: "",
  },
  visibility: { mode: "numeric", thousands: "", hundreds: "", tens: "" },
  rvr: { enabled: false, parts: [rvrDefault(), rvrDefault(), rvrDefault()] },
  rcr: { enabled: false, parts: ["6", "6", "6"] },
  weather: { modifier: "", phenomena: [] },
  clouds: {
    expanded: [],
    layers: {
      FEW: { thousands: "", hundreds: "" },
      SCT: { thousands: "", hundreds: "" },
      BKN: { thousands: "", hundreds: "" },
      OVC: { thousands: "", hundreds: "" },
    },
  },
  temp: { negative: false, tens: "", ones: "" },
  dew: { negative: false, tens: "", ones: "" },
  qnh: { base: "", tens: "", ones: "" },
  transition: { addHundred: false, five: false, tens: "" },
});

/* ----------------------------- composed values ----------------------------- */

const d = (v: string) => v || "0";
export function timeValue({
  hourTens,
  hourOnes,
  minuteTens,
  minuteOnes,
}: AtisPad["time"]) {
  return hourTens || hourOnes || minuteTens || minuteOnes
    ? `${d(hourTens)}${d(hourOnes)}:${d(minuteTens)}${d(minuteOnes)}`
    : "";
}

export function windValue(w: AtisPad["wind"]) {
  if (w.mode === "calm") return "CALM";
  if (
    w.mode !== "vrb" &&
    !w.directionHundreds &&
    !w.directionTens &&
    !w.speedTens &&
    !w.speedOnes
  )
    return "";
  const speed = d(w.speedTens) + d(w.speedOnes);
  const gust =
    w.gust && (w.gustTens || w.gustOnes)
      ? `G${d(w.gustTens)}${d(w.gustOnes)}`
      : "";
  if (w.mode === "vrb") return `VRB/${speed}${gust}KT`;
  const varying =
    w.varying &&
    (w.varyingFromHundreds || w.varyingFromTens) &&
    (w.varyingToHundreds || w.varyingToTens)
      ? ` ${d(w.varyingFromHundreds)}${d(w.varyingFromTens)}0V${d(w.varyingToHundreds)}${d(w.varyingToTens)}0`
      : "";
  return `${d(w.directionHundreds)}${d(w.directionTens)}0/${speed}${gust}KT${varying}`;
}

const distance = (p: DistanceDigits) =>
  Number(p.thousands || 0) * 1000 +
  Number(p.hundreds || 0) * 100 +
  Number(p.tens || 0) * 10;

export function visibilityValue(v: AtisPad["visibility"]) {
  if (v.mode === "cavok") return "CAVOK";
  if (v.mode === "max") return "9999";
  if (!v.thousands && !v.hundreds && !v.tens) return "";
  return String(distance(v)).padStart(4, "0");
}

/** RVR legs are 10–1500 m in 10 m steps (legacy getAtisVisibilityRvrDistanceToken). */
const rvrToken = (m: number) =>
  m > 0
    ? String(Math.min(1500, Math.max(10, Math.round(m / 10) * 10))).padStart(
        4,
        "0",
      )
    : "";
export const rvrValue = (r: AtisPad["rvr"]) =>
  r.enabled ? `RVR ${r.parts.map((p) => rvrToken(distance(p))).join("/")}` : "";
export const rcrValue = (r: AtisPad["rcr"]) =>
  r.enabled ? `RCR ${r.parts.join("")}` : "";

export const weatherTokens = (w: AtisPad["weather"]) =>
  w.phenomena.map((p) => (w.modifier && INTENSITY.has(p) ? w.modifier + p : p));

export function cloudToken(
  type: CloudType,
  layer: Digits<"thousands" | "hundreds">,
) {
  if (!layer.thousands && !layer.hundreds) return "";
  return (
    type +
    String(
      Number(layer.thousands || 0) * 10 + Number(layer.hundreds || 0),
    ).padStart(3, "0")
  );
}
export const cloudTokens = (c: AtisPad["clouds"]) =>
  CLOUD_TYPES.map((type) => cloudToken(type, c.layers[type])).filter(Boolean);

export const signedValue = (t: AtisPad["temp"]) =>
  !t.tens && !t.ones ? "" : `${t.negative ? "M" : ""}${d(t.tens)}${d(t.ones)}`;

export const qnhValue = (q: AtisPad["qnh"]) =>
  q.base
    ? `QNH ${Number(q.base) + Number(q.tens || 0) * 10 + Number(q.ones || 0)}`
    : "";

export function transitionValue(t: AtisPad["transition"]) {
  if (!t.addHundred && !t.five && !t.tens) return "";
  const value =
    (t.addHundred ? 100 : 0) + Number(t.tens || 0) * 10 + (t.five ? 5 : 0);
  const digits = t.addHundred ? 3 : t.tens || t.five ? 2 : 1;
  return `TL ${String(value).padStart(digits, "0")}`;
}

const text = (pad: AtisPad, key: AtisField) => {
  const v = pad.values[key];
  return Array.isArray(v)
    ? v.join(key === "remarks" || key === "specialInstructions" ? ", " : " ")
    : (v ?? "");
};

/** The text a board tile shows (legacy getAtisCardValue). */
export function atisValue(pad: AtisPad, key: AtisField): string {
  switch (key) {
    case "time":
      return timeValue(pad.time);
    case "wind":
      return windValue(pad.wind);
    case "visibility":
      return [visibilityValue(pad.visibility), rvrValue(pad.rvr)]
        .filter(Boolean)
        .join(" | ");
    case "runway":
      return [text(pad, "runway"), rcrValue(pad.rcr)]
        .filter(Boolean)
        .join(" | ");
    case "weather":
      return weatherTokens(pad.weather).join(" ");
    case "clouds":
      return cloudTokens(pad.clouds).join(" ");
    case "temperature":
      return signedValue(pad.temp);
    case "dewPoint":
      return signedValue(pad.dew);
    case "qnh":
      return qnhValue(pad.qnh);
    case "transition":
      return transitionValue(pad.transition);
    default:
      return text(pad, key);
  }
}

/** Legacy isAtisFieldReadyForAdvance: the field is complete enough to move on. */
export function atisReady(
  pad: AtisPad,
  key: AtisField,
  approachVariants: string[] = [],
) {
  const { time, wind } = pad;
  switch (key) {
    case "time":
      return (
        !!(time.hourTens || time.hourOnes) &&
        !!(time.minuteTens || time.minuteOnes)
      );
    case "approach": {
      const [base, variant] = text(pad, "approach").split(" ");
      return !!base && (!approachVariants.length || !!variant);
    }
    case "runway":
      return !!text(pad, "runway") && (!pad.rcr.enabled || !!rcrValue(pad.rcr));
    case "wind": {
      if (wind.mode === "calm") return true;
      if (!(wind.speedTens || wind.speedOnes)) return false;
      const gustOk = !wind.gust || !!(wind.gustTens || wind.gustOnes);
      if (wind.mode === "vrb") return gustOk;
      const varyingOk =
        !wind.varying ||
        (!!(wind.varyingFromHundreds || wind.varyingFromTens) &&
          !!(wind.varyingToHundreds || wind.varyingToTens));
      return (
        !!(wind.directionHundreds || wind.directionTens) && gustOk && varyingOk
      );
    }
    case "visibility":
      return (
        !!visibilityValue(pad.visibility) &&
        (!pad.rvr.enabled ||
          pad.rvr.parts.every((p) => !!rvrToken(distance(p))))
      );
    case "clouds":
      return (
        cloudTokens(pad.clouds).length > 0 &&
        pad.clouds.expanded.every((t) => !!cloudToken(t, pad.clouds.layers[t]))
      );
    default:
      return !!atisValue(pad, key);
  }
}

/* --------------------------------- actions --------------------------------- */

export type AtisAction =
  | { type: "set"; field: AtisField; value: string }
  | { type: "toggle"; field: AtisField; value: string }
  | { type: "custom"; field: AtisField; value: string }
  | { type: "clear"; field: AtisField }
  | { type: "check"; field: AtisField }
  | { type: "time"; part: keyof AtisPad["time"]; value: string }
  | { type: "approach"; value: string }
  | { type: "approachVariant"; value: string }
  | {
      type: "wind";
      part: Exclude<keyof AtisPad["wind"], "mode" | "gust" | "varying">;
      value: string;
    }
  | { type: "windMode"; value: "calm" | "vrb" }
  | { type: "windToggle"; value: "gust" | "varying" }
  | { type: "visibility"; part: keyof DistanceDigits; value: string }
  | { type: "visibilityMode"; value: "cavok" | "max" }
  | { type: "rvrToggle" }
  | { type: "rvr"; index: 0 | 1 | 2; part: keyof DistanceDigits; value: string }
  | { type: "rcrToggle" }
  | { type: "rcr"; index: 0 | 1 | 2; value: string }
  | { type: "weatherModifier"; value: "-" | "+" }
  | { type: "weather"; value: string }
  | { type: "cloudType"; value: CloudType }
  | {
      type: "cloud";
      layer: CloudType;
      part: "thousands" | "hundreds";
      value: string;
    }
  | { type: "cloudClear"; layer: CloudType }
  | { type: "sign"; field: "temp" | "dew" }
  | {
      type: "temp";
      field: "temp" | "dew";
      part: "tens" | "ones";
      value: string;
    }
  | { type: "qnh"; part: keyof AtisPad["qnh"]; value: string }
  | { type: "transition"; part: "addHundred" | "five" | "tens"; value?: string }
  | { type: "preset"; field: AtisField; value: string }
  | { type: "reset" };

const flip = (current: string, value: string) =>
  current === value ? "" : value;

/** Which field an action belongs to (for the auto-advance and status line). */
export function actionField(a: AtisAction): AtisField | null {
  switch (a.type) {
    case "set":
    case "toggle":
    case "custom":
    case "clear":
    case "check":
    case "preset":
      return a.field;
    case "time":
      return "time";
    case "approach":
    case "approachVariant":
      return "approach";
    case "wind":
    case "windMode":
    case "windToggle":
      return "wind";
    case "visibility":
    case "visibilityMode":
    case "rvrToggle":
    case "rvr":
      return "visibility";
    case "rcrToggle":
    case "rcr":
      return "runway";
    case "weatherModifier":
    case "weather":
      return "weather";
    case "cloudType":
    case "cloud":
    case "cloudClear":
      return "clouds";
    case "sign":
    case "temp":
      return a.field === "temp" ? "temperature" : "dewPoint";
    case "qnh":
      return "qnh";
    case "transition":
      return "transition";
    case "reset":
      return null;
  }
}

/** Actions that open a sub-section rather than complete the field (legacy shouldAtisAutoAdvance). */
export const NO_ADVANCE = new Set<AtisAction["type"]>([
  "clear",
  "check",
  "cloudType",
  "cloudClear",
  "rcrToggle",
  "rvrToggle",
  "windToggle",
  "weatherModifier",
]);

export function atisReducer(pad: AtisPad, a: AtisAction): AtisPad {
  const p = structuredClone(pad);
  switch (a.type) {
    case "reset":
      return emptyAtisPad();
    case "check":
      p.checked[a.field] = !p.checked[a.field];
      return p;
    case "set": {
      const current = p.values[a.field];
      p.values[a.field] = current === a.value ? "" : a.value;
      return p;
    }
    case "toggle": {
      const list = Array.isArray(p.values[a.field])
        ? [...(p.values[a.field] as string[])]
        : [];
      const i = list.indexOf(a.value);
      if (i >= 0) list.splice(i, 1);
      else list.push(a.value);
      p.values[a.field] = list;
      return p;
    }
    case "custom": {
      const value = a.value.trim().toUpperCase();
      if (!value) return atisReducer(p, { type: "clear", field: a.field });
      p.values[a.field] = MULTI.has(a.field)
        ? value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : value;
      return p;
    }
    case "clear": {
      const fresh = emptyAtisPad();
      const f = a.field;
      if (f === "time") p.time = fresh.time;
      if (f === "wind") p.wind = fresh.wind;
      if (f === "visibility") {
        p.visibility = fresh.visibility;
        p.rvr = fresh.rvr;
      }
      if (f === "runway") p.rcr = fresh.rcr;
      if (f === "weather") p.weather = fresh.weather;
      if (f === "clouds") p.clouds = fresh.clouds;
      if (f === "temperature") p.temp = fresh.temp;
      if (f === "dewPoint") p.dew = fresh.dew;
      if (f === "qnh") p.qnh = fresh.qnh;
      if (f === "transition") p.transition = fresh.transition;
      delete p.values[f];
      delete p.checked[f];
      return p;
    }
    case "time": {
      const t = p.time;
      if (a.part === "hourOnes" && t.hourTens === "2" && Number(a.value) > 3)
        return pad;
      t[a.part] = flip(t[a.part], a.value);
      if (a.part === "hourTens" && t.hourTens === "2" && Number(t.hourOnes) > 3)
        t.hourOnes = "";
      return p;
    }
    case "approach": {
      const [base, variant] = text(pad, "approach").split(" ");
      p.values.approach = base === a.value ? (variant ? a.value : "") : a.value;
      return p;
    }
    case "approachVariant": {
      const [base, variant] = text(pad, "approach").split(" ");
      if (!base) return pad;
      p.values.approach = variant === a.value ? base : `${base} ${a.value}`;
      return p;
    }
    case "wind": {
      const w = p.wind;
      const hundredsOf: Partial<Record<typeof a.part, keyof typeof w>> = {
        directionTens: "directionHundreds",
        varyingFromTens: "varyingFromHundreds",
        varyingToTens: "varyingToHundreds",
      };
      const hundreds = hundredsOf[a.part];
      // 360 is the largest direction: with 300, tens stop at 60.
      if (hundreds && w[hundreds] === "3" && Number(a.value) > 6) return pad;
      if (a.part.startsWith("direction") || a.part.startsWith("varying")) {
        w.mode = "numeric";
        if (a.part.startsWith("varying")) w.varying = true;
      } else if (w.mode === "calm") w.mode = "numeric";
      if (a.part.startsWith("gust")) w.gust = true;
      w[a.part] = flip(w[a.part], a.value);
      for (const [tens, h] of Object.entries(hundredsOf) as [
        typeof a.part,
        keyof typeof w,
      ][])
        if (a.part === h && w[h] === "3" && Number(w[tens]) > 6) w[tens] = "";
      return p;
    }
    case "windMode": {
      const fresh = emptyAtisPad().wind;
      if (a.value === "calm")
        p.wind = p.wind.mode === "calm" ? fresh : { ...fresh, mode: "calm" };
      else
        p.wind =
          p.wind.mode === "vrb"
            ? { ...p.wind, mode: "numeric" }
            : {
                ...p.wind,
                mode: "vrb",
                directionHundreds: "",
                directionTens: "",
                varying: false,
                varyingFromHundreds: "",
                varyingFromTens: "",
                varyingToHundreds: "",
                varyingToTens: "",
              };
      return p;
    }
    case "windToggle": {
      const w = p.wind;
      if (a.value === "varying") {
        if (w.mode !== "numeric") return pad;
        w.varying = !w.varying;
        if (!w.varying)
          Object.assign(w, {
            varyingFromHundreds: "",
            varyingFromTens: "",
            varyingToHundreds: "",
            varyingToTens: "",
          });
      } else {
        if (w.mode === "calm") return pad;
        w.gust = !w.gust;
        if (!w.gust) Object.assign(w, { gustTens: "", gustOnes: "" });
      }
      return p;
    }
    case "visibility":
      p.visibility.mode = "numeric";
      p.visibility[a.part] = flip(p.visibility[a.part], a.value);
      return p;
    case "visibilityMode":
      p.visibility =
        p.visibility.mode === a.value
          ? emptyAtisPad().visibility
          : { mode: a.value, thousands: "", hundreds: "", tens: "" };
      return p;
    case "rvrToggle":
      p.rvr.enabled = !p.rvr.enabled;
      return p;
    case "rvr": {
      const part = p.rvr.parts[a.index];
      part[a.part] = flip(part[a.part], a.value);
      // Legacy caps a leg at 1500 m.
      if (part.thousands === "1" && Number(part.hundreds) > 5)
        part.hundreds = "5";
      if (part.thousands === "1" && part.hundreds === "5") part.tens = "";
      if (!distance(part)) p.rvr.parts[a.index] = rvrDefault();
      p.rvr.enabled = true;
      return p;
    }
    case "rcrToggle":
      p.rcr.enabled = !p.rcr.enabled;
      return p;
    case "rcr":
      p.rcr.parts[a.index] = a.value;
      p.rcr.enabled = true;
      return p;
    case "weatherModifier":
      p.weather.modifier = p.weather.modifier === a.value ? "" : a.value;
      return p;
    case "weather": {
      const list = p.weather.phenomena;
      const i = list.indexOf(a.value);
      if (i >= 0) list.splice(i, 1);
      else list.push(a.value);
      return p;
    }
    case "cloudType": {
      const i = p.clouds.expanded.indexOf(a.value);
      if (i >= 0) p.clouds.expanded.splice(i, 1);
      else p.clouds.expanded.push(a.value);
      return p;
    }
    case "cloud": {
      const layer = p.clouds.layers[a.layer];
      layer[a.part] = flip(layer[a.part], a.value);
      if (!p.clouds.expanded.includes(a.layer)) p.clouds.expanded.push(a.layer);
      return p;
    }
    case "cloudClear":
      p.clouds.layers[a.layer] = { thousands: "", hundreds: "" };
      return p;
    case "sign":
      p[a.field].negative = !p[a.field].negative;
      return p;
    case "temp":
      p[a.field][a.part] = flip(p[a.field][a.part], a.value);
      return p;
    case "qnh":
      p.qnh[a.part] = flip(p.qnh[a.part], a.value);
      return p;
    case "transition":
      if (a.part === "tens")
        p.transition.tens = flip(p.transition.tens, a.value ?? "");
      else p.transition[a.part] = !p.transition[a.part];
      return p;
    case "preset":
      return applyPreset(p, a.field, a.value);
  }
}

/** A METAR suggestion chip: sets the field from the METAR value, or clears it when it already matches. */
function applyPreset(p: AtisPad, field: AtisField, value: string): AtisPad {
  if (atisValue(p, field) === value)
    return atisReducer(p, { type: "clear", field });
  const fresh = atisReducer(p, { type: "clear", field });
  switch (field) {
    case "time": {
      const m = /^(\d)(\d):(\d)(\d)$/.exec(value);
      if (m)
        fresh.time = {
          hourTens: m[1]!,
          hourOnes: m[2]!,
          minuteTens: m[3]!,
          minuteOnes: m[4]!,
        };
      return fresh;
    }
    case "wind": {
      if (value === "CALM") {
        fresh.wind.mode = "calm";
        return fresh;
      }
      const m = /^(VRB|\d{3})\/(\d{2})(?:G(\d{2}))?KT$/.exec(value);
      if (!m) return fresh;
      const w = fresh.wind;
      w.speedTens = m[2]![0]!;
      w.speedOnes = m[2]![1]!;
      if (m[3])
        Object.assign(w, { gust: true, gustTens: m[3][0], gustOnes: m[3][1] });
      if (m[1] === "VRB") w.mode = "vrb";
      else
        Object.assign(w, {
          directionHundreds: m[1]![0],
          directionTens: m[1]![1],
        });
      return fresh;
    }
    case "visibility":
      if (value === "CAVOK") fresh.visibility.mode = "cavok";
      else if (value === "9999") fresh.visibility.mode = "max";
      else if (/^\d{4}$/.test(value))
        fresh.visibility = {
          mode: "numeric",
          thousands: value[0]!.replace("0", ""),
          hundreds: value[1]!.replace("0", ""),
          tens: value[2]!.replace("0", ""),
        };
      return fresh;
    case "clouds":
      for (const token of value.split(" ")) {
        const m = /^(FEW|SCT|BKN|OVC)(\d{3})$/.exec(token);
        if (!m) continue;
        const type = m[1] as CloudType;
        fresh.clouds.layers[type] = {
          thousands: m[2]![1]!.replace("0", ""),
          hundreds: m[2]![2]!.replace("0", ""),
        };
        fresh.clouds.expanded.push(type);
      }
      return fresh;
    case "temperature":
    case "dewPoint": {
      const m = /^(M?)(\d)(\d)$/.exec(value);
      if (m)
        fresh[field === "temperature" ? "temp" : "dew"] = {
          negative: !!m[1],
          tens: m[2]!.replace("0", ""),
          ones: m[3]!,
        };
      return fresh;
    }
    case "qnh": {
      const n = Number(/(\d{3,4})/.exec(value)?.[1]);
      if (n)
        fresh.qnh = {
          base: n >= 1000 ? "1000" : "900",
          tens: String(Math.floor((n % 100) / 10)),
          ones: String(n % 10),
        };
      return fresh;
    }
    case "weather":
      fresh.weather.phenomena = value.split(" ").filter(Boolean);
      return fresh;
    default:
      fresh.values[field] = value;
      return fresh;
  }
}

/** Legacy METAR suggestions (blue chips): time, wind, visibility, weather, clouds, temperatures, QNH. */
export function metarHints(raw: string | null | undefined) {
  if (!raw) return {};
  const time = /\b\d{2}(\d{2})(\d{2})Z\b/.exec(raw);
  const wind = /\b(\d{3}|VRB)(\d{2})(?:G(\d{2}))?KT\b/.exec(raw);
  const vis = /\bCAVOK\b/.test(raw)
    ? "CAVOK"
    : /KT\s(?:\d{3}V\d{3}\s)?(\d{4})\b/.exec(raw)?.[1];
  const clouds = raw.match(/\b(?:FEW|SCT|BKN|OVC)\d{3}\b/g);
  const temps = /\s(M?\d{2})\/(M?\d{2})(?=\s|$)/.exec(raw);
  const qnh = /\sQ(\d{4})\b/.exec(raw)?.[1];
  const weather = raw.match(
    /(?<=\s)[-+]?(?:TS|SH|FZ)?(?:DZ|RA|SN|BR|FG|HZ|GR)(?=\s)/g,
  );
  return {
    time: time ? `${time[1]}:${time[2]}` : undefined,
    wind: wind
      ? wind[1] === "000" && wind[2] === "00"
        ? "CALM"
        : `${wind[1] === "VRB" ? "VRB" : wind[1]}/${wind[2]}${wind[3] ? `G${wind[3]}` : ""}KT`
      : undefined,
    visibility: vis ?? undefined,
    weather: weather?.join(" "),
    clouds: clouds?.join(" "),
    temperature: temps?.[1],
    dewPoint: temps?.[2],
    qnh: qnh ? `QNH ${Number(qnh)}` : undefined,
  } as Partial<Record<AtisField, string>>;
}
