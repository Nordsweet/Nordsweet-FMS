"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { api } from "~/api";
import { Button } from "~/components/ui/button";
import { FlightPopup } from "~/features/fly/flight-popup";
import { useT } from "~/i18n/use-t";
import { useAtisCallState } from "~/stores/atis-calls";
import { useMapSettings } from "~/stores/map";
import { AtisWarning, RequestAtisCall, useAtisCallAccount } from "./atis-call";

/** Polling belongs to the shell, so leaving WX or reloading cannot lose an in-progress request. */
export function AtisCallNotifications() {
  const account = useAtisCallAccount();
  const dismissed = useAtisCallState((s) => s.dismissed);
  const dismiss = useAtisCallState((s) => s.dismiss);
  const t = useT();
  const client = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const username = account.data?.username ?? "";
  // "ready" is not the end: the text follows as `transcript` or `transcript_error`.
  const notice = account.data?.requests.find(
    (r) =>
      (r.status === "failed" ||
        (r.status === "ready" &&
          (r.transcript !== null || r.transcript_error !== null))) &&
      !dismissed[username]?.includes(r.id),
  );
  const text = notice?.message?.text;
  useEffect(() => {
    if (notice?.status !== "ready") return;
    void client.invalidateQueries({
      queryKey: ["weather.briefing", { icao: notice.icao }],
    });
    void client.invalidateQueries({
      queryKey: ["weather.atis", { icao: notice.icao }],
    });
    void client.invalidateQueries({
      queryKey: ["weather.atisMessage", { icao: notice.icao }],
    });
  }, [notice?.id, notice?.icao, notice?.status, client]);
  if (!notice || account.isError) return null;
  const message = t(
    notice.status === "failed"
      ? "atisCall.failed"
      : notice.transcript_error
        ? "atisCall.noText"
        : text
          ? "atisCall.available"
          : "atisCall.noMessage",
    { icao: notice.icao, reason: notice.transcript_error ?? "" },
  );
  return (
    <div className="pointer-events-auto fixed top-20 right-3 z-[70] w-[min(24rem,calc(100vw-1.5rem))]">
      <FlightPopup
        category="system"
        notificationId={"atis-call:" + notice.id}
        recordedAt={notice.updated_at * 1000}
        message={message}
        onDismiss={() => dismiss(username, notice.id)}
        testId="atis-call-notice"
      >
        <p>{message}</p>
        {notice.status === "ready" && !text && !notice.transcript_error && (
          <>
            <AtisWarning message={notice.message} />
            {notice.message?.redo ? (
              <p className="text-xs">{t("atisCall.redo")}</p>
            ) : (
              <RequestAtisCall icao={notice.icao} again />
            )}
          </>
        )}
        {text && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void client
                .ensureQueryData(
                  api.airports.get.queryOptions({ code: notice.icao }),
                )
                .then((airport) => {
                  if (!airport) return;
                  useMapSettings.getState().inspectPoint({
                    ...airport,
                    kind: "airport",
                    weather: true,
                  });
                  if (pathname !== "/map" && pathname !== "/fly")
                    router.push("/map");
                  dismiss(username, notice.id);
                });
            }}
          >
            {t("atisCall.view")}
          </Button>
        )}
      </FlightPopup>
    </div>
  );
}
