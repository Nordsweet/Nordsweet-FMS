"use client";
import { type RadioRow } from "~/domain/comms";
import { useT } from "~/i18n/use-t";
import { type useCommsPlan } from "./use-comms-plan";
import { RadioLanguageInfo } from "./radio-language-info";
import { radioLanguage } from "~/domain/radio-language";

function Rows({
  rows,
  showInfo = true,
}: {
  rows: RadioRow[];
  showInfo?: boolean;
}) {
  const t = useT();
  if (!rows.length)
    return (
      <p className="text-muted-foreground text-sm">
        {t("fly.comms.notAvailable")}
      </p>
    );
  return rows.map((r, i) => (
    <div key={i} className="flex items-center justify-between gap-3 text-sm">
      <span className="min-w-0">
        {r.callsign || t("fly.comms.noCallsign")}
        {r.sector && ` / ${r.sector}`}
        {r.serviceId === "acc" && (
          <span className="text-muted-foreground block text-xs">
            {t("fly.comms.radarVerify")}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <strong className="font-mono whitespace-nowrap">
          {r.frequencyMhz} MHz
        </strong>
        {showInfo && (
          <RadioLanguageInfo
            station={r.callsign}
            context={r.airport}
            sector={r.sector}
          />
        )}
      </span>
    </div>
  ));
}
const heading =
  "text-primary mt-1 text-xs font-semibold tracking-[0.08em] uppercase";

/** Radio plan details; timed hand-off suggestions appear globally in the flight view. */
export function CommsPanel({
  result,
}: {
  result: ReturnType<typeof useCommsPlan>;
}) {
  const t = useT();
  if (result.loading)
    return <p className="text-sm">{t("fly.comms.loading")}</p>;
  const { estimate, groups } = result;
  return (
    <>
      <p className="text-muted-foreground -mt-2 text-sm">
        {t("fly.comms.subtitle")}
      </p>
      <h3 className={heading}>{t("fly.comms.current")}</h3>
      <Rows rows={estimate.current} />
      {result.pressureUnavailable && (
        <p className="text-muted-foreground text-xs">
          {t("fly.comms.pressureUnavailable")}
        </p>
      )}
      <h3 className={heading}>{t("fly.comms.next")}</h3>
      <Rows rows={estimate.next} />
      {groups.length > 0 && (
        <>
          <h3 className={heading}>{t("fly.comms.onRoute")}</h3>
          {groups.map((g, i) => (
            <div key={i} className="grid gap-1">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-medium">{g.name}</h4>
                <RadioLanguageInfo station={g.name} />
              </div>
              <Rows rows={g.rows} showInfo={!radioLanguage(g.name)} />
            </div>
          ))}
        </>
      )}
    </>
  );
}
