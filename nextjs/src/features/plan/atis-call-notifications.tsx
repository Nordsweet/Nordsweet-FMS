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
import { useAtisCallAccount } from "./atis-call";

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
  const notice = account.data?.requests.find(
    (r) =>
      ["ready", "failed"].includes(r.status) &&
      !dismissed[username]?.includes(r.id),
  );
  useEffect(() => {
    if (notice?.status !== "ready") return;
    void client.invalidateQueries({
      queryKey: ["weather.briefing", { icao: notice.icao }],
    });
    void client.invalidateQueries({
      queryKey: ["weather.atis", { icao: notice.icao }],
    });
  }, [notice?.id, notice?.icao, notice?.status, client]);
  if (!notice || account.isError) return null;
  const message = t(
    notice.status === "ready" ? "atisCall.available" : "atisCall.failed",
    { icao: notice.icao },
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
        {notice.status === "ready" && (
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
