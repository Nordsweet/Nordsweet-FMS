"use client";

import { useEffect } from "react";
import { logbookApi } from "~/api/logbook";
import { logbookFromCheckpoint, logbookFromDebrief } from "~/domain/logbook";
import { useAuth } from "~/stores/auth";
import { useFlight } from "~/stores/flight";
import { useFlightSync } from "~/stores/flight-sync";
import { useInFlight } from "~/stores/inflight";
import { useLogbook } from "~/stores/logbook";
import { useSettings } from "~/stores/settings";

/** Automatic recording is mounted above routes, so closing panels or opening Logbook cannot lose a flight. */
export function LogbookRuntime() {
  const username = useAuth((s) => s.session?.username);
  useEffect(() => {
    if (!username) return;
    let stopped = false,
      busy = false,
      imported = false;
    const currentUser = () =>
      !stopped && useAuth.getState().session?.username === username;
    const status = (value: "loading" | "ready" | "offline") => {
      if (currentUser())
        useLogbook.setState((s) => ({
          status: { ...s.status, [username]: value },
        }));
    };
    const defaultPic = () =>
      useSettings.getState().pilotSurname.trim() || username;
    const capture = () => {
      if (!currentUser()) return;
      const live = useInFlight.getState(),
        record = live.debrief;
      // A flight restored from a pre-logbook checkpoint needs a stable identity too.
      if (
        record &&
        !record.sessionId &&
        live.startedAt &&
        useFlightSync.getState().phase === "ready"
      ) {
        const checkpoint = useFlightSync
          .getState()
          .pending.find((flight) => flight.startedAt === live.startedAt);
        const cached = Object.values(
          useLogbook.getState().accounts[username] ?? {},
        ).find(({ entry }) => entry.startedAt === live.startedAt);
        useInFlight.setState({
          debrief: {
            ...record,
            sessionId:
              checkpoint?.id ?? cached?.entry.id ?? crypto.randomUUID(),
            startedAt: live.startedAt,
            username,
            pic: defaultPic(),
          },
        });
        capture();
        return;
      }
      if (!record?.sessionId || record.username !== username) return;
      const plan = useFlight.getState().flight;
      const entry = logbookFromDebrief(
        {
          ...record,
          landingCount: live.startedAt
            ? live.timers.events.filter((e) => e.name === "Landing").length
            : record.landingCount,
          times: live.startedAt
            ? {
                offBlockAt: live.timers.offBlock.startedAt,
                onBlockAt: live.timers.offBlock.stoppedAt,
                takeoffAt: live.timers.airTime.startedAt,
                landingAt: live.timers.airTime.stoppedAt,
              }
            : record.times,
        },
        {
          id: record.sessionId,
          startedAt: record.startedAt!,
          departure: plan.departure?.ident ?? "",
          arrival: plan.destination?.ident ?? "",
          pic: defaultPic(),
        },
      );
      useLogbook.getState().put(username, entry);
    };
    const pull = async () => {
      for (let offset = 0; currentUser(); offset += 100) {
        const page = await logbookApi.list(offset);
        if (!currentUser()) return;
        page.entries.forEach((entry) =>
          useLogbook.getState().put(username, entry, true),
        );
        if (!page.hasMore) {
          status("ready");
          return;
        }
      }
    };
    const push = async () => {
      if (busy || !currentUser()) return;
      busy = true;
      let sent = false;
      try {
        const account = useLogbook.getState().accounts[username] ?? {};
        for (const [id, cached] of Object.entries(account)) {
          if (!cached.dirty || !currentUser()) continue;
          // Editing PIC on another device must not upload its older timer/readings snapshot.
          const saved =
            (cached.summaryDirty ?? cached.dirty)
              ? await logbookApi.save(cached.entry)
              : cached.entry;
          sent = true;
          if (cached.picEdit !== null && currentUser())
            await logbookApi.pic(id, cached.picEdit);
          if (!currentUser()) return;
          // A newer local edit made while the request was in flight must remain queued.
          useLogbook.setState((state) => {
            if (state.accounts[username]?.[id] !== cached) return state;
            return {
              accounts: {
                ...state.accounts,
                [username]: {
                  ...state.accounts[username],
                  [id]: {
                    entry: { ...saved, pic: cached.picEdit ?? saved.pic },
                    dirty: false,
                    summaryDirty: false,
                    picEdit: null,
                  },
                },
              },
            };
          });
        }
        if (sent) status("ready");
      } catch {
        status(
          "offline",
        ); /* The local outbox survives offline/auth/server failures. */
      } finally {
        busy = false;
      }
    };
    const importLegacy = async () => {
      if (imported || !currentUser()) return;
      const token = useFlightSync.getState().token;
      if (!token) return;
      const key = token.slice(0, 16);
      const legacyOwner = useLogbook.getState().legacyOwners[key];
      if (legacyOwner && legacyOwner !== username) return;
      useLogbook.setState((s) => ({
        legacyOwners: { ...s.legacyOwners, [key]: username },
      }));
      const importEntry = (
        flight: Parameters<typeof logbookFromCheckpoint>[0],
      ) => {
        const owner = flight.snapshot.inflight.debrief?.username;
        if (owner && owner !== username) return;
        const entry = logbookFromCheckpoint(flight, defaultPic());
        if (entry && !useLogbook.getState().accounts[username]?.[entry.id])
          useLogbook.getState().put(username, entry);
      };
      useFlightSync.getState().pending.forEach(importEntry);
      for (let offset = 0; currentUser(); offset += 100) {
        const page = await logbookApi.legacy(token, offset);
        if (!currentUser()) return;
        page.flights.forEach(importEntry);
        if (!page.hasMore) {
          imported = true;
          return;
        }
      }
    };
    const update = () => {
      capture();
      void push();
    };
    const refresh = () => {
      void pull().catch(() => status("offline"));
      void importLegacy()
        .catch(() => undefined)
        .then(push);
    };
    capture();
    status("loading");
    void pull()
      .catch(() => status("offline"))
      .then(importLegacy)
      .catch(() => undefined)
      .then(push);
    const unsubscribe = useInFlight.subscribe(update);
    const periodic = setInterval(update, 5000);
    const refreshTimer = setInterval(refresh, 30000);
    window.addEventListener("online", refresh);
    window.addEventListener("online", update);
    window.addEventListener("nordsweet-logbook-refresh", refresh);
    return () => {
      stopped = true;
      unsubscribe();
      clearInterval(periodic);
      clearInterval(refreshTimer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("online", update);
      window.removeEventListener("nordsweet-logbook-refresh", refresh);
    };
  }, [username]);
  return null;
}
