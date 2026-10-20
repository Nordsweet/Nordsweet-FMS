"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Cloud, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { answerOffer, startSync } from "~/api/sync";
import { type LiveFlight } from "~/api/sync";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { useT } from "~/i18n/use-t";
import { useAuth } from "~/stores/auth";
import { useInFlight } from "~/stores/inflight";
import { useSyncStatus } from "~/stores/sync-status";

const icons = {
  idle: Cloud,
  syncing: RefreshCw,
  offline: CloudOff,
  error: TriangleAlert,
} as const;

/** Runs the session sync while signed in, and shows its state in the header. */
export function SessionSync() {
  const username = useAuth((s) => s.session?.username);
  const queryClient = useQueryClient();
  const { state, reason, pending, rejected } = useSyncStatus();
  const t = useT();
  useEffect(
    () => (username ? startSync(username, queryClient) : undefined),
    [username, queryClient],
  );
  if (!username) return null;
  const Icon = icons[state];
  const detail = [
    state === "offline" ? t("session.status.offline") : null,
    state === "error" && reason === "conflict"
      ? t("session.reason.conflict")
      : state === "error" && reason
        ? reason
        : null,
    pending ? t("session.status.pending", { count: pending }) : null,
    rejected.length
      ? t("session.rejected", { items: rejected.join("; ") })
      : null,
  ]
    .filter(Boolean)
    .join(" ");
  const label = t(`session.status.${state}`).split(":")[0]!;
  return (
    <>
      <span
        data-testid="session-sync"
        data-state={state}
        title={t("session.status.title", { status: detail || label })}
        className="text-muted-foreground flex items-center gap-1 text-xs"
      >
        <Icon
          className={`size-4 ${state === "syncing" ? "animate-spin" : ""} ${state === "error" || rejected.length ? "text-amber-400" : ""}`}
        />
        <span className="max-sm:sr-only">{label}</span>
      </span>
      <FlightOffer />
    </>
  );
}

function FlightOffer() {
  const t = useT();
  const offer = useSyncStatus((s) =>
    s.offers.find((o) => o.collection === "live-flight"),
  );
  const flying = useInFlight((s) => s.startedAt !== null);
  if (!offer) return null;
  const named = (offer.item.data as Partial<LiveFlight> | null)?.deviceName;
  const device = named?.length ? named : offer.item.device_id.slice(0, 8);
  const time = new Date(offer.item.updated_at).toLocaleTimeString();
  const answer = (choice: "take" | "keep") =>
    void answerOffer(offer.collection, offer.id, choice);
  return (
    <Dialog open onOpenChange={(open) => !open && answer("keep")}>
      <DialogContent data-testid="flight-offer" className="max-w-lg">
        <DialogTitle>{t("session.offer.title", { device })}</DialogTitle>
        <DialogDescription>
          {t(flying ? "session.offer.bodyConflict" : "session.offer.body", {
            time,
          })}
        </DialogDescription>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => answer("keep")}>
            {t(flying ? "session.offer.keep" : "session.offer.dismiss")}
          </Button>
          <Button onClick={() => answer("take")}>
            {t("session.offer.take")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
