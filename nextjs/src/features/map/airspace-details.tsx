import { type AirspaceFeature } from "~/api/aviation/schemas";
import { zoneRadioRows } from "~/domain/map-radio";
import { airspaceAltitudeFt, airspaceKind } from "~/domain/map-navigation";
import { useT } from "~/i18n/use-t";
import { airspacePalette } from "./symbols";

const SERVICE_CODE: Record<string, string> = {
  tower: "TWR",
  zblizanie: "APP",
  radar: "APP",
  fiss: "FIS",
  informacja: "FIS",
  atis: "ATIS",
  ground: "GND",
  delivery: "DEL",
  radio: "RDO",
};

/** Legacy "Strefy w punkcie" inspector: vertical profile and the zones with their services. */
export function AirspaceDetails({
  point,
  zones: unsorted,
  plannedFt,
  currentFt,
  plannedFtByZone,
}: {
  point: { lat: number; lon: number };
  zones: AirspaceFeature["properties"][];
  plannedFt: number;
  currentFt: number | null;
  plannedFtByZone?: number[];
}) {
  const t = useT();
  const lowerFt = (zone: AirspaceFeature["properties"]) =>
    Math.max(0, airspaceAltitudeFt(zone.lower) ?? 0);
  // Lowest floor first, then by name (legacy zonesAtPoint).
  const records = unsorted
    .map((zone, i) => ({
      zone,
      lower: lowerFt(zone),
      upper: airspaceAltitudeFt(zone.upper) ?? 18000,
      plannedFt: plannedFtByZone?.[i] ?? plannedFt,
      color: (
        airspacePalette[airspaceKind(zone.name, zone.class)] ??
        airspacePalette.OTHER!
      ).stroke,
    }))
    .sort(
      (a, b) => a.lower - b.lower || a.zone.name.localeCompare(b.zone.name),
    );

  const ceiling =
    Math.ceil(
      (Math.max(
        3000,
        ...records.flatMap((r) =>
          [r.upper, r.lower, r.plannedFt].filter(Number.isFinite),
        ),
        currentFt ?? 0,
        records.some((r) => !Number.isFinite(r.upper)) ? 18000 : 0,
      ) +
        500) /
        1000,
    ) * 1000;
  const step = Math.max(1000, Math.ceil(ceiling / 4 / 1000) * 1000);
  const top = Math.ceil(ceiling / step) * step;
  const width = Math.max(292, records.length * 60 + 44),
    height = 270;
  const plot = { left: 34, right: width - 8, top: 16, bottom: height - 28 };
  const y = (feet: number) =>
    plot.bottom -
    (Math.max(0, Math.min(top, feet)) / top) * (plot.bottom - plot.top);
  const column = (plot.right - plot.left) / Math.max(1, records.length);
  const meta = [
    `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`,
    `GPS ${currentFt !== null ? `${Math.round(currentFt)} ft` : t("maptools.noAltitude")}`,
    `${t("maptools.plan")} ${plannedFt} ft`,
  ].join(" | ");

  return (
    <section className="legacy-inspector grid gap-2">
      <div className="pr-8">
        <strong className="block">
          {t(records.length ? "maptools.zonesAt" : "maptools.noZonesAt")}
        </strong>
        <span className="text-muted-foreground text-[11px] font-bold">
          {meta}
        </span>
      </div>
      {!records.length ? (
        <p className="text-muted-foreground">{t("maptools.noZonesAtText")}</p>
      ) : (
        <div className="legacy-inspector-body">
          <div className="legacy-inspector-card">
            <div className="legacy-inspector-heading">
              {t("maptools.profile")}
            </div>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={t("maptools.profile")}
              className="w-full"
            >
              {Array.from({ length: top / step + 1 }, (_, i) => (
                <g key={i}>
                  <line
                    x1={plot.left}
                    x2={plot.right}
                    y1={y(i * step)}
                    y2={y(i * step)}
                    stroke="#dfe7ef"
                  />
                  <text
                    x={plot.left - 4}
                    y={y(i * step) + 3}
                    textAnchor="end"
                    fill="#65758a"
                    fontSize={9}
                    fontWeight={700}
                  >
                    {i * step}
                  </text>
                </g>
              ))}
              {records.map((r, i) => {
                const x = plot.left + column * i + 5,
                  w = Math.max(14, column - 10);
                const upper = Number.isFinite(r.upper)
                  ? Math.max(r.lower, Math.min(top, r.upper))
                  : top;
                return (
                  <g key={i}>
                    <title>{`${r.zone.name}: ${r.zone.lower} - ${r.zone.upper}`}</title>
                    <rect
                      x={x}
                      y={y(upper)}
                      width={w}
                      height={Math.max(2, y(r.lower) - y(upper))}
                      rx={3}
                      fill={r.color}
                      fillOpacity={0.38}
                      stroke={r.color}
                      strokeWidth={1.4}
                    />
                    <line
                      x1={x}
                      x2={x + w}
                      y1={y(r.plannedFt)}
                      y2={y(r.plannedFt)}
                      stroke="#0f7898"
                      strokeWidth={2.5}
                      strokeDasharray="5 3"
                    />
                    <text
                      x={x + w / 2}
                      y={Math.min(height - 9, plot.bottom + 15)}
                      textAnchor="middle"
                      fill="#43536a"
                      fontSize={10}
                      fontWeight={900}
                    >
                      {i + 1}
                    </text>
                  </g>
                );
              })}
              {currentFt !== null && (
                <>
                  <line
                    x1={plot.left}
                    x2={plot.right}
                    y1={y(currentFt)}
                    y2={y(currentFt)}
                    stroke="#c4334d"
                    strokeWidth={2.2}
                  />
                  <text
                    x={plot.right - 2}
                    y={y(currentFt) - 4}
                    textAnchor="end"
                    fill="#a51f39"
                    fontSize={9}
                    fontWeight={900}
                  >
                    GPS {Math.round(currentFt)} ft
                  </text>
                </>
              )}
            </svg>
            <div className="legacy-inspector-legend">
              <span>
                <i /> {t("maptools.planned")}
              </span>
              <span>
                <i className="current" /> {t("maptools.current")}
              </span>
            </div>
          </div>
          <div className="legacy-inspector-card">
            <div className="legacy-inspector-heading">
              {t("maptools.zonesServices")}
            </div>
            {records.map((r, i) => (
              <div key={i} className="legacy-inspector-zone">
                <span style={{ background: r.color }} />
                <div className="grid gap-1">
                  <strong>
                    {i + 1}. {r.zone.name}
                  </strong>
                  <span className="text-muted-foreground font-bold">
                    {r.zone.lower} - {r.zone.upper} | {t("maptools.plan")}{" "}
                    {r.plannedFt} ft
                  </span>
                  {zoneRadioRows(r.zone).map((f, j) => (
                    <div key={j} className="legacy-inspector-service">
                      <strong>
                        {SERVICE_CODE[f.serviceId] ??
                          f.serviceId.toUpperCase().slice(0, 6)}
                      </strong>
                      <span>
                        {[f.callsign, f.sector, r.zone.name].find(Boolean)}
                      </span>
                      <b>{f.frequencyMhz}</b>
                    </div>
                  ))}
                  {r.zone.active_now && (
                    <span className="text-destructive">
                      {t("map.activeNow")}
                    </span>
                  )}
                  {r.zone.activations.map((a, j) => (
                    <div key={j}>
                      {a.starts_at.slice(11, 16)}–{a.ends_at.slice(11, 16)}Z ·{" "}
                      {a.lower}–{a.upper} · {a.unit} · {a.remarks}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
