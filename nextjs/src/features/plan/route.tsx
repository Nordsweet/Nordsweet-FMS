"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, X } from "lucide-react";

import { api } from "~/api";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { routeKey } from "~/data/flight";
import { midpoint } from "~/domain/geo";
import { useT } from "~/i18n/use-t";
import { useSettings } from "~/stores/settings";
import { useFlight } from "~/stores/flight";

import { NumberField, Section } from "./fields";
import { PointSearch } from "./point-search";
import { usePlan } from "./use-plan";

export function AircraftSection() {
  const t = useT();
  const { flight, aircraftList } = usePlan();
  const update = useFlight((s) => s.update);
  const pilotWeightKg = useSettings((s) => s.pilotWeightKg);

  return (
    <Section title={t("plan.aircraft.title")}>
      <div className="grid gap-1.5">
        <Label htmlFor="aircraft">{t("plan.aircraft.select")}</Label>
        <Select
          value={flight.aircraftId ?? ""}
          onValueChange={(id) => {
            const aircraft = aircraftList.find((a) => a.id === id);
            const wb = aircraft?.weightBalance;
            // New aircraft: start from its POH/W&B defaults, pilot weight from settings.
            update({
              aircraftId: id,
              stationsKg: Object.fromEntries(
                (wb?.stations ?? []).map((s) => [
                  s.id,
                  s.id === "pilot" && pilotWeightKg
                    ? pilotWeightKg
                    : s.defaultKg,
                ]),
              ),
              fuel: {
                ...flight.fuel,
                blockL: wb?.fuel.defaultL ?? flight.fuel.blockL,
              },
            });
          }}
        >
          <SelectTrigger id="aircraft" className="w-full">
            <SelectValue placeholder={t("plan.aircraft.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {aircraftList.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.displayName}
                {a.registration ? ` (${a.registration})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Section>
  );
}

export function RouteSection() {
  const t = useT();
  const flight = useFlight((s) => s.flight);
  const update = useFlight((s) => s.update);
  const waypoints = flight.waypoints;
  const move = (from: number, to: number) => {
    const next = [...waypoints];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    update({ waypoints: next });
  };

  return (
    <Section title={t("plan.route.title")}>
      <div className="grid gap-4 sm:grid-cols-3">
        <PointSearch
          label={t("plan.route.departure")}
          value={flight.departure}
          onSelect={(departure) => update({ departure })}
        />
        <PointSearch
          label={t("plan.route.destination")}
          value={flight.destination}
          onSelect={(destination) => update({ destination })}
        />
        <PointSearch
          label={t("plan.route.alternate")}
          value={flight.alternate}
          onSelect={(alternate) => update({ alternate })}
        />
      </div>
      <PointSearch
        label={t("plan.route.addWaypoint")}
        includeWaypoints
        onSelect={(point) =>
          point && update({ waypoints: [...waypoints, point] })
        }
      />
      {waypoints.length > 0 && (
        <ol className="grid gap-1" aria-label={t("plan.route.waypoints")}>
          {waypoints.map((p, i) => (
            <li
              key={`${p.ident}-${i}`}
              className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
            >
              <span className="text-muted-foreground w-6 text-right">
                {i + 1}.
              </span>
              <span className="flex-1 font-mono">{p.ident}</span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t("plan.route.moveUp")}
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                <ArrowUp />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t("plan.route.moveDown")}
                disabled={i === waypoints.length - 1}
                onClick={() => move(i, i + 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t("plan.route.remove")}
                onClick={() =>
                  update({ waypoints: waypoints.filter((_, j) => j !== i) })
                }
              >
                <X />
              </Button>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

export function CruiseSection() {
  const t = useT();
  const flight = useFlight((s) => s.flight);
  const update = useFlight((s) => s.update);
  const { route, legWinds } = usePlan();
  const winds = useMutation(api.weather.windsAloft.mutationOptions());
  const fetchWinds = async () => {
    const legs = route.slice(1).map((to, i) => midpoint(route[i]!, to));
    const result = await winds.mutateAsync({
      points: legs,
      altitudeFt: flight.cruiseAltitudeFt,
    });
    update({ legWinds: { routeKey: routeKey(flight), ...result } });
  };
  return (
    <Section title={t("plan.cruise.title")}>
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField
          label={t("plan.cruise.altitude")}
          unit="ft"
          min={0}
          step={500}
          value={flight.cruiseAltitudeFt}
          onChange={(cruiseAltitudeFt) => update({ cruiseAltitudeFt })}
        />
        <NumberField
          label={t("plan.cruise.tas")}
          unit="kt"
          min={1}
          value={flight.cruiseTasKt}
          onChange={(cruiseTasKt) => update({ cruiseTasKt })}
        />
        <NumberField
          label={t("plan.cruise.fuelFlow")}
          unit="L/h"
          min={1}
          value={flight.fuelFlowLph}
          onChange={(fuelFlowLph) => update({ fuelFlowLph })}
        />
        <NumberField
          label={t("plan.cruise.windDirection")}
          unit="°T"
          min={0}
          value={flight.wind.directionDeg}
          onChange={(directionDeg) =>
            update({
              wind: { ...flight.wind, directionDeg: directionDeg % 360 },
            })
          }
        />
        <NumberField
          label={t("plan.cruise.windSpeed")}
          unit="kt"
          min={0}
          value={flight.wind.speedKt}
          onChange={(speedKt) => update({ wind: { ...flight.wind, speedKt } })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button
          variant="outline"
          size="sm"
          disabled={route.length < 2 || winds.isPending}
          onClick={() => void fetchWinds().catch(() => undefined)}
        >
          {t("plan.cruise.forecastWinds")}
        </Button>
        {legWinds && (
          <>
            <span className="text-muted-foreground" data-testid="winds-aloft">
              {t("plan.cruise.forecastWindsInUse", {
                level: legWinds.levelHpa,
                time: legWinds.validAt.slice(11, 16),
              })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update({ legWinds: null })}
            >
              {t("plan.cruise.manualWind")}
            </Button>
          </>
        )}
        {winds.isError && (
          <span className="text-destructive">
            {t("plan.cruise.forecastWindsError")}
          </span>
        )}
      </div>
    </Section>
  );
}
