"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "~/api";
import { type FlightPoint } from "~/data/flight";
import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";
import { useFlight } from "~/stores/flight";

import { Section, fmt } from "./fields";
import { useBriefing } from "./weather";

function Age({ minutes, stale }: { minutes: number | null; stale: boolean }) {
  const t = useT();
  return (
    <span
      className={cn(
        "text-xs",
        stale ? "text-destructive font-medium" : "text-muted-foreground",
      )}
    >
      {minutes === null
        ? t("plan.wx.ageUnknown")
        : t("plan.wx.age", { minutes: fmt(minutes) })}
      {stale && ` · ${t("plan.wx.stale")}`}
    </span>
  );
}

function AirportBriefing({
  role,
  point,
}: {
  role: "departure" | "destination" | "alternate";
  point: FlightPoint;
}) {
  const t = useT();
  const { station, briefing } = useBriefing(point);
  const charts = useQuery(
    api.charts.byAirport.queryOptions({ airport: point.ident }),
  );
  const data = briefing.data;
  const notamSource = data?.sources.notamify;

  return (
    <div className="grid gap-2" data-testid={`wx-${role}`}>
      <h3 className="font-medium">
        {t(`plan.route.${role}`)} — {point.ident}
        {station && station.icao !== point.ident && (
          <span className="text-muted-foreground font-normal">
            {" "}
            ·{" "}
            {t("plan.wx.from", {
              icao: station.icao,
              distance: fmt(station.distanceNm),
            })}
          </span>
        )}
      </h3>
      {charts.data && charts.data.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <span className="font-medium">{t("plan.wx.charts")}:</span>
          {charts.data.map((c) => (
            <a
              key={c.src}
              href={c.src}
              target="_blank"
              rel="noreferrer"
              className="underline pointer-coarse:py-2"
            >
              {c.title}
            </a>
          ))}
        </div>
      )}
      {!station ? (
        <p className="text-muted-foreground text-sm">
          {t("plan.wx.noStation")}
        </p>
      ) : briefing.isPending ? (
        <p className="text-muted-foreground text-sm">{t("plan.wx.loading")}</p>
      ) : !data ? (
        <p className="text-destructive text-sm">{t("plan.wx.unavailable")}</p>
      ) : (
        <>
          <div className="grid gap-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-medium">METAR</span>
              {data.metar && (
                <Age
                  minutes={data.metar.age_minutes}
                  stale={data.metar.stale}
                />
              )}
              {data.metar && data.metar.status !== "confirmed" && (
                <span
                  className={cn(
                    "text-xs",
                    data.metar.status === "conflict"
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {t(`plan.wx.status.${data.metar.status}`)}
                </span>
              )}
            </div>
            <pre className="bg-muted rounded-md p-2 text-xs whitespace-pre-wrap">
              {data.metar?.raw ?? t("plan.wx.none")}
            </pre>
          </div>
          <div className="grid gap-1">
            <span className="text-sm font-medium">TAF</span>
            <pre className="bg-muted rounded-md p-2 text-xs whitespace-pre-wrap">
              {data.taf ?? t("plan.wx.none")}
            </pre>
          </div>
          {data.atis.map((atis, i) => (
            <details key={i} className="grid gap-1">
              <summary className="cursor-pointer text-sm">
                <span className="font-medium">
                  ATIS {t(`plan.wx.atis.${atis.kind}`)} {atis.letter}
                </span>{" "}
                <Age minutes={atis.age_minutes} stale={atis.stale} />
                {atis.qnh_matches_metar === false && (
                  <span className="text-destructive text-xs">
                    {" "}
                    · {t("plan.wx.qnhMismatch")}
                  </span>
                )}
              </summary>
              <pre className="bg-muted mt-1 rounded-md p-2 text-xs whitespace-pre-wrap">
                {atis.text}
              </pre>
            </details>
          ))}
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              NOTAM (
              {notamSource === "ok"
                ? data.notams.length
                : t("plan.wx.unavailableShort")}
              )
            </summary>
            <ul className="mt-1 grid gap-2">
              {data.notams.map((n) => (
                <li key={n.id} className="text-xs">
                  <div className="font-medium">
                    {n.number ?? n.id} ·{" "}
                    {n.starts_at?.slice(0, 16).replace("T", " ") ?? "?"} –{" "}
                    {n.ends_at?.slice(0, 16).replace("T", " ") ?? "PERM"}
                  </div>
                  <div>{n.summary ?? n.text}</div>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

export function BriefingSection() {
  const t = useT();
  const flight = useFlight((s) => s.flight);
  const points = (["departure", "destination", "alternate"] as const)
    .map((role) => ({ role, point: flight[role] }))
    .filter(
      (x): x is { role: typeof x.role; point: FlightPoint } => x.point !== null,
    );
  return (
    <Section title={t("plan.wx.title")}>
      {points.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t("plan.navlog.empty")}
        </p>
      ) : (
        points.map(({ role, point }) => (
          <AirportBriefing key={role} role={role} point={point} />
        ))
      )}
      <p className="text-muted-foreground text-xs">{t("plan.wx.source")}</p>
    </Section>
  );
}
