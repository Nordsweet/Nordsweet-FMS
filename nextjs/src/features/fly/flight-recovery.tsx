"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { useT } from "~/i18n/use-t";
import {
  useFlightSync,
  startFlightSync,
  continuePreviousFlight,
  declinePreviousFlight,
} from "~/stores/flight-sync";

export function FlightRecovery() {
  const { phase, candidate, busy, error, pending } = useFlightSync();
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(startFlightSync, []);
  return (
    <>
      <Dialog open={phase !== "ready"}>
        <DialogContent
          showCloseButton={false}
          data-testid={
            phase === "prompt" ? "resume-flight" : "flight-sync-checking"
          }
          className="max-w-lg"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogTitle>
            {t(phase === "checking" ? "sync.checking" : "sync.resume")}
          </DialogTitle>
          <DialogDescription>
            {phase === "checking"
              ? t("sync.checkingDetail")
              : t("sync.previous", {
                  name: candidate?.name ?? "",
                  count: candidate?.track.length ?? 0,
                })}
          </DialogDescription>
          {error && (
            <p role="status" className="text-muted-foreground text-sm">
              {t(error === "conflict" ? "sync.conflict" : "sync.local")}
            </p>
          )}
          {phase === "prompt" && (
            <div className="flex gap-2">
              <Button
                data-testid="resume-flight-yes"
                disabled={busy}
                onClick={() => {
                  void continuePreviousFlight().then(() => {
                    if (
                      useFlightSync.getState().phase === "ready" &&
                      pathname === "/"
                    )
                      router.push("/fly");
                  });
                }}
              >
                {t("sync.yes")}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  declinePreviousFlight();
                  router.push("/");
                }}
              >
                {t("sync.no")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {phase === "ready" && error && pending.length > 0 && (
        <p
          role="status"
          data-testid="flight-sync-status"
          className="bg-background/90 fixed bottom-2 left-1/2 z-40 max-w-sm -translate-x-1/2 rounded-xl border px-3 py-2 text-xs"
        >
          {t(error === "conflict" ? "sync.conflict" : "sync.offline")}
        </p>
      )}
    </>
  );
}
