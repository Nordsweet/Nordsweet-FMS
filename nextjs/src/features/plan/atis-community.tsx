"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNow } from "~/hooks/use-now";
import { api } from "~/api";
import { atisReporterId } from "~/api/atis-reporter";
import { type Atis } from "~/api/aviation/schemas";
import { Button } from "~/components/ui/button";
import {
  type AtisPad,
  type AtisAction,
  type AtisField,
} from "~/domain/atis-pad";
import { atisHints, atisPadReport } from "~/domain/atis-consensus";
import { useT } from "~/i18n/use-t";

/** Explicit hearing confirmation; opening or applying suggestions never submits a vote. */
export function AtisCommunity({
  icao,
  reports,
  pad,
  dispatch,
}: {
  icao: string;
  reports: Atis[];
  pad: AtisPad;
  dispatch: (action: AtisAction) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["weather.briefing"] });
  const submit = useMutation({
    ...api.community.submitAtis.mutationOptions(),
    onSuccess: refresh,
  });
  const confirm = useMutation({
    ...api.community.confirmAtis.mutationOptions(),
    onSuccess: refresh,
  });
  const now = useNow(30_000);
  const candidate = atisPadReport(icao, pad, now);
  return (
    <section
      aria-label={t("atisConsensus.suggestions")}
      className="grid gap-3 rounded-2xl border p-3"
    >
      <h3 className="text-primary text-sm font-bold">
        {t("atisConsensus.suggestions")}
      </h3>
      {reports.map((report, i) => (
        <details key={report.id ?? i} className="rounded-xl border p-2">
          <summary className="cursor-pointer text-sm">
            ATIS {report.letter} ·{" "}
            {report.source === "community"
              ? report.confirmation_count >= 2
                ? t("atisConsensus.trusted", {
                    count: report.confirmation_count,
                  })
                : t("atisConsensus.single")
              : "D-ATIS"}
            {report.stale && ` · ${t("plan.wx.stale")}`}
          </summary>
          <pre className="my-2 text-xs whitespace-pre-wrap">{report.text}</pre>
          <div className="flex flex-wrap gap-2">
            {Object.entries(atisHints(report, icao)).map(
              ([field, value]) =>
                value && (
                  <Button
                    key={field}
                    size="sm"
                    variant="outline"
                    className="border-sky-400/60 bg-sky-500/15 text-sky-200"
                    onClick={() => {
                      // The helper only returns the ATIS pad's declared field names.
                      const key = field as AtisField;
                      dispatch({ type: "preset", field: key, value });
                    }}
                  >
                    {t(`atis.field.${field as AtisField}`)}: {value}
                  </Button>
                ),
            )}
          </div>
          {report.source === "community" && report.id && (
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              disabled={report.stale || confirm.isPending}
              onClick={() =>
                confirm.mutate({ id: report.id!, reporterId: atisReporterId() })
              }
            >
              {t("atisConsensus.confirm")}
            </Button>
          )}
        </details>
      ))}
      <p className="text-muted-foreground text-xs">{t("atisConsensus.note")}</p>
      <Button
        size="sm"
        disabled={!candidate || submit.isPending}
        onClick={() => {
          const report = atisPadReport(icao, pad, Date.now());
          if (report)
            submit.mutate({
              ...report,
              id: crypto.randomUUID(),
              reporterId: atisReporterId(),
            });
        }}
      >
        {t("atisConsensus.submit")}
      </Button>
      {!candidate && (
        <p className="text-muted-foreground text-xs">
          {t("atisConsensus.required")}
        </p>
      )}
      {(submit.isSuccess || confirm.isSuccess) && (
        <p role="status" className="text-ok text-sm">
          {t("atisConsensus.saved")}
        </p>
      )}
      {(submit.isError || confirm.isError) && (
        <p role="alert" className="text-destructive text-sm">
          {t("atisConsensus.failed")}
        </p>
      )}
    </section>
  );
}
