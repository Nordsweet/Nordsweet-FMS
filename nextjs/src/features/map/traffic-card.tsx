import { trafficCallsign } from "~/domain/traffic-history";
import { type TrafficAircraft } from "~/api/aviation/schemas";
import { useT } from "~/i18n/use-t";
import { formatHeading } from "~/domain/format";

export function TrafficCard({
  aircraft,
  historyCount,
}: {
  aircraft: TrafficAircraft;
  historyCount: number;
}) {
  const t = useT(),
    callsign = trafficCallsign(aircraft.callsign);
  const source = aircraft.sources.some((value) => /flarm|ogn/i.test(value))
    ? "Flarm"
    : "ADS-B";
  const fields = [
    [t("maptools.source"), source],
    [
      t("maplegacy.currentTrack"),
      aircraft.track_deg === null
        ? "—"
        : `${formatHeading(aircraft.track_deg)} deg`,
    ],
    [
      t("maptools.groundSpeed"),
      aircraft.ground_speed_kt === null
        ? "—"
        : `${Math.round(aircraft.ground_speed_kt)} kt`,
    ],
    [
      t("maptools.altitude"),
      aircraft.on_ground ? "GND" : `${aircraft.altitude_ft ?? "—"} ft`,
    ],
    [
      t("maptools.verticalSpeed"),
      aircraft.vertical_rate_fpm === null
        ? "--"
        : `${aircraft.vertical_rate_fpm > 0 ? "+" : ""}${Math.round(aircraft.vertical_rate_fpm)} fpm`,
    ],
    [t("maptools.type"), aircraft.type ?? "—"],
  ];
  return (
    <div className="legacy-traffic-card grid gap-2" data-testid="traffic-card">
      <strong>{callsign || (aircraft.registration ?? aircraft.hex)}</strong>
      <span className="text-muted-foreground text-xs">
        {[aircraft.registration, aircraft.hex].filter(Boolean).join(" | ")}
      </span>
      <div className="grid grid-cols-2 gap-2">
        {fields.map(([label, value]) => (
          <div key={label} className="rounded border p-2">
            <span className="text-muted-foreground text-xs">{label}</span>
            <strong className="block text-xs">{value}</strong>
          </div>
        ))}
      </div>
      <span className="text-xs">
        {historyCount >= 2
          ? `${t("maptools.history")}: ${historyCount}`
          : t("maptools.historyUnavailable")}
      </span>
    </div>
  );
}
