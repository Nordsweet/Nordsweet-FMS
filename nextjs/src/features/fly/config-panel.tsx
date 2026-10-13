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
import { useInFlight } from "~/stores/inflight";

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
  // Cruise. shortcut: no manual RPM/MAP picker yet (legacy also had one); ECO modes only.
  const setting = aircraft?.cruise
    ? cruisePerformance(
        aircraft.cruise,
        flight.cruiseAltitudeFt,
        flight.cruiseOatC,
        0,
        config.cruiseMode,
      )?.setting
    : null;
  return (
    <div className="grid gap-3">
      <p className="text-sm font-semibold">
        {t("fly.config.engineSetting", {
          setting: setting ? settingLabel(setting) : "n/a",
        })}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs uppercase">
          {t("fly.config.mode")}
        </span>
        {(["eco-time", "eco-distance"] as const).map((mode) => (
          <Button
            key={mode}
            size="sm"
            variant={config.cruiseMode === mode ? "default" : "outline"}
            aria-pressed={config.cruiseMode === mode}
            onClick={() => configure({ cruiseMode: mode })}
          >
            {t(`fly.config.${mode}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}
