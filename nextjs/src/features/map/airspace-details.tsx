import { type AirspaceFeature } from "~/api/aviation/schemas";
import { zoneRadioRows } from "~/domain/map-radio";
import { airspaceAltitudeFt } from "~/domain/map-navigation";
import { useT } from "~/i18n/use-t";

export function AirspaceDetails({
  zones,
  plannedFt,
  currentFt,
  plannedFtByZone,
}: {
  zones: AirspaceFeature["properties"][];
  plannedFt: number;
  currentFt: number | null;
  plannedFtByZone?: number[];
}) {
  const t = useT();
  const maximum = Math.max(
    1000,
    plannedFt,
    currentFt ?? 0,
    ...zones
      .map((zone) => airspaceAltitudeFt(zone.upper) ?? 18000)
      .filter(Number.isFinite),
  );
  const y = (feet: number) => 210 - (feet / maximum) * 190;
  return (
    <section className="grid gap-2">
      <strong>{t("maptools.profile")}</strong>
      <svg
        viewBox="0 0 280 230"
        role="img"
        aria-label={t("maptools.profile")}
        className="w-full"
      >
        {zones.map((zone, index) => {
          const bottom = airspaceAltitudeFt(zone.lower) ?? 0,
            top = Math.min(maximum, airspaceAltitudeFt(zone.upper) ?? 18000);
          const x = 30 + (index * 220) / Math.max(zones.length, 1);
          return (
            <g key={index}>
              <rect
                x={x}
                y={y(top)}
                width={Math.min(36, 200 / Math.max(zones.length, 1))}
                height={Math.max(2, y(bottom) - y(top))}
                fill={zone.active_now ? "#ef4444" : "#3b82f6"}
                opacity={0.6}
              />
              <line
                x1={x}
                x2={x + Math.min(36, 200 / Math.max(zones.length, 1))}
                y1={y(plannedFtByZone?.[index] ?? plannedFt)}
                y2={y(plannedFtByZone?.[index] ?? plannedFt)}
                stroke="#06b6d4"
                strokeWidth="3"
              />
              <text x={x} y={225} fontSize={9} fill="currentColor">
                {index + 1}
              </text>
            </g>
          );
        })}
        <line
          x1="20"
          x2="265"
          y1={y(plannedFt)}
          y2={y(plannedFt)}
          stroke="#06b6d4"
          strokeWidth="2"
        />
        {currentFt !== null && (
          <line
            x1="20"
            x2="265"
            y1={y(currentFt)}
            y2={y(currentFt)}
            stroke="#ef4444"
            strokeWidth="2"
          />
        )}
      </svg>
      <p className="text-xs">
        {t("maptools.planned")}: {plannedFt} ft · {t("maptools.current")}:{" "}
        {currentFt ?? "—"} ft
      </p>
      {zones.map((zone, index) => (
        <div key={index} className="grid gap-1 border-t pt-2 text-xs">
          <strong>
            {index + 1}. {zone.name}
          </strong>
          <span>
            {t("map.class")} {zone.class} · {zone.lower} – {zone.upper}
          </span>
          {zoneRadioRows(zone).map((frequency, index) => (
            <div key={index}>
              {frequency.serviceId.toUpperCase()} · {frequency.callsign} ·{" "}
              {frequency.frequencyMhz} {frequency.sector}
            </div>
          ))}
          {zone.active_now && (
            <span className="text-destructive">{t("map.activeNow")}</span>
          )}
          {!zone.activations.length && <span>{t("map.notBooked")}</span>}
          {zone.activations.map((a, i) => (
            <div key={i}>
              {a.starts_at.slice(11, 16)}–{a.ends_at.slice(11, 16)}Z · {a.lower}
              –{a.upper} · {a.unit} · {a.remarks}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
