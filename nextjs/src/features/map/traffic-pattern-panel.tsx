import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/api";
import { type Airport } from "~/data/schemas";
import {
  trafficPatternSchema,
  type TrafficPattern,
} from "~/data/traffic-pattern";
import {
  patternRunwayGeometry,
  trafficPatternGeometry,
} from "~/domain/traffic-pattern";
import { patternPlanningPerformance } from "~/domain/pattern-performance";
import { patternRunwaySuggestion } from "~/domain/traffic-pattern-runway";
import {
  departureRunwayChoice,
  isDeparturePatternTarget,
} from "~/domain/departure-pattern";
import { useInFlight } from "~/stores/inflight";
import { atisValue } from "~/domain/atis-pad";
import { useAtis } from "~/stores/atis";
import { useFlight } from "~/stores/flight";
import { useT } from "~/i18n/use-t";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { MapSelect } from "./map-select";

/** All edits stay in the dashed map preview until explicit acceptance. */
export function TrafficPatternPanel({
  airport,
  departureTargetAltitudeFt,
  preview,
  accept,
  cancel,
  remove,
}: {
  airport: Airport;
  departureTargetAltitudeFt: number;
  preview: (pattern: TrafficPattern | null) => void;
  accept: (pattern: TrafficPattern) => void;
  cancel: () => void;
  remove: () => void;
}) {
  const t = useT();
  const flight = useFlight((s) => s.flight);
  const navigation = useInFlight();
  const leaving = isDeparturePatternTarget(flight, navigation, airport.ident);
  const existing = leaving ? flight.departurePattern : flight.trafficPattern;
  const ground = useQuery({
    ...api.ground.byAirport.queryOptions({ airport: airport.ident }),
    enabled: leaving,
  }).data;
  const departureChoice = leaving
    ? departureRunwayChoice(flight, airport, ground)
    : null;
  const aircraft = useQuery(
    api.aircraft.list.queryOptions(undefined),
  ).data?.find((a) => a.id === flight.aircraftId);
  const speedKias = aircraft?.patternSpeedKt ?? existing?.speedKias ?? 100;
  const saved = existing?.airport.ident === airport.ident ? existing : null;
  const [id] = useState(() => crypto.randomUUID());
  const [runwayId, setRunway] = useState(
    saved && !saved.runwayAutomatic ? saved.runway.designator : "auto",
  );
  const [direction, setDirection] = useState<TrafficPattern["direction"]>(
    saved?.direction ?? "left",
  );
  const [join, setJoin] = useState<TrafficPattern["join"]>(
    saved?.join ?? "downwind",
  );
  const [altitude, setAltitude] = useState(
    String(saved?.altitudeAalFt ?? airport.trafficPatternAltitudeAalFt ?? 1000),
  );
  const [finalType, setFinalType] = useState(
    saved?.join === "final"
      ? [2, 4, 8].includes(saved.finalDistanceNm)
        ? String(saved.finalDistanceNm)
        : "custom"
      : "4",
  );
  const [custom, setCustom] = useState(String(saved?.finalDistanceNm ?? 4));
  const atis = useAtis();
  const data = useQuery({
    ...api.weather.briefing.queryOptions({ icao: airport.ident }),
    enabled: airport.isIcao && /^[A-Z]{4}$/.test(airport.ident),
  }).data;
  const suggestion = patternRunwaySuggestion(
    airport,
    atis.airport === airport.ident ? atisValue(atis.pad, "runway") : "",
    data?.atis ?? [],
    data?.metar?.stale ? null : (data?.metar?.raw ?? null),
    atis.airport === airport.ident ? atisValue(atis.pad, "wind") : "",
  );
  const runway =
    airport.runways.find((r) => r.designator === runwayId) ??
    departureChoice?.runway ??
    suggestion.runway;
  const geometry = runway ? patternRunwayGeometry(airport, runway) : null;
  const pattern = (() => {
    if (!runway) return null;
    const geometry = patternRunwayGeometry(airport, runway);
    if (!geometry) return null;
    const parsed = trafficPatternSchema.safeParse({
      id,
      operation: leaving ? "leave" : "join",
      runwayAutomatic: runwayId === "auto",
      airport: { ...airport },
      runway: {
        ...runway,
        threshold: geometry.threshold,
        departureEnd: geometry.departureEnd,
      },
      direction,
      join,
      altitudeAalFt: Number(altitude),
      speedKias,
      turnPerformance: patternPlanningPerformance(
        speedKias,
        airport.elevationFt,
        leaving
          ? Math.max(0, departureTargetAltitudeFt - airport.elevationFt)
          : Number(altitude),
        data?.metar?.stale ? null : (data?.metar?.raw ?? null),
      ),
      finalDistanceNm:
        !leaving && join === "final"
          ? Number(finalType === "custom" ? custom : finalType)
          : 2,
    });
    return parsed.success ? parsed.data : null;
  })();
  const previewJson = pattern ? JSON.stringify(pattern) : null;
  useEffect(() => {
    preview(
      previewJson ? trafficPatternSchema.parse(JSON.parse(previewJson)) : null,
    );
    return () => preview(null);
  }, [previewJson, preview]);
  return (
    <section
      className="grid gap-3 border-t pt-3"
      aria-label={t("pattern.title")}
    >
      <strong>{t("pattern.title")}</strong>
      <Label>{t("pattern.runway")}</Label>
      <MapSelect
        label={t("pattern.runway")}
        value={runwayId}
        onChange={setRunway}
        options={[
          {
            value: "auto",
            label: t("pattern.auto", {
              runway:
                (departureChoice?.runway ?? suggestion.runway)?.designator ??
                "—",
              source: t(
                `pattern.source.${departureChoice?.source ?? suggestion.source}`,
              ),
            }),
          },
          ...airport.runways.map((r) => ({
            value: r.designator,
            label: `RWY ${r.designator}`,
          })),
        ]}
      />
      <Label>{t("pattern.direction")}</Label>
      <MapSelect
        label={t("pattern.direction")}
        value={direction}
        onChange={setDirection}
        options={[
          { value: "left", label: t("pattern.left") },
          { value: "right", label: t("pattern.right") },
        ]}
      />
      <Label>{t(leaving ? "pattern.leave" : "pattern.join")}</Label>
      <MapSelect
        label={t(leaving ? "pattern.leave" : "pattern.join")}
        value={join}
        onChange={setJoin}
        options={(
          ["overhead", "crosswind", "downwind", "base", "final"] as const
        ).map((value) => ({
          value,
          label: t(
            leaving && value === "final"
              ? "pattern.straightOut"
              : `pattern.${value}`,
          ),
        }))}
      />
      {!leaving && join === "final" && (
        <>
          <Label>{t("pattern.finalType")}</Label>
          <MapSelect
            label={t("pattern.finalType")}
            value={finalType}
            onChange={setFinalType}
            options={[
              { value: "8", label: t("pattern.long") },
              { value: "4", label: t("pattern.normal") },
              { value: "2", label: t("pattern.short") },
              { value: "custom", label: t("pattern.custom") },
            ]}
          />
          {finalType === "custom" && (
            <Label>
              {t("pattern.customDistance")}
              <Input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </Label>
          )}
        </>
      )}
      {!leaving && (
        <Label>
          {t("pattern.altitude")}
          <Input
            type="number"
            min="1"
            max="10000"
            step="100"
            value={altitude}
            onChange={(e) => setAltitude(e.target.value)}
          />
        </Label>
      )}
      {!leaving && pattern && (
        <small>
          {t("pattern.amsl", {
            altitude: pattern.airport.elevationFt + pattern.altitudeAalFt,
          })}
        </small>
      )}
      {leaving && <small>{t("pattern.departureClimb")}</small>}
      {pattern && (
        <small data-testid="pattern-dimensions">
          {t("pattern.speed", { speed: speedKias })}
          {" · "}
          {t("pattern.offset", {
            distance:
              trafficPatternGeometry(pattern).lateralOffsetNm.toFixed(2),
          })}
        </small>
      )}
      {!geometry && <p role="status">{t("pattern.noRunway")}</p>}
      {geometry?.estimated && <small>{t("pattern.estimated")}</small>}
      <Button
        disabled={!pattern}
        onClick={() => {
          if (pattern) accept(pattern);
        }}
      >
        {t("pattern.accept")}
      </Button>
      <Button variant="outline" onClick={cancel}>
        {t("pattern.cancel")}
      </Button>
      {saved && (
        <Button variant="outline" onClick={remove}>
          {t("pattern.remove")}
        </Button>
      )}
    </section>
  );
}
