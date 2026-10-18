"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "~/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useT } from "~/i18n/use-t";
import {
  useMapSettings,
  mapLayers,
  trafficNetworks,
  type LayerId,
} from "~/stores/map";
import { useFlight } from "~/stores/flight";
import { useInFlight } from "~/stores/inflight";
import { usePlan } from "~/features/plan/use-plan";
import { useGps } from "~/features/fly/use-gps";
import { useTurnPerformance } from "~/features/fly/use-turn-performance";
import { MapSelect } from "./map-select";
import { PreparationPlanner } from "./preparation-planner";
import { MapView } from "./map-view";

const networkLabels = {
  "adsb.lol": "adsb.lol",
  "adsb.fi": "adsb.fi",
  opensky: "OpenSky",
  ogn: "OGN",
} as const satisfies Record<(typeof trafficNetworks)[number], string>;

/** `embedded`: the in-flight background map (legacy `?embed=1`): full-bleed, tools behind Layers. */
export function MapWorkspace({ embedded = false }: { embedded?: boolean }) {
  const t = useT(),
    settings = useMapSettings(),
    flight = useFlight((s) => s.flight),
    update = useFlight((s) => s.update),
    navigation = useInFlight();
  const { route } = usePlan();
  const { fix, error: gpsError } = useGps(
    settings.gpsEnabled || navigation.startedAt !== null,
  );
  const turns = useTurnPerformance(navigation.startedAt ? fix : null);
  const client = useQueryClient();
  const terrainCache = useMutation(api.terrain.prepare.mutationOptions());
  const imported = useMutation(api.map.importAirspace.mutationOptions());
  const [notice, setNotice] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(!embedded);
  const [toolsContainer, setToolsContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const label = (id: LayerId) =>
    id === "route" || id === "navaids"
      ? t(`maptools.layer.${id}`)
      : t(`map.layer.${id}`);
  const displayLabel = (id: LayerId) =>
    id === "vfr"
      ? "VFR"
      : id === "ifr"
        ? "IFR"
        : id === "navaids"
          ? "Navaids"
          : id === "traffic"
            ? t("maplegacy.traffic")
            : id === "airspace"
              ? t("maplegacy.airspace")
              : label(id);
  async function importFile(file: File | undefined, kind: "gpx" | "airspace") {
    if (!file) return;
    try {
      const text = await file.text();
      if (kind === "gpx") {
        const points = await api.map.importGpx.call(text);
        update({
          departure: points[0]!,
          destination: points.length > 1 ? points.at(-1)! : null,
          waypoints: points.slice(1, -1),
          routeText: "",
          sid: null,
          star: null,
          approach: null,
        });
        setNotice(t("maptools.imported", { count: points.length }));
      } else {
        const zones = await imported.mutateAsync(text);
        await client.invalidateQueries({ queryKey: ["map.importedAirspace"] });
        setNotice(t("maptools.imported", { count: zones.length }));
      }
    } catch {
      setNotice(t("maptools.importError"));
    }
  }
  return (
    <div
      className={
        embedded
          ? "legacy-map-workspace embedded absolute inset-0"
          : "legacy-map-workspace -m-4 flex min-h-96 flex-1 flex-col"
      }
    >
      {
        <Button
          size="sm"
          variant={toolsOpen ? "default" : "outline"}
          aria-expanded={toolsOpen}
          className="legacy-layers-button absolute z-20"
          onClick={() => setToolsOpen(!toolsOpen)}
        >
          {t("map.layers")}
        </Button>
      }
      <div
        hidden={!toolsOpen}
        className={
          embedded
            ? "legacy-map-tools absolute z-20 flex flex-wrap items-center gap-2 overflow-y-auto"
            : "legacy-map-tools flex flex-wrap items-center gap-2"
        }
      >
        <h1 className="legacy-map-tools-title">{t("maplegacy.title")}</h1>
        <div className="legacy-tool-section legacy-route-tools">
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const value = data.get("route");
              const routeText = typeof value === "string" ? value : "";
              const tokens = routeText
                .trim()
                .toUpperCase()
                .split(/\s+/)
                .filter(Boolean);
              const [departure, destination] = await Promise.all([
                api.airports.get.call({ code: tokens[0] ?? "" }),
                api.airports.get.call({ code: tokens.at(-1) ?? "" }),
              ]);
              update({
                routeText,
                ...(departure && destination
                  ? {
                      departure: {
                        ident: departure.ident,
                        lat: departure.lat,
                        lon: departure.lon,
                      },
                      destination: {
                        ident: destination.ident,
                        lat: destination.lat,
                        lon: destination.lon,
                      },
                      sid: null,
                      star: null,
                      approach: null,
                    }
                  : {}),
              });
            }}
          >
            <Input
              aria-label={t("maptools.route")}
              name="route"
              defaultValue={flight.routeText}
              key={flight.routeText}
            />
            <Button size="sm" type="submit">
              {t("maptools.build")}
            </Button>
          </form>
        </div>
        <div className="legacy-tool-section legacy-upload-tools">
          <Label>
            {t("maptools.importGpx")}
            <input
              type="file"
              accept=".gpx"
              className="max-w-44"
              onChange={(e) => void importFile(e.target.files?.[0], "gpx")}
            />
          </Label>
          <Label>
            {t("maptools.importAirspace")}
            <input
              type="file"
              accept=".txt,.air,.openair,.json"
              className="max-w-44"
              onChange={(e) => void importFile(e.target.files?.[0], "airspace")}
            />
          </Label>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await api.map.saveAirspace.call([]);
              await client.invalidateQueries({
                queryKey: ["map.importedAirspace"],
              });
            }}
          >
            {t("maptools.clearImported")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                const points = await api.navpoints.refresh.call(undefined);
                client.setQueryData(
                  api.navpoints.list.queryOptions(undefined).queryKey,
                  points,
                );
                await client.invalidateQueries({
                  queryKey: ["airspace.around"],
                });
                setNotice(t("maptools.imported", { count: points.length }));
              } catch {
                setNotice(t("maptools.noData"));
              }
            }}
          >
            {t("maptools.refresh")}
          </Button>
        </div>
        <div className="legacy-tool-section legacy-basemap-tools">
          <Label>
            <input
              type="checkbox"
              checked={settings.terrain3d}
              onChange={(e) => settings.update({ terrain3d: e.target.checked })}
            />
            {t("terrain.3d")}
          </Label>
          <Button
            size="sm"
            variant="outline"
            disabled={terrainCache.isPending}
            onClick={async () => {
              const points = route.length ? route : fix ? [fix] : [];
              if (!points.length) {
                setNotice(t("terrain.noRoute"));
                return;
              }
              try {
                const result = await terrainCache.mutateAsync(points);
                setNotice(
                  t("terrain.cached", {
                    count: result.count,
                    missing: result.missing,
                  }) + (result.limited ? " · " + t("terrain.limited") : ""),
                );
              } catch {
                setNotice(t("terrain.missing"));
              }
            }}
          >
            {t("terrain.prepare")}
          </Button>
          <a
            href="/terrain-attribution.html"
            target="_blank"
            rel="noreferrer"
            className="text-xs underline"
          >
            {t("terrain.attribution")}
          </a>

          <MapSelect
            label={t("map.basemap")}
            value={settings.basemap}
            options={[
              { value: "osm", label: "OpenStreetMap" },
              { value: "night", label: t("map.basemapNight") },
              { value: "fjord", label: t("map.basemapFjord") },
              { value: "dark-matter", label: t("map.basemapDarkMatter") },
              { value: "dark", label: t("maplegacy.black") },
            ]}
            onChange={(basemap) => settings.update({ basemap })}
          />
        </div>
        <div className="legacy-tool-section legacy-layer-tools">
          <MapSelect
            label={t("map.plan")}
            value={settings.plan}
            options={[
              { value: "current", label: t("map.planCurrent") },
              { value: "next", label: t("map.planNext") },
              { value: "none", label: t("maptools.none") },
            ]}
            onChange={(plan) => settings.update({ plan })}
          />
          {mapLayers.map((id) => (
            <Label key={id}>
              <input
                type="checkbox"
                aria-label={label(id)}
                checked={settings.layers[id]}
                onChange={(e) =>
                  settings.update({
                    layers: { ...settings.layers, [id]: e.target.checked },
                  })
                }
              />
              {displayLabel(id)}
            </Label>
          ))}
          {settings.layers.traffic &&
            trafficNetworks.map((id) => (
              <Label key={id}>
                <input
                  type="checkbox"
                  aria-label={networkLabels[id]}
                  checked={settings.trafficSources.includes(id)}
                  onChange={(e) =>
                    settings.update({
                      trafficSources: trafficNetworks.filter((n) =>
                        n === id
                          ? e.target.checked
                          : settings.trafficSources.includes(n),
                      ),
                    })
                  }
                />
                {networkLabels[id]}
              </Label>
            ))}
        </div>
        <div className="legacy-tool-section legacy-navigation-tools">
          <Label>
            <input
              type="checkbox"
              checked={settings.labels}
              onChange={(e) => settings.update({ labels: e.target.checked })}
            />
            {t("maptools.labels")}
          </Label>
          <Label>
            <input
              type="checkbox"
              checked={settings.trackUp}
              onChange={(e) => settings.update({ trackUp: e.target.checked })}
            />
            {t("maptools.trackUp")}
          </Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              settings.follow(false);
              settings.request("fit");
            }}
          >
            {t("maptools.fit")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label={t("maplegacy.zoomIn")}
            onClick={() => settings.request("zoomIn")}
          >
            +
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label={t("maplegacy.zoomOut")}
            onClick={() => settings.request("zoomOut")}
          >
            −
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              settings.follow(false);
              settings.request("reset");
            }}
          >
            {t("maptools.reset")}
          </Button>
          <Button
            size="sm"
            aria-pressed={settings.gpsEnabled}
            variant={settings.gpsEnabled ? "default" : "outline"}
            onClick={() => settings.setGps(!settings.gpsEnabled)}
          >
            {t("maptools.gps")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!settings.gpsEnabled}
            onClick={() => settings.follow(true)}
          >
            {t("maptools.center")}
          </Button>
          {embedded && (
            <Button
              size="sm"
              disabled={!navigation.startedAt && route.length < 2}
              onClick={() =>
                navigation.startedAt
                  ? navigation.end()
                  : (settings.setGps(true),
                    navigation.start(route, flight.trafficPattern))
              }
            >
              {t(navigation.startedAt ? "maptools.end" : "maptools.start")}
            </Button>
          )}
          {navigation.route[0]?.ident === "DCT" && navigation.startedAt && (
            <Button
              size="sm"
              variant="outline"
              disabled={!fix || !!gpsError}
              onClick={() => {
                if (fix) navigation.resumeRoute(route, fix, turns);
              }}
            >
              {t("maptools.cancelDirect")}
            </Button>
          )}
        </div>{" "}
        {notice && <span role="status">{notice}</span>}
        <div className="legacy-map-inventory" ref={setToolsContainer} />
      </div>
      <div
        className={
          embedded
            ? "absolute inset-0"
            : "grid flex-1 lg:grid-cols-[21rem_minmax(0,1fr)]"
        }
      >
        {!embedded && <PreparationPlanner />}
        <div
          className={
            embedded ? "absolute inset-0" : "relative min-h-112 min-w-0"
          }
        >
          <MapView
            embedded={embedded}
            basemap={settings.basemap}
            layers={settings.layers}
            plan={settings.plan}
            overlay={!embedded || toolsOpen}
            toolsContainer={toolsContainer}
          />
        </div>
      </div>
    </div>
  );
}
