"use client";

import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { type FlightPhase } from "~/domain/flight-phase";
import { parseMetar } from "~/domain/metar";
import { AtisPadDialog } from "~/features/plan/atis-pad";
import { BriefingSection } from "~/features/plan/briefing";
import { NumberField, fmt } from "~/features/plan/fields";
import { usePhasePerformance } from "~/features/plan/performance";
import { usePlan } from "~/features/plan/use-plan";
import { useBriefing } from "~/features/plan/weather";
import { useT } from "~/i18n/use-t";
import { cn } from "~/lib/utils";
import { useAtis } from "~/stores/atis";

const card =
  "grid content-start gap-3 rounded-[22px] border border-[rgba(141,190,255,.16)] bg-[rgba(10,25,44,.96)] p-3.5";
const cardTitle =
  "text-primary text-lg font-extrabold tracking-[0.06em] uppercase";
const chip =
  "size-16 min-h-16 min-w-16 rounded-2xl p-1 text-[0.65rem] font-black tracking-[0.06em]";
const active =
  "border-transparent bg-[linear-gradient(135deg,rgba(122,243,211,.95),rgba(118,242,164,.75))] text-[#04111d]";
const DESTINATION: FlightPhase[] = ["cruise", "descent", "landing", "taxiin"];
type Source = "metar" | "atis";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/10 py-2">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/** The phase's airport: the legacy Weather card and the Conditions inputs that feed the checks. */
function AirportWx({ side }: { side: "takeoff" | "landing" }) {
  const t = useT();
  const perf = usePhasePerformance(side);
  const { departureAirport, destinationAirport } = usePlan();
  const { point, inputs, change } = perf;
  const { station, briefing } = useBriefing(point);
  const [source, setSource] = useState<Source | null>(null);
  const [atisOpen, setAtisOpen] = useState(false);
  const openAtis = useAtis((s) => s.open);
  if (!point)
    return (
      <p className="text-muted-foreground text-sm">{t("plan.navlog.empty")}</p>
    );

  const metar = briefing.data?.metar ?? null;
  const atis = briefing.data?.atis[0] ?? null;
  const elevationFt =
    (side === "takeoff" ? departureAirport : destinationAirport)?.elevationFt ??
    0;
  const fromMetar = () => {
    if (!metar) return;
    const values = parseMetar(metar.raw);
    // Variable wind with speed: plan for the worst case, a straight tailwind.
    const variable = values.windDirectionDeg === null && values.windSpeedKt > 0;
    change({
      ...(values.temperatureC !== null && { oatC: values.temperatureC }),
      ...(values.qnhHpa !== null && { qnhHpa: values.qnhHpa }),
      windSpeedKt: values.windSpeedKt,
      windDirectionDeg: variable
        ? ((perf.empty === null ? perf.runway.trueHeadingDeg : 0) + 180) % 360
        : (values.windDirectionDeg ?? 0),
    });
    setSource("metar");
  };
  const fromAtis = () => {
    if (!atis?.qnh_hpa) return;
    change({ qnhHpa: atis.qnh_hpa });
    setSource("atis");
  };
  const status =
    source && station
      ? t("fly.wx.filled", {
          source: source.toUpperCase(),
          icao: station.icao,
        })
      : t("fly.wx.noSource");

  return (
    <>
      <div className="flex gap-2">
        <Button className={cn(chip, active)}>{point.ident}</Button>
        <Button
          variant="outline"
          className={chip}
          onClick={() => {
            openAtis(point.ident);
            setAtisOpen(true);
          }}
        >
          {t("fly.wx.insert")}
        </Button>
      </div>
      {atisOpen && (
        <AtisPadDialog point={point} open onOpenChange={setAtisOpen} />
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <section className={card}>
          <h2 className={cardTitle}>{t("fly.wx.weather")}</h2>
          <p className="text-muted-foreground">{t("fly.wx.weatherHint")}</p>
          <div>
            <Row label={t("fly.wx.info")} value={atis?.letter ?? "--"} />
            <Row
              label={t("fly.wx.time")}
              value={
                atis?.received_at ? `${atis.received_at.slice(11, 16)}Z` : "--"
              }
            />
            <Row
              label="QNH"
              value={`QNH ${fmt(atis?.qnh_hpa ?? inputs.qnhHpa)}`}
            />
          </div>
          <p className="text-muted-foreground">
            {!station
              ? t("plan.wx.noStation")
              : briefing.isPending
                ? t("plan.wx.loading")
                : metar
                  ? `METAR ${station.icao} · ${t("plan.wx.age", { minutes: fmt(metar.age_minutes) })}`
                  : t("plan.wx.none")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="h-14 flex-1"
              disabled={!station || briefing.isFetching}
              onClick={() => void briefing.refetch()}
            >
              {t("fly.wx.fetch")}
            </Button>
            <Button
              variant="outline"
              className="h-14 flex-1"
              onClick={() => {
                openAtis(point.ident);
                setAtisOpen(true);
              }}
            >
              {t("atis.insert")}
            </Button>
          </div>
        </section>
        <section className={card}>
          <h2 className={cardTitle}>{t("fly.wx.conditions")}</h2>
          <p className="text-muted-foreground">{t("fly.wx.conditionsHint")}</p>
          <Label>{t("fly.wx.source")}</Label>
          <div className="flex gap-2">
            {(["metar", "atis"] as const).map((s) => (
              <Button
                key={s}
                variant="outline"
                className={cn(chip, "h-16", source === s && active)}
                aria-pressed={source === s}
                disabled={s === "metar" ? !metar : !atis?.qnh_hpa}
                onClick={s === "metar" ? fromMetar : fromAtis}
              >
                {s.toUpperCase()}
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground">{status}</p>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="QNH"
              unit="hPa"
              value={inputs.qnhHpa}
              onChange={(qnhHpa) => change({ qnhHpa })}
            />
            <NumberField
              label={t("fly.wx.temp")}
              unit="C"
              value={inputs.oatC}
              onChange={(oatC) => change({ oatC })}
            />
            <NumberField
              label={t("fly.wx.windDir")}
              value={inputs.windDirectionDeg}
              min={0}
              onChange={(windDirectionDeg) => change({ windDirectionDeg })}
            />
            <NumberField
              label={t("fly.wx.windSpd")}
              unit="kt"
              value={inputs.windSpeedKt}
              min={0}
              onChange={(windSpeedKt) => change({ windSpeedKt })}
            />
            <div className="grid gap-1.5">
              <Label>{t("fly.wx.elevation")}</Label>
              <Input readOnly value={fmt(elevationFt)} />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

/** Legacy WX: weather and condition source; in cruise an En-route / Airports switch first. */
export function WxPanel({ phase }: { phase: FlightPhase }) {
  const t = useT();
  const { flight } = usePlan();
  const cruise = phase === "cruise";
  const [mode, setMode] = useState<"enroute" | "airports">("enroute");
  const enroute = cruise && mode === "enroute";
  const tile = (label: string, value: string) => (
    <div className="grid place-items-center gap-0.5 rounded-2xl border border-[rgba(141,190,255,.28)] bg-[rgba(23,45,74,.9)] p-4 text-center text-[0.72rem] font-black tracking-[0.08em] uppercase">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
  return (
    <>
      {cruise && (
        <div className="grid grid-cols-2 gap-3">
          {(["enroute", "airports"] as const).map((m) => (
            <Button
              key={m}
              variant={mode === m ? "default" : "outline"}
              aria-pressed={mode === m}
              className="h-14 text-sm"
              onClick={() => setMode(m)}
            >
              {t(`fly.wx.${m}`)}
            </Button>
          ))}
        </div>
      )}
      {enroute ? (
        <div className="grid grid-cols-3 gap-3">
          {tile(
            t("fly.wx.cruiseAltitude"),
            `${fmt(flight.cruiseAltitudeFt)} FT`,
          )}
          {tile(t("fly.wx.wind"), "— KT")}
          {tile(
            "OAT",
            `${flight.cruiseOatC >= 0 ? "+" : ""}${fmt(flight.cruiseOatC)} C`,
          )}
        </div>
      ) : (
        <AirportWx side={DESTINATION.includes(phase) ? "landing" : "takeoff"} />
      )}
      <details open={!enroute}>
        <summary className="cursor-pointer text-sm font-medium">
          {t("fly.wx.full")}
        </summary>
        <BriefingSection />
      </details>
    </>
  );
}
