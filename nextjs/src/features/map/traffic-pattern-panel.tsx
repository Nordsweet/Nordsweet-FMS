import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/api";
import { type Airport } from "~/data/schemas";
import {
  trafficPatternSchema,
  type TrafficPattern,
} from "~/data/traffic-pattern";
import { patternRunwayGeometry } from "~/domain/traffic-pattern";
import { patternRunwaySuggestion } from "~/domain/traffic-pattern-runway";
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
  preview,
  accept,
  cancel,
  remove,
}: {
  airport: Airport;
  preview: (pattern: TrafficPattern | null) => void;
  accept: (pattern: TrafficPattern) => void;
  cancel: () => void;
  remove: () => void;
}) {
  const t = useT();
  const existing = useFlight((s) => s.flight.trafficPattern);
  const saved = existing?.airport.ident === airport.ident ? existing : null;
  const [id] = useState(() => crypto.randomUUID());
  const [runwayId, setRunway] = useState(saved?.runway.designator ?? "auto");
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
    airport.runways.find((r) => r.designator === runwayId) ?? suggestion.runway;
  const geometry = runway ? patternRunwayGeometry(airport, runway) : null;
  const pattern = (() => {
    if (!runway) return null;
    const geometry = patternRunwayGeometry(airport, runway);
    if (!geometry) return null;
    const parsed = trafficPatternSchema.safeParse({
      id,
      airport: { ...airport },
      runway: {
        ...runway,
        threshold: geometry.threshold,
        departureEnd: geometry.departureEnd,
      },
      direction,
      join,
      altitudeAalFt: Number(altitude),
      finalDistanceNm:
        join === "final"
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
              runway: suggestion.runway?.designator ?? "—",
              source: t(`pattern.source.${suggestion.source}`),
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
      <Label>{t("pattern.join")}</Label>
      <MapSelect
        label={t("pattern.join")}
        value={join}
        onChange={setJoin}
        options={(
          ["overhead", "crosswind", "downwind", "base", "final"] as const
        ).map((value) => ({ value, label: t(`pattern.${value}`) }))}
      />
      {join === "final" && (
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
      {pattern && (
        <small>
          {t("pattern.amsl", {
            altitude: pattern.airport.elevationFt + pattern.altitudeAalFt,
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
