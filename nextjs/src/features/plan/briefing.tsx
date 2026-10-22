"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "~/api";
import { Button } from "~/components/ui/button";
import { type FlightPoint } from "~/data/flight";
import { reliableAtis } from "~/domain/atis-consensus";
import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";
import { useAtis } from "~/stores/atis";
import { useSettings } from "~/stores/settings";
import { useFlight } from "~/stores/flight";
import { AtisPadDialog } from "./atis-pad";
import { Section, fmt } from "./fields";
import { useBriefing } from "./weather";
import { RequestAtisCall } from "./atis-call";

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

/** Weather alone: parallel METAR/TAF and ATIS/D-ATIS queries, independent of charts/NOTAM. */
export function AirportBriefing({
  role,
  point,
  onInsertPirep,
  showAtis = true,
}: {
  role: "departure" | "destination" | "alternate" | "selected";
  point: FlightPoint;
  onInsertPirep?: () => void;
  showAtis?: boolean;
}) {
  const t = useT();
  const autoscroll = useSettings((s) => s.atisAutoscroll);
  const { station, briefing } = useBriefing(point);
  const data = briefing.data;
  const [atisOpen, setAtisOpen] = useState(false);
  const openAtis = useAtis((s) => s.open);
  const insertPirep = onInsertPirep && (
    <div>
      <Button size="sm" variant="outline" onClick={onInsertPirep}>
        {t("maptools.insertPirep")}
      </Button>
    </div>
  );
  return (
    <div className="grid gap-2" data-testid={`wx-${role}`}>
      <h3 className="font-medium">
        {role === "selected" ? t("maptools.weather") : t(`plan.route.${role}`)}{" "}
        — {point.ident}
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
      {showAtis && (
        <div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              openAtis(point.ident);
              setAtisOpen(true);
            }}
          >
            {t("atis.insert")}
          </Button>
        </div>
      )}
      {showAtis && /^[A-Z]{4}$/.test(point.ident) && (
        <RequestAtisCall icao={point.ident} />
      )}
      {atisOpen && (
        <AtisPadDialog point={point} open onOpenChange={setAtisOpen} />
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
          {insertPirep}
          {data.atis.filter(reliableAtis).map((atis, i) => (
            <details
              key={atis.id ?? i}
              className="grid gap-1"
              onToggle={(e) => {
                if (autoscroll && e.currentTarget.open)
                  e.currentTarget.scrollIntoView({
                    block: "nearest",
                    behavior: "smooth",
                  });
              }}
            >
              <summary className="cursor-pointer text-sm">
                <span className="font-medium">
                  ATIS / D-ATIS {t(`plan.wx.atis.${atis.kind}`)} {atis.letter}
                </span>{" "}
                {atis.source === "telephone-atis" && (
                  <span className="text-muted-foreground text-xs">
                    {t("atisCall.source")}{" "}
                  </span>
                )}
                {atis.source === "community" && (
                  <span className="text-ok text-xs">
                    {t("atisConsensus.trusted", {
                      count: atis.confirmation_count,
                    })}{" "}
                  </span>
                )}
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
        </>
      )}
      {(!station || briefing.isPending || !data) && insertPirep}
    </div>
  );
}

/** NOTAM is loaded only when its own panel is opened. */
export function AirportNotams({ icao }: { icao: string }) {
  const t = useT();
  const query = useQuery(api.notams.byAirport.queryOptions({ icao }));
  return (
    <section className="grid gap-2" aria-label={`NOTAM — ${icao}`}>
      <h3 className="font-medium">NOTAM — {icao}</h3>
      {query.isPending ? (
        <p>{t("plan.wx.loading")}</p>
      ) : !query.data ? (
        <p>{t("plan.wx.unavailable")}</p>
      ) : query.data.notams.length ? (
        <ul className="grid gap-2">
          {query.data.notams.map((n) => (
            <li key={n.id} className="text-xs">
              <strong>
                {n.number ?? n.id} ·{" "}
                {n.starts_at?.slice(0, 16).replace("T", " ") ?? "?"} –{" "}
                {n.ends_at?.slice(0, 16).replace("T", " ") ?? "PERM"}
              </strong>
              <div>{n.summary ?? n.text}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p>{t("plan.wx.none")}</p>
      )}
    </section>
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
