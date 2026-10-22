"use client";

import Link from "next/link";
import { SearchIcon, Trash2, Ellipsis, ChevronDown } from "lucide-react";
import { useMapSettings } from "~/stores/map";
import { useEffect, useState, useMemo } from "react";

import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  type FlightPhase,
  FLIGHT_PHASES,
  checklistFlaps,
} from "~/domain/flight-phase";
import { magneticVariationDeg, trueToMagneticDeg } from "~/domain/magnetic";
import { navigationProgress } from "~/domain/holding";
import { summarizeTrack } from "~/domain/track";
import { ChecklistsPage } from "~/features/checklists/checklists";
import { fmt, fmtMinutes, NumberField } from "~/features/plan/fields";
import { useCruiseAltitude } from "~/stores/cruise-altitude";
import {
  altitudeRestriction,
  formatRoutePoint,
  pointKey,
} from "~/domain/route-plan";
import { PerformanceSection } from "~/features/plan/performance";
import { usePlan } from "~/features/plan/use-plan";
import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";
import { MapWorkspace } from "~/features/map/map-workspace";
import { useFlight } from "~/stores/flight";
import { sameFlightPoint } from "~/domain/waypoint-insertion";
import type { FplAction } from "~/domain/fpl-actions";
import { useInFlight } from "~/stores/inflight";
import { useEmergency, emergencyScope } from "~/stores/emergency";

import { ChartPanel } from "./chart-panel";
import { CommsPanel } from "./comms-panel";
import { useCommsPlan } from "./use-comms-plan";
import { ConfigPanel } from "./config-panel";
import { EmergencyPanel } from "./emergency-panel";
import { FredaDialog } from "./freda-dialog";
import { GpxReplayDock } from "./gpx-replay";
import { InfoPanel } from "./info-panel";
import { OptionsPanel } from "./options-panel";
import { WxPanel } from "./wx-panel";
import { useGps } from "./use-gps";
import { useTurnPerformance } from "./use-turn-performance";
import { PositionSourcePanel } from "./position-source-panel";
import { FlightStatusBar } from "./flight-status-bar";
import { EngineTimerAssistant } from "./engine-timer-assistant";
import { Debrief } from "./debrief";
import {
  FlightPlanTable,
  FlightPlanCells,
  flightPlanRowClass,
} from "./flight-plan-table";
import { flightPlanProfile } from "~/domain/flight-plan-profile";
import { FplVerticalProfile } from "./fpl-vertical-profile";
import { NotificationBell, NotificationHistory } from "./notification-history";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";

const PHASES = FLIGHT_PHASES;
type Phase = FlightPhase;
type Panel =
  | "emer"
  | "fpl"
  | "comms"
  | "wx"
  | "config"
  | "chart"
  | "rwy"
  | "checklist"
  | "info"
  | "options"
  | "notifications"
  | "position";
/** Legacy rail per phase, in legacy order. */
const RAIL: { id: Panel; phases?: Phase[] }[] = [
  { id: "emer" },
  { id: "fpl" },
  { id: "notifications" },
  { id: "comms" },
  { id: "wx", phases: ["cruise"] },
  { id: "config", phases: ["takeoff", "climb", "cruise", "landing"] },
  {
    id: "chart",
    phases: ["taxiout", "takeoff", "descent", "landing", "taxiin"],
  },
  { id: "rwy", phases: ["takeoff", "landing"] },
  { id: "wx", phases: ["taxiout", "takeoff", "descent", "landing", "taxiin"] },
  { id: "checklist" },
  { id: "info" },
  { id: "options" },
];

function Tile({
  label,
  value,
  alert = false,
  testId,
}: {
  label: string;
  value: string;
  alert?: boolean;
  testId?: string;
}) {
  return (
    <div className={cn("rounded-lg border p-3", alert && "border-destructive")}>
      <div className="text-muted-foreground text-xs uppercase">{label}</div>
      <div
        className={cn(
          "font-mono text-2xl font-semibold tabular-nums sm:text-3xl",
          alert && "text-destructive",
        )}
        data-testid={testId}
      >
        {value}
      </div>
    </div>
  );
}

const deg = (v: number | null) =>
  v === null ? "—" : `${fmt(v).padStart(3, "0")}°`;
const utc = (date: Date) => date.toISOString().slice(11, 16) + "Z";

export function FlyPage() {
  const searchOpen = useMapSettings((state) => state.searchOpen);
  const setSearchOpen = useMapSettings((state) => state.setSearchOpen);
  const t = useT();
  const {
    flight,
    route: planRoute,
    departurePattern,
    aircraft,
    plan,
    routeData,
  } = usePlan();
  const inFlight = useInFlight();
  const flying = inFlight.startedAt !== null;
  const { fix, connectorStatus, error: gpsError } = useGps(true);
  const turns = useTurnPerformance(flying ? fix : null);
  const [now, setNow] = useState(() => Date.now());
  const [debrief, setDebrief] = useState(false);
  const [dismissedDebrief, setDismissedDebrief] = useState<number | null>(null);
  const debriefOpen =
    debrief ||
    (inFlight.debrief?.endedAt != null &&
      inFlight.debrief.endedAt !== dismissedDebrief);
  // shortcut: the phase is picked by hand; legacy also switched it automatically.
  const { phase, setPhase, config } = inFlight;
  const comms = useCommsPlan(phase, fix, now, flying);
  const [panel, setPanel] = useState<Panel | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const progress =
    flying && fix
      ? navigationProgress(
          inFlight.route,
          fix,
          inFlight.activeLeg,
          turns,
          inFlight.holding,
        )
      : null;
  const variation = fix ? magneticVariationDeg(fix) : 0;
  const mag = (trueDeg: number | null) =>
    trueDeg === null ? null : trueToMagneticDeg(trueDeg, variation);
  const gs = fix?.groundSpeedKt ?? null;
  const minutesFor = (nm: number) =>
    gs !== null && gs > 5 ? (nm / gs) * 60 : null;
  const eteNext = progress ? minutesFor(progress.distanceToNextNm) : null;
  const holdingActive =
    !!inFlight.holding && inFlight.holding.phase !== "armed";
  const eteDest =
    progress && !holdingActive
      ? minutesFor(progress.distanceToDestinationNm)
      : null;
  const fredaDue = inFlight.fredaDueAt !== null && now >= inFlight.fredaDueAt;
  const fredaIn =
    inFlight.fredaDueAt !== null
      ? Math.max(0, (inFlight.fredaDueAt - now) / 60000)
      : null;
  const summary = summarizeTrack(inFlight.track);
  const rail = RAIL.filter((r) => !r.phases || r.phases.includes(phase));
  const panelLabel = (id: Panel) =>
    t(
      id === "position"
        ? "connector.title"
        : id === "chart"
          ? phase === "taxiout" || phase === "taxiin"
            ? "fly.panel.taxi"
            : "fly.panel.proc"
          : `fly.panel.${id}`,
    );
  const open =
    panel === "position" || rail.some((r) => r.id === panel) ? panel : null;

  const navigation = (
    <>
      <section
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        aria-label={t("fly.next")}
      >
        <Tile
          label={t("fly.next")}
          value={progress?.next.ident ?? "—"}
          testId="fly-next"
        />
        <Tile
          label={t("fly.distance")}
          value={progress ? `${fmt(progress.distanceToNextNm, 1)} NM` : "—"}
          testId="fly-distance"
        />
        <Tile
          label={t("fly.bearing")}
          value={deg(mag(progress?.bearingToNextDeg ?? null))}
        />
        <Tile
          label={t("fly.dtk")}
          value={deg(mag(progress?.desiredTrackDeg ?? null))}
        />
        <Tile
          label={t("fly.xte")}
          value={
            progress
              ? `${fmt(Math.abs(progress.crossTrackNm), 1)} ${progress.crossTrackNm >= 0 ? "R" : "L"}`
              : "—"
          }
          alert={!!progress && Math.abs(progress.crossTrackNm) > 1}
          testId="fly-xte"
        />
        <Tile label={t("fly.ete")} value={fmtMinutes(eteNext)} />
        <Tile label={t("fly.gs")} value={gs === null ? "—" : `${fmt(gs)} kt`} />
        <Tile label={t("fly.track")} value={deg(mag(fix?.trackDeg ?? null))} />
        <Tile
          label={t("fly.altitude")}
          value={fix?.altitudeFt == null ? "—" : `${fmt(fix.altitudeFt)} ft`}
        />
        <Tile
          label={`${t("fly.destination")} ${inFlight.route.at(-1)?.ident ?? ""}`}
          value={
            progress && !holdingActive
              ? `${fmt(progress.distanceToDestinationNm, 1)} NM`
              : "—"
          }
        />
        <Tile label={t("fly.ete")} value={fmtMinutes(eteDest)} />
        <Tile
          label={t("fly.eta")}
          value={eteDest === null ? "—" : utc(new Date(now + eteDest * 60000))}
        />
      </section>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value=""
          onValueChange={(v) => fix && inFlight.goDirect(Number(v), fix, turns)}
          disabled={!fix}
        >
          <SelectTrigger className="w-48" aria-label={t("fly.directTo")}>
            <SelectValue placeholder={t("fly.directTo")} />
          </SelectTrigger>
          <SelectContent>
            {inFlight.route.map((p, i) =>
              i > 0 ? (
                <SelectItem key={`${p.ident}-${i}`} value={String(i)}>
                  {p.ident}
                </SelectItem>
              ) : null,
            )}
          </SelectContent>
        </Select>
        <Button
          variant={fredaDue ? "destructive" : "outline"}
          onClick={inFlight.openFreda}
          data-testid="freda"
        >
          {fredaDue
            ? t("fly.fredaDue")
            : t("fly.fredaIn", {
                minutes: fredaIn === null ? "—" : fmt(fredaIn),
              })}
        </Button>
        <span className="text-muted-foreground text-xs">
          {t("fly.fredaItems")}
        </span>
      </div>
    </>
  );

  const emergency = useEmergency((s) => s.session);
  const emergencyActive =
    emergency?.scope ===
      emergencyScope(
        flight.id,
        aircraft?.id ?? flight.aircraftId,
        inFlight.startedAt,
        flight.registration,
      ) && emergency.endedAt === null;
  const fplProfile = useMemo(
    () =>
      open === "fpl"
        ? flightPlanProfile(
            inFlight.route,
            plan,
            {
              tasKt: turns.tasKt,
              departureTasKt: turns.departureTasKt,
              windDirectionDeg: turns.windDirectionDeg,
              windSpeedKt: turns.windSpeedKt,
            },
            flight.cruiseAltitudeFt,
          )
        : null,
    [
      open,
      inFlight.route,
      plan,
      turns.tasKt,
      turns.departureTasKt,
      turns.windDirectionDeg,
      turns.windSpeedKt,
      flight.cruiseAltitudeFt,
    ],
  );
  const fplPosition =
    fix &&
    !gpsError &&
    !fix.paused &&
    Math.abs(now - Date.parse(fix.time)) <= 20000
      ? fix
      : null;
  const editFplWaypoint = (index: number, action: FplAction) => {
    const position =
      fplPosition &&
      Math.abs(Date.now() - Date.parse(fplPosition.time)) <= 20000
        ? fplPosition
        : null;
    inFlight.editFplPoint(index, action, position, turns);
  };
  const content: Record<Panel, React.ReactNode> = {
    emer: <EmergencyPanel phase={phase} />,
    fpl:
      fplProfile && inFlight.route.some((p) => p.ident !== "DCT") ? (
        <>
          <div className="shrink-0">
            <NumberField
              label={t("plan.route.tile.cruiseAltitude")}
              unit="ft"
              value={flight.cruiseAltitudeFt}
              min={0}
              step={100}
              onChange={(altitudeFt) =>
                useCruiseAltitude.getState().setAltitude(
                  altitudeFt,
                  (plan?.points ?? [])
                    .filter(
                      (p) =>
                        altitudeRestriction(p) !== null ||
                        p.patternId !== undefined ||
                        p.kind === "airport" ||
                        p.kind === "threshold",
                    )
                    .flatMap((p) => [
                      pointKey(p),
                      formatRoutePoint(p).toUpperCase(),
                    ]),
                  true,
                )
              }
            />
          </div>
          <FlightPlanTable
            actions
            label={t("mapplanner.points")}
            listClassName="max-h-[30dvh]"
          >
            {fplProfile.rows.map(
              (
                { point, routeIndex: index, event, altitudeFt },
                displayIndex,
              ) =>
                point.ident === "DCT" ? null : (
                  <div
                    role="listitem"
                    key={`${index ?? "profile"}-${displayIndex}-${point.ident}`}
                    data-profile-event={event}
                    aria-current={
                      index !== null && index === inFlight.activeLeg + 1
                        ? "step"
                        : undefined
                    }
                    className={flightPlanRowClass(
                      index !== null && index === inFlight.activeLeg + 1,
                      true,
                    )}
                  >
                    <FlightPlanCells
                      point={point}
                      actions
                      previous={fplProfile.rows[displayIndex - 1]?.point}
                      altitudeFt={altitudeFt}
                      selected={
                        index !== null && index === inFlight.activeLeg + 1
                      }
                    />
                    {index !== null && (
                      <div className="absolute top-1 right-2 flex justify-end gap-1 sm:static">
                        <button
                          type="button"
                          aria-label={t("fly.fpl.remove", {
                            point: point.ident,
                          })}
                          className="flex size-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-500/15 focus-visible:ring-2"
                          onClick={() => {
                            const draft = useFlight.getState();
                            const waypointIndex =
                              draft.flight.waypoints.findIndex((p) =>
                                sameFlightPoint(p, point),
                              );
                            if (waypointIndex >= 0)
                              draft.update({
                                waypoints: draft.flight.waypoints.filter(
                                  (_, i) => i !== waypointIndex,
                                ),
                              });
                            inFlight.removeWaypoint(
                              index,
                              fix &&
                                !gpsError &&
                                !fix.paused &&
                                Date.now() - Date.parse(fix.time) <= 20000
                                ? fix
                                : null,
                            );
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={t("fly.fpl.options", {
                                point: point.ident,
                              })}
                              className="flex size-9 items-center justify-center rounded-lg text-white hover:bg-white/10 focus-visible:ring-2"
                            >
                              <Ellipsis className="size-5" aria-hidden="true" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => {
                                useMapSettings.getState().inspectPoint({
                                  ...point,
                                  name: point.ident,
                                  kind: "point",
                                  centerOnly: true,
                                });
                                setPanel(null);
                              }}
                            >
                              {t("fly.fpl.center")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={
                                index <= inFlight.activeLeg ||
                                index === inFlight.route.length - 1 ||
                                (index === inFlight.activeLeg + 1 &&
                                  !fplPosition)
                              }
                              onSelect={() => editFplWaypoint(index, "skip")}
                            >
                              {t("fly.fpl.skip")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={
                                index === inFlight.activeLeg + 1 && !fplPosition
                              }
                              onSelect={() =>
                                editFplWaypoint(index, "set-next")
                              }
                            >
                              {t("fly.fpl.setNext")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => {
                                const airport = routeData?.airport(point.ident);
                                useMapSettings.getState().inspectPoint({
                                  ...point,
                                  name: airport?.name ?? point.ident,
                                  kind: airport ? "airport" : "point",
                                });
                                setPanel(null);
                              }}
                            >
                              {t("fly.fpl.details")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                ),
            )}
          </FlightPlanTable>
          <FplVerticalProfile
            profile={fplProfile}
            activeLeg={inFlight.activeLeg}
            fix={
              fix &&
              !gpsError &&
              !fix.paused &&
              now - Date.parse(fix.time) <= 20000
                ? fix
                : null
            }
          />
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          {t("plan.navlog.empty")}
        </p>
      ),
    config: <ConfigPanel phase={phase} />,
    chart: <ChartPanel phase={phase} />,
    comms: <CommsPanel result={comms} />,
    wx: <WxPanel phase={phase} />,
    rwy: <PerformanceSection />,
    checklist: (
      <ChecklistsPage
        phase={phase}
        expected={(checklist, action) =>
          checklistFlaps(phase, checklist.name, action, config)
        }
      />
    ),
    info: (
      <>
        <InfoPanel phase={phase} />
        <h3 className="text-primary text-xs font-semibold tracking-[0.08em] uppercase">
          {t("fly.info.navigation")}
        </h3>
        {navigation}
      </>
    ),
    options: <OptionsPanel />,
    position: <PositionSourcePanel />,
    notifications: <NotificationHistory />,
  };

  // Legacy flight view: the airspace map full screen, the phase bar on top, the phase's tools on
  // the right; each tool opens its panel beside the rail.
  return (
    <div className="bg-background fixed inset-0 z-40">
      <FlightStatusBar
        fix={fix}
        progress={progress}
        positionOpen={open === "position"}
        positionStatus={t(`connector.${connectorStatus}`)}
        onPositionClick={() => {
          setSearchOpen(false);
          setPanel(open === "position" ? null : "position");
        }}
        phaseControl={
          flying ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  data-testid="flight-phase"
                  aria-pressed="true"
                  className="min-w-36"
                >
                  {t(`fly.phase.${phase}`)}{" "}
                  <ChevronDown className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {PHASES.map((p) => (
                  <DropdownMenuItem key={p} onSelect={() => setPhase(p)}>
                    {t(`fly.phase.${p}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
        endControl={
          flying ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                inFlight.end();
                setPanel(null);
                setDebrief(true);
              }}
            >
              {t("fly.end")}
            </Button>
          ) : null
        }
      />
      <div className="absolute inset-x-0 top-24 bottom-0">
        <MapWorkspace embedded />
        {inFlight.startedAt && !emergencyActive && (
          <EngineTimerAssistant session={inFlight.startedAt} phase={phase} />
        )}
        <div
          className="fly-scrim"
          aria-hidden="true"
          data-open={open !== null}
        />
        {flying && !emergencyActive && <FredaDialog fix={fix} now={now} />}
        {flying && inFlight.replayEnabled && <GpxReplayDock />}
        {!flying && (
          <div className="bg-card/90 absolute top-3 left-1/2 z-30 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 gap-2 overflow-x-auto rounded-3xl border p-2 backdrop-blur">
            <Button variant="outline" className="shrink-0" asChild>
              <Link href="/">{t("nav.plan")}</Link>
            </Button>
            <Button
              className="shrink-0"
              disabled={planRoute.length < 2}
              onClick={() => {
                inFlight.start(
                  planRoute,
                  flight.trafficPattern,
                  departurePattern,
                  aircraft?.type,
                );
                inFlight.setHolding(flight.holding);
                setPhase("taxiout");
                setDebrief(false);
              }}
            >
              {t("fly.start")}
            </Button>
          </div>
        )}

        {flying && (
          <nav
            aria-label={t("fly.title")}
            className="absolute top-[5.15rem] right-3 z-30 grid max-h-[calc(100%-6.15rem)] gap-[0.48rem] overflow-y-auto"
          >
            {rail.map((r) =>
              r.id === "notifications" ? (
                <NotificationBell
                  key={r.id}
                  open={open === r.id}
                  onClick={() => {
                    setSearchOpen(false);
                    setPanel(open === r.id ? null : r.id);
                  }}
                />
              ) : (
                <Button
                  key={r.id}
                  variant={r.id === "emer" ? "destructive" : "outline"}
                  aria-expanded={open === r.id}
                  aria-label={panelLabel(r.id)}
                  className="legacy-flight-tool backdrop-blur"
                  onClick={() => {
                    setSearchOpen(false);
                    setPanel(open === r.id ? null : r.id);
                  }}
                >
                  {/* Legacy wraps the long label onto two lines: CHECK / LIST. */}
                  {r.id === "checklist" ? (
                    <span>
                      {panelLabel(r.id).slice(0, 5)}
                      <br />
                      {panelLabel(r.id).slice(5)}
                    </span>
                  ) : (
                    panelLabel(r.id)
                  )}
                </Button>
              ),
            )}
            <Button
              aria-label={t("mapsearch.title")}
              title={t("mapsearch.title")}
              aria-expanded={searchOpen}
              className="legacy-flight-tool bg-card/90 backdrop-blur"
              variant="outline"
              onClick={() => {
                setPanel(null);
                setSearchOpen(!searchOpen);
              }}
            >
              <SearchIcon className="size-6 text-white" />
            </Button>
          </nav>
        )}

        {(open ?? (!flying && (debriefOpen || planRoute.length < 2))) && (
          <section
            role="dialog"
            aria-label={open ? panelLabel(open) : t("fly.title")}
            className="fly-popover"
            data-panel={open ?? "none"}
            data-debrief={!open && debriefOpen ? "true" : undefined}
            style={
              {
                "--top":
                  open === "position"
                    ? "0.75rem"
                    : `calc(5.15rem + ${rail.findIndex((r) => r.id === open)} * 3.93rem)`,
                ...(open === "fpl"
                  ? { width: "min(42rem, calc(100vw - 6.5rem))" }
                  : {}),
              } as React.CSSProperties
            }
          >
            {open ? (
              <>
                {open !== "config" && open !== "rwy" && (
                  <div className="fly-popover-head">
                    <div>
                      <h2>{panelLabel(open)}</h2>
                      {open === "wx" && (
                        <p className="text-muted-foreground text-xs">
                          {t("fly.wx.subtitle")}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPanel(null)}
                    >
                      {t("map.close")}
                    </Button>
                  </div>
                )}
                {content[open]}
              </>
            ) : debriefOpen ? (
              <Debrief
                key={inFlight.debrief?.endedAt ?? "legacy"}
                summary={summary}
                track={inFlight.track}
                name={flight.name}
                onClose={() => {
                  setDebrief(false);
                  setDismissedDebrief(inFlight.debrief?.endedAt ?? null);
                }}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                {t("plan.navlog.empty")}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
