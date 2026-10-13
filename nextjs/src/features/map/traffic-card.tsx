import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trafficCallsign } from "~/domain/traffic-history";
import { api } from "~/api";
import { type TrafficAircraft } from "~/api/aviation/schemas";
import { Button } from "~/components/ui/button";
import { useT } from "~/i18n/use-t";

export function TrafficCard({
  aircraft,
  historyCount,
}: {
  aircraft: TrafficAircraft;
  historyCount: number;
}) {
  const t = useT(),
    callsign = trafficCallsign(aircraft.callsign);
  const destination = useQuery({
    ...api.traffic.destination.queryOptions({ callsign }),
    enabled: /^[A-Z0-9]{2,10}$/.test(callsign),
    retry: false,
  });
  const [name, setName] = useState(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const source = aircraft.sources.some((value) => /flarm|ogn/i.test(value))
    ? "Flarm"
    : "ADS-B";
  const fields = [
    [t("maptools.source"), source],
    [
      t("maptools.track"),
      aircraft.track_deg === null ? "—" : `${Math.round(aircraft.track_deg)}°T`,
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
    [t("maptools.verticalSpeed"), `${aircraft.vertical_rate_fpm ?? "—"} fpm`],
    [t("maptools.type"), aircraft.type ?? "—"],
    [t("maptools.registration"), aircraft.registration ?? "—"],
  ];
  return (
    <div className="grid gap-2" data-testid="traffic-card">
      <strong>{callsign || (aircraft.registration ?? aircraft.hex)}</strong>
      <span className="text-muted-foreground text-xs">
        {[aircraft.registration, aircraft.hex].filter(Boolean).join(" · ")}
      </span>
      <div className="grid grid-cols-2 gap-2">
        {fields.map(([label, value]) => (
          <div key={label} className="rounded border p-2">
            <span className="text-muted-foreground text-xs">{label}</span>
            <strong className="block text-xs">{value}</strong>
          </div>
        ))}
        <Button
          className="h-auto min-h-14 flex-col items-start text-left whitespace-normal"
          variant="outline"
          disabled={!destination.data}
          aria-label={t("maptools.reveal")}
          onClick={() => {
            if (timer.current) clearTimeout(timer.current);
            setName(true);
            timer.current = setTimeout(() => setName(false), 3000);
          }}
        >
          <span className="text-muted-foreground text-xs">
            {t("maptools.destination")}
          </span>
          <strong aria-live="polite">
            {destination.data
              ? name
                ? destination.data.name
                : destination.data.icao
              : "—"}
          </strong>
        </Button>
      </div>
      <span className="text-xs">
        {historyCount >= 2
          ? `${t("maptools.history")}: ${historyCount}`
          : t("maptools.historyUnavailable")}
      </span>
    </div>
  );
}
