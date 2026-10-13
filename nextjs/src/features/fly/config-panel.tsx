"use client";

import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cruisePerformance } from "~/domain/cruise-performance";
import { type FlightPhase } from "~/domain/flight-phase";
import { settingLabel } from "~/features/plan/route-dialogs";
import { usePlan } from "~/features/plan/use-plan";
import { useT } from "~/i18n/use-t";
import { type MessageKey } from "~/i18n/messages";
import { cruiseModeOf, useInFlight } from "~/stores/inflight";

function ConfigSelect<V extends string>({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string;
  value: V;
  options: [V, string][];
  onChange: (value: V) => void;
  help?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as V)}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, text]) => (
            <SelectItem key={v} value={v}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {help && <p className="text-muted-foreground text-xs">{help}</p>}
    </div>
  );
}

/** Legacy CONFIG: take-off/landing checklist flaps, climb configuration, cruise engine mode. */
export function ConfigPanel({ phase }: { phase: FlightPhase }) {
  const t = useT();
  const { aircraft, flight } = usePlan();
  const config = useInFlight((s) => s.config);
  const configure = useInFlight((s) => s.configure);

  if (phase === "takeoff")
    return (
      <ConfigSelect
        label={t("fly.config.takeoffFlaps")}
        value={config.takeoffFlaps}
        options={[
          ["up", t("fly.config.flapsUp")],
          ["takeoff", t("fly.config.flapsTakeoff")],
        ]}
        onChange={(takeoffFlaps) => configure({ takeoffFlaps })}
        help={t("fly.config.takeoffHelp")}
      />
    );
  if (phase === "landing")
    return (
      <ConfigSelect
        label={t("fly.config.landingFlaps")}
        value={config.landingFlaps}
        options={[
          ["UP", t("fly.config.flapsUp")],
          ["APP", t("fly.config.flapsApproach")],
          ["LDG", t("fly.config.flapsLanding")],
        ]}
        onChange={(landingFlaps) => configure({ landingFlaps })}
        help={t("fly.config.landingHelp")}
      />
    );
  if (phase === "climb") {
    const climb = (patch: Partial<typeof config.climb>) =>
      configure({ climb: { ...config.climb, ...patch } });
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <ConfigSelect
          label={t("fly.emer.flaps")}
          value={config.climb.flaps}
          options={[
            ["up", t("fly.config.flapsUp")],
            ["takeoff", t("fly.config.flapsTakeoff")],
          ]}
          onChange={(flaps) => climb({ flaps })}
        />
        <ConfigSelect
          label={t("fly.config.speedProfile")}
          value={config.climb.profile}
          options={[
            ["vx", "Vx"],
            ["vy", "Vy"],
          ]}
          onChange={(profile) => climb({ profile })}
        />
        {(aircraft?.engineCount ?? 1) > 1 && (
          <ConfigSelect
            label={t("fly.emer.engines")}
            value={config.climb.engines}
            options={[
              ["both", t("fly.config.bothEngines")],
              ["one-inop", t("fly.emer.oneEngineInop")],
            ]}
            onChange={(engines) => climb({ engines })}
          />
        )}
      </div>
    );
  }
  // Cruise: ECO modes, or a manual RPM/MAP built from digit buttons (legacy renderCruiseEnginePanel).
  const mode = cruiseModeOf(config);
  const setting = aircraft?.cruise
    ? cruisePerformance(
        aircraft.cruise,
        flight.cruiseAltitudeFt,
        flight.cruiseOatC,
        0,
        mode,
      )?.setting
    : null;
  const manual = config.cruiseMode === "manual";
  const { rpm, mapInHg } = config.manual;
  const digits = {
    rpmThousands: Math.floor(rpm / 1000),
    rpmHundreds: Math.floor((rpm % 1000) / 100),
    rpmTens: Math.floor((rpm % 100) / 10),
    mapTens: Math.floor(mapInHg / 10),
    mapOnes: Math.floor(mapInHg % 10),
    mapTenths: Math.round((mapInHg * 10) % 10),
  };
  const setDigit = (key: keyof typeof digits, value: number) => {
    const d = { ...digits, [key]: value };
    configure({
      cruiseMode: "manual",
      manual: {
        rpm: d.rpmThousands * 1000 + d.rpmHundreds * 100 + d.rpmTens * 10,
        mapInHg: d.mapTens * 10 + d.mapOnes + d.mapTenths / 10,
      },
    });
  };
  const rows: [keyof typeof digits, string, number[], (v: number) => string][] =
    [
      ["rpmThousands", "fly.config.rpmThousands", [1, 2], String],
      ["rpmHundreds", "fly.config.rpmHundreds", [...Array(10).keys()], String],
      [
        "rpmTens",
        "fly.config.rpmTens",
        [...Array(10).keys()],
        (v) => String(v * 10),
      ],
      ["mapTens", "fly.config.mapTens", [1, 2, 3], (v) => String(v * 10)],
      ["mapOnes", "fly.config.mapOnes", [...Array(10).keys()], String],
      [
        "mapTenths",
        "fly.config.mapTenths",
        [...Array(10).keys()],
        (v) => `.${v}`,
      ],
    ];
  return (
    <div className="grid gap-3">
      <p className="text-sm font-semibold">
        {t("fly.config.engineSetting", {
          setting: setting ? settingLabel(setting) : "n/a",
        })}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground w-28 text-xs uppercase">
          {t("fly.config.mode")}
        </span>
        {(["eco-time", "eco-distance"] as const).map((m) => (
          <Button
            key={m}
            size="sm"
            variant={config.cruiseMode === m ? "default" : "outline"}
            aria-pressed={config.cruiseMode === m}
            onClick={() => configure({ cruiseMode: m })}
          >
            {t(`fly.config.${m}`)}
          </Button>
        ))}
      </div>
      {rows.map(([key, label, values, text]) => (
        <div key={key} className="flex flex-wrap items-center gap-1">
          <span className="text-muted-foreground w-28 text-xs uppercase">
            {t(label as MessageKey)}
          </span>
          {values.map((v) => (
            <Button
              key={v}
              size="sm"
              className="min-w-10 px-2"
              variant={manual && digits[key] === v ? "default" : "outline"}
              aria-pressed={manual && digits[key] === v}
              aria-label={`${t(label as MessageKey)} ${text(v)}`}
              onClick={() => setDigit(key, v)}
            >
              {text(v)}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
