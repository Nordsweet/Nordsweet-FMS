"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "~/api";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { type FlightPoint } from "~/data/flight";
import {
  type AtisAction,
  type AtisField,
  type AtisPad,
  APPROACH_OPTIONS,
  ATIS_AIRPORTS,
  AUTO_ADVANCE,
  CLOUD_TYPES,
  NO_ADVANCE,
  WEATHER_OPTIONS,
  actionField,
  atisFields,
  atisReady,
  atisReducer,
  atisValue,
  cloudToken,
  metarHints,
  rcrValue,
  rvrValue,
  visibilityValue,
} from "~/domain/atis-pad";
import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";
import { useAtis } from "~/stores/atis";
import { useSettings } from "~/stores/settings";

import { useBriefing } from "./weather";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
type WindDigit = Exclude<keyof AtisPad["wind"], "mode" | "gust" | "varying">;

/** One option chip: active = selected, metar = a METAR suggestion (legacy blue chips). */
function Chip({
  active = false,
  metar = false,
  disabled = false,
  onClick,
  children,
  label,
}: {
  active?: boolean;
  metar?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-11 min-w-11 rounded-xl border px-3 text-xs font-bold tracking-[0.04em] uppercase transition-colors disabled:opacity-35",
        active
          ? "border-transparent bg-[linear-gradient(135deg,rgba(118,242,164,0.95),rgba(122,243,211,0.9))] text-[#06101b]"
          : metar
            ? "border-sky-400/60 bg-sky-500/15 text-sky-200"
            : "bg-[rgba(16,30,52,0.6)] hover:bg-[rgba(26,47,78,0.9)]",
      )}
    >
      {children}
    </button>
  );
}

/** A labelled row of digit chips (legacy "atis-time-group"). */
function Part({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground text-[0.7rem] tracking-[0.08em] uppercase">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Free text for a field ("Manual" in legacy): applied on Enter or when leaving the box. */
function ManualInput({
  value,
  onApply,
  label,
}: {
  value: string;
  onApply: (value: string) => void;
  label: string;
}) {
  return (
    <Input
      aria-label={label}
      placeholder={label}
      defaultValue={value}
      key={value}
      className="h-11 max-w-72 uppercase"
      onBlur={(e) => {
        if (e.target.value.trim().toUpperCase() !== value)
          onApply(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

/**
 * Legacy ATIS pad: the ATIS board (tap a tile to mark it copied) above one card per field, each
 * built from tap-to-set chips so a spoken ATIS can be copied as it is read. A finished field scrolls
 * to the next one.
 */
export function AtisPadDialog({
  point,
  open,
  onOpenChange,
}: {
  point: FlightPoint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const { pad, dispatch: store } = useAtis();
  const autoscroll = useSettings((s) => s.atisAutoscroll);
  const airport = useQuery(
    api.airports.get.queryOptions({ code: point.ident }),
  ).data;
  const frequencies =
    useQuery(api.frequencies.byAirport.queryOptions({ airport: point.ident }))
      .data ?? [];
  const { station, briefing } = useBriefing(point);
  const hints = metarHints(briefing.data?.metar?.raw);
  const [status, setStatus] = useState(t("atis.status.start"));

  const icao = point.ident.toUpperCase();
  const fields = atisFields(icao);
  const local = ATIS_AIRPORTS[icao] ?? {};
  const approachBase = atisValue(pad, "approach").split(" ")[0] ?? "";
  const variants = local.approachVariants?.[approachBase] ?? [];
  const atisFrequency = frequencies.find((f) => f.service === "atis");
  // ATIS from: the airport itself, or its weather station when it has no ATIS of its own.
  const sources = [
    {
      value: `${icao} ${airport?.name ?? ""}`.trim(),
      label: [`${icao} ATIS`, atisFrequency?.frequencyMhz]
        .filter(Boolean)
        .join(" "),
    },
    ...(station && station.icao !== icao && !atisFrequency
      ? [{ value: station.icao, label: `${station.icao} ATIS` }]
      : []),
  ];
  const valueOf = (field: AtisField) =>
    field === "location"
      ? atisValue(pad, "location") || sources[0]!.value
      : atisValue(pad, field);

  // The field to move on from once it is complete (legacy auto-advance, 520 ms later).
  const [advanceFrom, setAdvanceFrom] = useState<{ field: AtisField } | null>(
    null,
  );
  useEffect(() => {
    if (!advanceFrom || !atisReady(pad, advanceFrom.field, variants)) return;
    const following = fields[fields.indexOf(advanceFrom.field) + 1];
    const id = setTimeout(
      () =>
        following &&
        document
          .querySelector(`[data-atis-card="${following}"]`)
          ?.scrollIntoView?.({ behavior: "smooth", block: "start" }),
      520,
    );
    return () => clearTimeout(id);
    // Only a new tap schedules the scroll; `pad` is read as it is then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceFrom]);

  const dispatch = (action: AtisAction) => {
    const next = atisReducer(pad, action);
    store(action);
    const field = actionField(action);
    if (!field) return;
    setStatus(
      atisValue(next, field)
        ? t("atis.status.set", {
            field: t(`atis.field.${field}`),
            value: atisValue(next, field),
          })
        : t("atis.status.cleared", { field: t(`atis.field.${field}`) }),
    );
    setAdvanceFrom(
      autoscroll && AUTO_ADVANCE.has(field) && !NO_ADVANCE.has(action.type)
        ? { field }
        : null,
    );
  };

  const digits = (
    active: string,
    onPick: (v: string) => void,
    label: (n: number) => string,
    opts: { values?: number[]; disabled?: (n: number) => boolean } = {},
  ) =>
    (opts.values ?? DIGITS).map((n) => (
      <Chip
        key={n}
        active={active === String(n)}
        disabled={opts.disabled?.(n)}
        onClick={() => onPick(String(n))}
      >
        {label(n)}
      </Chip>
    ));
  const preset = (field: AtisField, value = hints[field]) =>
    value ? (
      <Chip
        metar
        active={valueOf(field) === value}
        onClick={() => dispatch({ type: "preset", field, value })}
      >
        {value}
      </Chip>
    ) : null;
  const manual = (field: AtisField) => (
    <ManualInput
      label={t("atis.manual")}
      value={atisValue(pad, field)}
      onApply={(value) => dispatch({ type: "custom", field, value })}
    />
  );
  const x10 = (n: number) => String(n * 10);
  const x100 = (n: number) => String(n * 100);
  const x1000 = (n: number) => String(n * 1000);

  const control = (field: AtisField): React.ReactNode => {
    const { time, wind, visibility, rvr, rcr, weather, clouds, qnh } = pad;
    switch (field) {
      case "location":
        return (
          <div className="flex flex-wrap gap-1.5">
            {sources.map((s) => (
              <Chip
                key={s.value}
                active={valueOf("location") === s.value}
                onClick={() => dispatch({ type: "set", field, value: s.value })}
              >
                {s.label}
              </Chip>
            ))}
          </div>
        );
      case "information":
        return (
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 26 }, (_, i) =>
              String.fromCharCode(65 + i),
            ).map((l) => (
              <Chip
                key={l}
                active={valueOf(field) === l}
                onClick={() => dispatch({ type: "set", field, value: l })}
              >
                {l}
              </Chip>
            ))}
          </div>
        );
      case "time":
        return (
          <>
            {preset("time")}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Part label={t("atis.part.hourTens")}>
                  {digits(
                    time.hourTens,
                    (v) =>
                      dispatch({ type: "time", part: "hourTens", value: v }),
                    x10,
                    { values: [1, 2] },
                  )}
                </Part>
                <Part label={t("atis.part.hourOnes")}>
                  {digits(
                    time.hourOnes,
                    (v) =>
                      dispatch({ type: "time", part: "hourOnes", value: v }),
                    String,
                    {
                      disabled: (n) => time.hourTens === "2" && n > 3,
                    },
                  )}
                </Part>
              </div>
              <div className="grid gap-2">
                <Part label={t("atis.part.minuteTens")}>
                  {digits(
                    time.minuteTens,
                    (v) =>
                      dispatch({ type: "time", part: "minuteTens", value: v }),
                    x10,
                    { values: [1, 2, 3, 4, 5] },
                  )}
                </Part>
                <Part label={t("atis.part.minuteOnes")}>
                  {digits(
                    time.minuteOnes,
                    (v) =>
                      dispatch({ type: "time", part: "minuteOnes", value: v }),
                    String,
                  )}
                </Part>
              </div>
            </div>
          </>
        );
      case "arrival":
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {(local.arrivals ?? []).map((a) => (
              <Chip
                key={a.letter}
                active={valueOf(field) === a.letter}
                onClick={() =>
                  dispatch({ type: "set", field, value: a.letter })
                }
              >
                {a.letter}
              </Chip>
            ))}
            {manual(field)}
          </div>
        );
      case "approach":
        return (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              {APPROACH_OPTIONS.map((a) => (
                <Chip
                  key={a}
                  active={approachBase === a}
                  onClick={() => dispatch({ type: "approach", value: a })}
                >
                  {a === "VISUAL" ? t("atis.visual") : a}
                </Chip>
              ))}
              {manual(field)}
            </div>
            {variants.length > 0 && (
              <Part label={t("atis.part.variant", { base: approachBase })}>
                {variants.map((v) => (
                  <Chip
                    key={v}
                    active={atisValue(pad, "approach").split(" ")[1] === v}
                    onClick={() =>
                      dispatch({ type: "approachVariant", value: v })
                    }
                  >
                    {v}
                  </Chip>
                ))}
              </Part>
            )}
          </>
        );
      case "runway": {
        const arrivalRunway = local.arrivals?.find(
          (a) => a.letter === atisValue(pad, "arrival"),
        )?.runway;
        const current = (pad.values.runway as string | undefined) ?? "";
        return (
          <>
            <div className="flex flex-wrap gap-1.5">
              {arrivalRunway && preset("runway", `RWY ${arrivalRunway}`)}
              {(airport?.runways ?? []).map((r) => (
                <Chip
                  key={r.designator}
                  active={current === `RWY ${r.designator}`}
                  onClick={() =>
                    dispatch({
                      type: "set",
                      field,
                      value: `RWY ${r.designator}`,
                    })
                  }
                >
                  RWY {r.designator}
                </Chip>
              ))}
              <Chip
                active={rcr.enabled}
                onClick={() => dispatch({ type: "rcrToggle" })}
              >
                RCR
              </Chip>
            </div>
            {rcr.enabled && (
              <div className="grid gap-2 rounded-xl border p-2">
                <strong className="text-xs">
                  RCR {rcrValue(rcr).slice(4)}
                </strong>
                {([0, 1, 2] as const).map((i) => (
                  <Part key={i} label={t(`atis.part.rcr${i}`)}>
                    {digits(
                      rcr.parts[i],
                      (v) => dispatch({ type: "rcr", index: i, value: v }),
                      String,
                      {
                        values: [0, 1, 2, 3, 4, 5, 6],
                      },
                    )}
                  </Part>
                ))}
              </div>
            )}
          </>
        );
      }
      case "transition":
        return (
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={pad.transition.addHundred}
              onClick={() =>
                dispatch({ type: "transition", part: "addHundred" })
              }
            >
              100
            </Chip>
            {digits(
              pad.transition.tens,
              (v) => dispatch({ type: "transition", part: "tens", value: v }),
              x10,
              {
                values: [0, ...DIGITS],
              },
            )}
            <Chip
              active={pad.transition.five}
              onClick={() => dispatch({ type: "transition", part: "five" })}
            >
              5
            </Chip>
          </div>
        );
      case "wind": {
        const part = (
          p: WindDigit,
          label: (n: number) => string,
          opts?: Parameters<typeof digits>[3],
        ) =>
          digits(
            wind[p],
            (v) => dispatch({ type: "wind", part: p, value: v }),
            label,
            opts,
          );
        const tensCap = (h: string) => (n: number) => h === "3" && n > 6;
        return (
          <>
            <div className="flex flex-wrap gap-1.5">
              {preset("wind")}
              <Chip
                active={wind.mode === "calm"}
                onClick={() => dispatch({ type: "windMode", value: "calm" })}
              >
                CALM
              </Chip>
              <Chip
                active={wind.mode === "vrb"}
                onClick={() => dispatch({ type: "windMode", value: "vrb" })}
              >
                VRB
              </Chip>
            </div>
            {wind.mode !== "vrb" && (
              <div className="grid gap-2 rounded-xl border p-2">
                <span className="text-xs font-semibold uppercase">
                  {t("atis.part.direction")}
                </span>
                <Part label={t("atis.part.dirHundreds")}>
                  {part("directionHundreds", x100, { values: [1, 2, 3] })}
                </Part>
                <Part label={t("atis.part.dirTens")}>
                  {part("directionTens", x10, {
                    disabled: tensCap(wind.directionHundreds),
                  })}
                </Part>
              </div>
            )}
            <div className="grid gap-2 rounded-xl border p-2">
              <span className="text-xs font-semibold uppercase">
                {t("atis.part.speed")}
              </span>
              <Part label={t("atis.part.speedTens")}>
                {part("speedTens", x10)}
              </Part>
              <Part label={t("atis.part.speedOnes")}>
                {part("speedOnes", String)}
              </Part>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {wind.mode === "numeric" && (
                <Chip
                  active={wind.varying}
                  onClick={() =>
                    dispatch({ type: "windToggle", value: "varying" })
                  }
                >
                  {t("atis.varying")}
                </Chip>
              )}
              {wind.mode !== "calm" && (
                <Chip
                  active={wind.gust}
                  onClick={() =>
                    dispatch({ type: "windToggle", value: "gust" })
                  }
                >
                  {t("atis.gusts")}
                </Chip>
              )}
            </div>
            {wind.varying && wind.mode === "numeric" && (
              <div className="grid gap-2 rounded-xl border p-2">
                <span className="text-xs font-semibold uppercase">
                  {t("atis.varying")}
                </span>
                <Part label={t("atis.part.fromHundreds")}>
                  {part("varyingFromHundreds", x100, { values: [1, 2, 3] })}
                </Part>
                <Part label={t("atis.part.fromTens")}>
                  {part("varyingFromTens", x10, {
                    disabled: tensCap(wind.varyingFromHundreds),
                  })}
                </Part>
                <Part label={t("atis.part.toHundreds")}>
                  {part("varyingToHundreds", x100, { values: [1, 2, 3] })}
                </Part>
                <Part label={t("atis.part.toTens")}>
                  {part("varyingToTens", x10, {
                    disabled: tensCap(wind.varyingToHundreds),
                  })}
                </Part>
              </div>
            )}
            {wind.gust && wind.mode !== "calm" && (
              <div className="grid gap-2 rounded-xl border p-2">
                <span className="text-xs font-semibold uppercase">
                  {t("atis.gusts")}
                </span>
                <Part label={t("atis.part.speedTens")}>
                  {part("gustTens", x10)}
                </Part>
                <Part label={t("atis.part.speedOnes")}>
                  {part("gustOnes", String)}
                </Part>
              </div>
            )}
          </>
        );
      }
      case "visibility":
        return (
          <>
            <div className="flex flex-wrap gap-1.5">
              {preset("visibility")}
              <Chip
                active={visibility.mode === "cavok"}
                onClick={() =>
                  dispatch({ type: "visibilityMode", value: "cavok" })
                }
              >
                CAVOK
              </Chip>
              <Chip
                active={visibility.mode === "max"}
                onClick={() =>
                  dispatch({ type: "visibilityMode", value: "max" })
                }
              >
                9999
              </Chip>
            </div>
            {(["thousands", "hundreds", "tens"] as const).map((p) => (
              <Part key={p} label={t(`atis.part.${p}`)}>
                {digits(
                  visibility[p],
                  (v) => dispatch({ type: "visibility", part: p, value: v }),
                  { thousands: x1000, hundreds: x100, tens: x10 }[p],
                )}
              </Part>
            ))}
            <div>
              <Chip
                active={rvr.enabled}
                onClick={() => dispatch({ type: "rvrToggle" })}
              >
                RVR
              </Chip>
            </div>
            {rvr.enabled && (
              <div className="grid gap-2 rounded-xl border p-2">
                <strong className="text-xs">{rvrValue(rvr)}</strong>
                {([0, 1, 2] as const).map((i) => {
                  const leg = rvr.parts[i];
                  return (
                    <Part key={i} label={t(`atis.part.rcr${i}`)}>
                      <Chip
                        active={leg.thousands === "1"}
                        onClick={() =>
                          dispatch({
                            type: "rvr",
                            index: i,
                            part: "thousands",
                            value: "1",
                          })
                        }
                      >
                        1000
                      </Chip>
                      {digits(
                        leg.hundreds,
                        (v) =>
                          dispatch({
                            type: "rvr",
                            index: i,
                            part: "hundreds",
                            value: v,
                          }),
                        x100,
                        {
                          disabled: (n) => leg.thousands === "1" && n > 5,
                        },
                      )}
                      {digits(
                        leg.tens,
                        (v) =>
                          dispatch({
                            type: "rvr",
                            index: i,
                            part: "tens",
                            value: v,
                          }),
                        x10,
                        {
                          disabled: () =>
                            leg.thousands === "1" && leg.hundreds === "5",
                        },
                      )}
                    </Part>
                  );
                })}
              </div>
            )}
          </>
        );
      case "weather":
        return (
          <div className="flex flex-wrap gap-1.5">
            {preset("weather")}
            {(["-", "+"] as const).map((m) => (
              <Chip
                key={m}
                active={weather.modifier === m}
                onClick={() => dispatch({ type: "weatherModifier", value: m })}
              >
                {m}
              </Chip>
            ))}
            {WEATHER_OPTIONS.map((w) => (
              <Chip
                key={w}
                active={weather.phenomena.includes(w)}
                onClick={() => dispatch({ type: "weather", value: w })}
              >
                {w}
              </Chip>
            ))}
          </div>
        );
      case "clouds":
        return (
          <>
            <div className="flex flex-wrap gap-1.5">
              {preset("clouds")}
              {CLOUD_TYPES.map((c) => (
                <Chip
                  key={c}
                  active={clouds.expanded.includes(c)}
                  onClick={() => dispatch({ type: "cloudType", value: c })}
                >
                  {c}
                </Chip>
              ))}
            </div>
            {clouds.expanded.map((c) => (
              <div key={c} className="grid gap-2 rounded-xl border p-2">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-xs">
                    {t("atis.layer", { type: c })}{" "}
                    {cloudToken(c, clouds.layers[c]) || "--"}
                  </strong>
                  <Chip
                    onClick={() => dispatch({ type: "cloudClear", layer: c })}
                  >
                    {t("atis.clear")}
                  </Chip>
                </div>
                <Part label={t("atis.part.thousands")}>
                  {digits(
                    clouds.layers[c].thousands,
                    (v) =>
                      dispatch({
                        type: "cloud",
                        layer: c,
                        part: "thousands",
                        value: v,
                      }),
                    x1000,
                  )}
                </Part>
                <Part label={t("atis.part.hundreds")}>
                  {digits(
                    clouds.layers[c].hundreds,
                    (v) =>
                      dispatch({
                        type: "cloud",
                        layer: c,
                        part: "hundreds",
                        value: v,
                      }),
                    x100,
                  )}
                </Part>
              </div>
            ))}
          </>
        );
      case "temperature":
      case "dewPoint": {
        const key = field === "temperature" ? "temp" : "dew";
        const sel = pad[key];
        return (
          <>
            <div className="flex flex-wrap gap-1.5">
              {preset(field)}
              <Chip
                active={sel.negative}
                label={t("atis.minus")}
                onClick={() => dispatch({ type: "sign", field: key })}
              >
                −
              </Chip>
            </div>
            <Part label={t("atis.part.tens")}>
              {digits(
                sel.tens,
                (v) =>
                  dispatch({
                    type: "temp",
                    field: key,
                    part: "tens",
                    value: v,
                  }),
                x10,
              )}
            </Part>
            <Part label={t("atis.part.ones")}>
              {digits(
                sel.ones,
                (v) =>
                  dispatch({
                    type: "temp",
                    field: key,
                    part: "ones",
                    value: v,
                  }),
                String,
              )}
            </Part>
          </>
        );
      }
      case "qnh":
        return (
          <>
            {preset("qnh")}
            <Part label={t("atis.part.hundreds")}>
              {digits(
                qnh.base,
                (v) => dispatch({ type: "qnh", part: "base", value: v }),
                String,
                { values: [900, 1000] },
              )}
            </Part>
            <Part label={t("atis.part.tens")}>
              {digits(
                qnh.tens,
                (v) => dispatch({ type: "qnh", part: "tens", value: v }),
                x10,
              )}
            </Part>
            <Part label={t("atis.part.ones")}>
              {digits(
                qnh.ones,
                (v) => dispatch({ type: "qnh", part: "ones", value: v }),
                String,
              )}
            </Part>
          </>
        );
      case "clearance":
        return (
          <div className="flex flex-wrap gap-1.5">
            {(["DELIVERY", "GROUND", "TOWER"] as const).map((via) => (
              <Chip
                key={via}
                active={valueOf(field) === `AVAILABLE VIA ${via}`}
                onClick={() =>
                  dispatch({
                    type: "set",
                    field,
                    value: `AVAILABLE VIA ${via}`,
                  })
                }
              >
                {t(`atis.clearance.${via}`)}
              </Chip>
            ))}
          </div>
        );
      case "specialInstructions": {
        const app = frequencies.find(
          (f) => f.service === "zblizanie" || f.service === "radar",
        );
        const options = [
          ...(app ? [`AFTER DEPARTURE CONTACT APP ${app.frequencyMhz}`] : []),
          "BIRDS ACTIVITY",
          "ULC ACTIVITY",
        ];
        const list =
          (pad.values.specialInstructions as string[] | undefined) ?? [];
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {options.map((o) => (
              <Chip
                key={o}
                active={list.includes(o)}
                onClick={() => dispatch({ type: "toggle", field, value: o })}
              >
                {o}
              </Chip>
            ))}
            {manual(field)}
          </div>
        );
      }
      case "remarks":
        return manual(field);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[min(64rem,calc(100vw-1rem))] overflow-y-auto">
        <DialogTitle>{t("atis.title")}</DialogTitle>
        <DialogDescription>{t("atis.subtitle")}</DialogDescription>
        <section className="grid gap-2" aria-label={t("atis.board")}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-primary text-xs font-semibold tracking-[0.08em] uppercase">
              {t("atis.board")}
            </h3>
            <span className="text-muted-foreground text-xs">
              {t("atis.boardHelp")}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {fields.map((field) => {
              const value = valueOf(field);
              const done = !!pad.checked[field];
              return (
                <button
                  key={field}
                  type="button"
                  aria-pressed={done}
                  data-testid={`atis-tile-${field}`}
                  onClick={() => dispatch({ type: "check", field })}
                  className={cn(
                    "grid gap-0.5 rounded-2xl border px-3 py-2 text-left",
                    field === "information" &&
                      "border-transparent bg-[linear-gradient(135deg,rgba(118,242,164,0.9),rgba(93,193,255,0.75))] text-[#06101b]",
                    !value && field !== "information" && "opacity-70",
                    done && "ring-ok ring-2",
                  )}
                >
                  <span className="text-[0.65rem] font-semibold tracking-[0.08em] uppercase opacity-80">
                    {t(`atis.field.${field}`)}
                  </span>
                  <strong className={cn("text-base", done && "line-through")}>
                    {value || "--"}
                  </strong>
                  <span className="text-[0.65rem] tracking-[0.06em] uppercase opacity-70">
                    {t(`atis.meta.${field}`)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <div className="grid gap-3">
          {fields.map((field) => (
            <section
              key={field}
              data-atis-card={field}
              aria-label={t(`atis.field.${field}`)}
              className="grid scroll-mt-2 gap-2 rounded-2xl border p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold tracking-[0.08em] uppercase">
                    {t(`atis.field.${field}`)}
                  </h4>
                  <span className="text-muted-foreground font-mono text-xs">
                    {field === "visibility"
                      ? visibilityValue(pad.visibility) || "--"
                      : valueOf(field) || "--"}
                  </span>
                </div>
                {field !== "location" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive/50"
                    onClick={() => dispatch({ type: "clear", field })}
                  >
                    {t("atis.clear")}
                  </Button>
                )}
              </div>
              {control(field)}
            </section>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">{t("atis.help")}</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status" className="text-sm">
            {status}
          </p>
          <Button
            variant="outline"
            className="border-destructive/50 text-destructive"
            onClick={() => {
              store({ type: "reset" });
              setStatus(t("atis.status.reset"));
            }}
          >
            {t("atis.clearAll")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
