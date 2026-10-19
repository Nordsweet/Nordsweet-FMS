"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { api } from "~/api";
import { Button } from "~/components/ui/button";
import {
  INSPIRATION_INTERESTS,
  INSPIRATION_KINDS,
  type InspirationFilters,
  filterRoutes,
  filterSpots,
  flightMinutes,
  inspirationPoint,
  routeToPlan,
  routeTrip,
  spotTrip,
} from "~/domain/inspiration";
import { type MessageKey } from "~/i18n/messages";
import { useT } from "~/i18n/use-t";
import { MapSelect } from "~/features/map/map-select";
import { useFlight } from "~/stores/flight";
import { useInspiration } from "~/stores/inspiration";
import { useSettings } from "~/stores/settings";

import { RouteCard, SpotCard } from "./inspire-card";

const DISTANCES = [50, 100, 200, 400];
const MINUTES = [30, 60, 90, 120];
const ANY = "any";

const noFilters: InspirationFilters = {
  maxDistanceNm: null,
  maxMinutes: null,
  interests: [],
  kinds: [],
  favoritesOnly: false,
};

const toggled = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

function Chips({
  label,
  values,
  prefix,
  selected,
  onToggle,
}: {
  label: string;
  values: readonly string[];
  prefix: string;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const t = useT();
  return (
    <div className="grid gap-1.5" role="group" aria-label={label}>
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={selected.includes(value) ? "default" : "outline"}
            aria-pressed={selected.includes(value)}
            onClick={() => onToggle(value)}
          >
            {t(`${prefix}.${value}` as MessageKey)}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function InspirePage() {
  const t = useT();
  const language = useSettings((s) => s.language);
  const homeIcao = useSettings((s) => s.homeAirportIcao);
  const flight = useFlight((s) => s.flight);
  const update = useFlight((s) => s.update);
  const { favorites, toggleFavorite } = useInspiration();
  const [filters, setFilters] = useState(noFilters);
  const [added, setAdded] = useState(false);

  const ideas = useQuery(
    api.inspiration.ideas.queryOptions({ lang: language }),
  );
  const home = useQuery({
    ...api.airports.get.queryOptions({ code: homeIcao.trim() }),
    enabled: !flight.departure && homeIcao.trim() !== "",
  });
  const origin = flight.departure ?? home.data ?? null;
  const originName = flight.departure?.ident ?? home.data?.ident ?? "";
  const cruiseKt = flight.cruiseTasKt;

  const spots = filterSpots(
    ideas.data?.spots ?? [],
    filters,
    origin,
    cruiseKt,
    favorites,
  );
  const routes = filterRoutes(
    ideas.data?.routes ?? [],
    filters,
    origin,
    cruiseKt,
    favorites,
  );
  const minutesFor = (nm: number | null) =>
    nm === null ? null : flightMinutes(nm, cruiseKt);

  // The planner keeps one route: replacing it is a decision, not a side effect.
  const setDestination = (
    spot: NonNullable<typeof ideas.data>["spots"][number],
  ) => {
    if (
      flight.destination &&
      !window.confirm(t("inspire.confirmDestination", { name: spot.name }))
    )
      return;
    update({
      destination: inspirationPoint(spot),
      star: null,
      approach: null,
    });
    setAdded(true);
  };
  const addRoute = (
    route: NonNullable<typeof ideas.data>["routes"][number],
  ) => {
    const hasPlan =
      flight.routeText.trim() !== "" ||
      flight.departure !== null ||
      flight.destination !== null ||
      flight.waypoints.length > 0;
    if (hasPlan && !window.confirm(t("inspire.confirmRoute"))) return;
    update({
      ...routeToPlan(route.stops),
      routeText: "",
      sid: null,
      star: null,
      approach: null,
    });
    setAdded(true);
  };

  const limitSelect = (
    label: MessageKey,
    values: number[],
    unit: "inspire.upToNm" | "inspire.upToMin",
    value: number | null,
    set: (value: number | null) => void,
  ) => (
    <MapSelect
      label={t(label)}
      value={value === null ? ANY : String(value)}
      options={[
        { value: ANY, label: `${t(label)}: ${t("inspire.any")}` },
        ...values.map((n) => ({
          value: String(n),
          label: `${t(label)}: ${t(unit, { n })}`,
        })),
      ]}
      onChange={(v) => set(v === ANY ? null : Number(v))}
    />
  );

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4">
      <h1 className="text-xl font-semibold">{t("inspire.title")}</h1>
      <p className="text-muted-foreground text-sm" role="note">
        {t("inspire.disclaimer")}
      </p>

      <section aria-label={t("inspire.filters")} className="grid gap-3">
        {origin ? (
          <p className="text-muted-foreground text-xs">
            {t("inspire.from", { place: originName })}{" "}
            {t("inspire.estimate", { kt: cruiseKt })}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            {t("inspire.noOrigin")}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {limitSelect(
            "inspire.distance",
            DISTANCES,
            "inspire.upToNm",
            filters.maxDistanceNm,
            (maxDistanceNm) => setFilters({ ...filters, maxDistanceNm }),
          )}
          {limitSelect(
            "inspire.time",
            MINUTES,
            "inspire.upToMin",
            filters.maxMinutes,
            (maxMinutes) => setFilters({ ...filters, maxMinutes }),
          )}
          <Button
            size="sm"
            variant={filters.favoritesOnly ? "default" : "outline"}
            aria-pressed={filters.favoritesOnly}
            onClick={() =>
              setFilters({ ...filters, favoritesOnly: !filters.favoritesOnly })
            }
          >
            {t("inspire.favoritesOnly")}
          </Button>
        </div>
        <Chips
          label={t("inspire.kinds")}
          values={INSPIRATION_KINDS}
          prefix="inspire.kind"
          selected={filters.kinds}
          onToggle={(v) =>
            setFilters({ ...filters, kinds: toggled(filters.kinds, v) })
          }
        />
        <Chips
          label={t("inspire.interests")}
          values={INSPIRATION_INTERESTS}
          prefix="inspire.interest"
          selected={filters.interests}
          onToggle={(v) =>
            setFilters({
              ...filters,
              interests: toggled(filters.interests, v),
            })
          }
        />
      </section>

      {added && (
        <p
          role="status"
          className="flex flex-wrap items-center gap-2 text-sm font-medium"
        >
          {t("inspire.added")}
          <Button asChild size="sm" variant="outline">
            <Link href="/">{t("inspire.openPlanner")}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/map">{t("inspire.openMap")}</Link>
          </Button>
        </p>
      )}

      {ideas.isPending && <p>{t("inspire.loading")}</p>}
      {ideas.isError && (
        <p className="text-destructive">{t("inspire.error")}</p>
      )}
      {ideas.data && ideas.data.sources.wikipedia !== "ok" && (
        <p className="text-muted-foreground text-xs">
          {t("inspire.photosMissing")}
        </p>
      )}
      {ideas.data && spots.length + routes.length === 0 && (
        <p>{t("inspire.empty")}</p>
      )}

      {routes.length > 0 && (
        <section aria-label={t("inspire.routes")} className="grid gap-3">
          <h2 className="font-medium">{t("inspire.routes")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {routes.map((route) => {
              const trip = origin ? routeTrip(route, origin) : null;
              return (
                <RouteCard
                  key={route.id}
                  route={route}
                  trip={trip}
                  minutes={minutesFor(trip)}
                  favorite={favorites.includes(route.id)}
                  onToggleFavorite={() => toggleFavorite(route.id)}
                  onAdd={() => addRoute(route)}
                />
              );
            })}
          </div>
        </section>
      )}
      {spots.length > 0 && (
        <section aria-label={t("inspire.places")} className="grid gap-3">
          <h2 className="font-medium">{t("inspire.places")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spots.map((spot) => {
              const trip = spotTrip(spot, origin);
              return (
                <SpotCard
                  key={spot.id}
                  spot={spot}
                  trip={trip}
                  minutes={minutesFor(trip)}
                  favorite={favorites.includes(spot.id)}
                  onToggleFavorite={() => toggleFavorite(spot.id)}
                  onDestination={() => setDestination(spot)}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
