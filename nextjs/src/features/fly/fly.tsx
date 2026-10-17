"use client";

import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { useMapSettings } from "~/stores/map";
import { useEffect, useState } from "react";

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
import { type TrackPoint, summarizeTrack, toGpx } from "~/domain/track";
import { ChecklistsPage } from "~/features/checklists/checklists";
import { fmt, fmtMinutes } from "~/features/plan/fields";
import { PerformanceSection } from "~/features/plan/performance";
import { AirportTaxi } from "~/features/plan/taxi";
import { usePlan } from "~/features/plan/use-plan";
import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";
import { MapWorkspace } from "~/features/map/map-workspace";
import { useInFlight } from "~/stores/inflight";
import { useEmergency, emergencyScope } from "~/stores/emergency";

import { ChartPanel } from "./chart-panel";
import { CommsPanel } from "./comms-panel";
import { CommsChangePopup } from "./comms-change-popup";
import { useCommsPlan } from "./use-comms-plan";
import { ConfigPanel } from "./config-panel";
import { EmergencyPanel } from "./emergency-panel";
import { EventToast } from "./event-toast";
import { FredaDialog } from "./freda-dialog";
import { GpxReplayDock } from "./gpx-replay";
import { InfoPanel } from "./info-panel";
import { OptionsPanel } from "./options-panel";
import { WxPanel } from "./wx-panel";
import { useGps } from "./use-gps";
import { useTurnPerformance } from "./use-turn-performance";

const PHASES = FLIGHT_PHASES;
type Phase = FlightPhase;
type Panel =
  | "emer"
  | "route"
  | "comms"
  | "wx"
  | "config"
  | "chart"
  | "rwy"
  | "checklist"
  | "info"
  | "options";
/** Legacy rail per phase, in legacy order. */
const RAIL: { id: Panel; phases?: Phase[] }[] = [
  { id: "emer" },
  { id: "route", phases: ["taxiout", "taxiin"] },
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
  const { flight, route: planRoute, departurePattern, aircraft } = usePlan();
  const inFlight = useInFlight();
  const flying = inFlight.startedAt !== null;
  const { fix, error } = useGps(true);
  const turns = useTurnPerformance(flying ? fix : null);
  const [now, setNow] = useState(() => Date.now());
  const [debrief, setDebrief] = useState(false);
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
      id === "chart"
        ? phase === "taxiout" || phase === "taxiin"
          ? "fly.panel.taxi"
          : "fly.panel.proc"
        : `fly.panel.${id}`,
    );
  const open = rail.some((r) => r.id === panel) ? panel : null;

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
          onValueChange={(v) => fix && inFlight.goDirect(Number(v), fix)}
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
  const content: Record<Panel, React.ReactNode> = {
    emer: <EmergencyPanel phase={phase} />,
    route: (flying
      ? phase === "taxiin"
        ? flight.destination
        : flight.departure
      : null) && (
      <AirportTaxi
        point={(phase === "taxiin" ? flight.destination : flight.departure)!}
        phase={phase === "taxiin" ? "arrival" : "departure"}
      />
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
  };

  const gpsText = error
    ? t(`fly.gps.${error === "denied" ? "denied" : "unavailable"}`)
    : fix
      ? t("fly.gps.fix", {
          accuracy: fmt(fix.accuracyM),
          time: utc(new Date(fix.time)),
        })
      : t("fly.gps.waiting");
  const chip =
    "bg-card/90 rounded-full border px-3 py-1.5 text-xs backdrop-blur";

  // Legacy flight view: the airspace map full screen, the phase bar on top, the phase's tools on
  // the right; each tool opens its panel beside the rail.
  return (
    <div className="bg-background fixed inset-0 z-40">
      <MapWorkspace embedded />
      <div className="fly-scrim" aria-hidden="true" data-open={open !== null} />
      {flying && <EventToast />}
      {flying && !emergencyActive && (
        <CommsChangePopup phase={phase} estimate={comms.estimate} />
      )}
      {flying && !emergencyActive && <FredaDialog fix={fix} now={now} />}
      {flying && inFlight.replayEnabled && <GpxReplayDock />}
      <div className="bg-card/90 absolute top-3 left-1/2 z-30 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 gap-2 overflow-x-auto rounded-3xl border p-2 backdrop-blur">
        {flying ? (
          <>
            {PHASES.map((p) => (
              <Button
                key={p}
                variant={p === phase ? "default" : "outline"}
                aria-pressed={p === phase}
                className="shrink-0"
                onClick={() => setPhase(p)}
              >
                {t(`fly.phase.${p}`)}
              </Button>
            ))}
            <Button
              variant="outline"
              className="border-primary shrink-0"
              onClick={() => {
                inFlight.end();
                setPanel(null);
                setDebrief(true);
              }}
            >
              {t("fly.end")}
            </Button>
          </>
        ) : (
          <>
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
                );
                inFlight.setHolding(flight.holding);
                setPhase("taxiout");
                setDebrief(false);
              }}
            >
              {t("fly.start")}
            </Button>
          </>
        )}
      </div>

      {flying && (
        <nav
          aria-label={t("fly.title")}
          className="absolute top-[5.15rem] right-3 z-30 grid max-h-[calc(100%-6.15rem)] gap-[0.48rem] overflow-y-auto"
        >
          {rail.map((r) => (
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
          ))}
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

      {(open ?? (!flying && (debrief || planRoute.length < 2))) && (
        <section
          role="dialog"
          aria-label={open ? panelLabel(open) : t("fly.title")}
          className="fly-popover"
          data-panel={open ?? "none"}
          style={
            {
              "--top": `calc(5.15rem + ${rail.findIndex((r) => r.id === open)} * 3.93rem)`,
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
          ) : debrief ? (
            <Debrief
              summary={summary}
              track={inFlight.track}
              name={flight.name}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("plan.navlog.empty")}
            </p>
          )}
        </section>
      )}

      <div className="absolute bottom-8 left-3 z-30 flex max-w-[calc(100%-8rem)] flex-wrap gap-2">
        <span className={chip}>
          {t("fly.routeChip", {
            route: (flying ? inFlight.route : planRoute)
              .map((p) => p.ident)
              .join(" - "),
          })}
        </span>
        <span className={chip}>
          {progress
            ? `${progress.next.ident} ${fmt(progress.distanceToNextNm, 1)} NM`
            : "--"}
        </span>
        <span
          className={cn(chip, error && "text-destructive")}
          data-testid="gps-status"
        >
          {gpsText}
        </span>
      </div>
    </div>
  );
}

function Debrief({
  summary,
  track,
  name,
}: {
  summary: ReturnType<typeof summarizeTrack>;
  track: TrackPoint[];
  name: string;
}) {
  const t = useT();
  return (
    <>
      <h2 className="text-primary font-semibold tracking-[0.08em] uppercase">
        {t("fly.debrief")}
      </h2>
      <p data-testid="debrief" className="text-sm">
        {t("fly.debriefSummary", {
          time: fmtMinutes(summary.minutes),
          distance: fmt(summary.distanceNm, 1),
          altitude:
            summary.maxAltitudeFt === null ? "—" : fmt(summary.maxAltitudeFt),
          points: track.length,
        })}
      </p>
      <div>
        <Button
          variant="outline"
          disabled={track.length === 0}
          onClick={() => {
            const file = name.trim() === "" ? "flight" : name;
            const url = URL.createObjectURL(
              new Blob([toGpx(track, file)], { type: "application/gpx+xml" }),
            );
            Object.assign(document.createElement("a"), {
              href: url,
              download: `${file}.gpx`,
            }).click();
            URL.revokeObjectURL(url);
          }}
        >
          {t("fly.exportGpx")}
        </Button>
      </div>
    </>
  );
}
