"use client";
import { type RadioRow } from "~/domain/comms";
import { useT } from "~/i18n/use-t";
import { type useCommsPlan } from "./use-comms-plan";

function Rows({ rows }: { rows: RadioRow[] }) {
  const t = useT();
  if (!rows.length)
    return (
      <p className="text-muted-foreground text-sm">
        {t("fly.comms.notAvailable")}
      </p>
    );
  return rows.map((r, i) =>
    /^(bratislava[\s-]+information|tatry[\s-]+tower)$/i.test(
      r.callsign.trim(),
    ) ? (
      <details key={i} className="rounded-lg border p-3 text-sm">
        <summary className="text-primary cursor-pointer">
          <span>{r.callsign}</span>
          {r.sector && ` / ${r.sector}`}
          <strong className="float-right ml-3 font-mono">
            {r.frequencyMhz} MHz
          </strong>
          <span className="text-muted-foreground mt-1 block text-xs">
            {t("fly.comms.slovakGuide")}
          </span>
        </summary>
        <dl className="mt-3 grid gap-3 border-t pt-3">
          {(
            [
              ["greeting", "Dobrý deň"],
              ["thanks", "Ďakujem"],
              ["goodbye", "Dovidenia"],
              ["hearYou", "Dopočutia"],
            ] as const
          ).map(([key, phrase]) => (
            <div key={key}>
              <dt className="text-muted-foreground text-xs">
                {t(`fly.comms.slovak.${key}`)}
              </dt>
              <dd>
                <strong lang="sk">{phrase}</strong>
                <span className="text-muted-foreground ml-2 text-xs">
                  {t(`fly.comms.slovak.${key}Pronunciation`)}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </details>
    ) : (
      <div key={i} className="flex justify-between gap-3 text-sm">
        <span>
          {r.callsign || t("fly.comms.noCallsign")}
          {r.sector && ` / ${r.sector}`}
        </span>
        <strong className="font-mono">{r.frequencyMhz} MHz</strong>
      </div>
    ),
  );
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
      <h3 className={heading}>{t("fly.comms.next")}</h3>
      <Rows rows={estimate.next} />
      {groups.length > 0 && (
        <>
          <h3 className={heading}>{t("fly.comms.onRoute")}</h3>
          {groups.map((g, i) => (
            <div key={i} className="grid gap-1">
              <h4 className="text-sm font-medium">{g.name}</h4>
              <Rows rows={g.rows} />
            </div>
          ))}
        </>
      )}
    </>
  );
}
