import { useInspiration } from "~/stores/inspiration";
import { type SourceStatus } from "~/stores/userdata-status";
import { useSettings } from "~/stores/settings";

import { same } from "../sync/merge";
import { type UserDataApi, UserDataError } from "./client";
import { homeAirport, settingsBody } from "./import";
import { type SettingsBody } from "./schemas";
import { backoff, wakeOnReturn } from "./wake";

type Report = (patch: Partial<SourceStatus>) => void;

/** A failed call as the header shows it: no connection or a server fault is "offline", the rest an error. */
export const failure = (error: unknown): Partial<SourceStatus> => ({
  state:
    error instanceof UserDataError &&
    (error.status === 0 || error.status >= 500)
      ? "offline"
      : "error",
  reason: error instanceof Error ? error.message : "unknown",
});

/** Runs one job at a time; a request made while one runs waits for it and then runs once. */
function serial(job: () => Promise<void>) {
  let running: Promise<void> | null = null;
  let again = false;
  const run = (): Promise<void> => {
    if (running) {
      again = true;
      return running;
    }
    running = job()
      .catch(() => undefined) // a job reports its own failure
      .finally(() => {
        running = null;
      })
      .then(() => {
        if (!again) return;
        again = false;
        return run();
      });
    return running;
  };
  return run;
}

function debounced(run: () => unknown, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const call = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void run(), ms);
  };
  call.cancel = () => clearTimeout(timer);
  return call;
}

/**
 * `/me/settings`: last write wins. A local edit is marked pending in storage (so it survives a
 * reload while offline) and uploaded after a pause; with nothing pending the server's copy is applied.
 */
export function startSettingsSync({
  api,
  username,
  report,
}: {
  api: Pick<UserDataApi, "settings" | "putSettings">;
  username: string;
  report: Report;
}) {
  const pendingKey = `nordsweet.settingsPending.${username}.v1`;
  let known: SettingsBody | null = null; // what the server holds, as far as this device knows
  const current = () => settingsBody(useSettings.getState());

  const push = async () => {
    const body = current();
    await api.putSettings(body);
    known = body;
    // An edit made during the upload is still pending.
    if (same(current(), body)) localStorage.removeItem(pendingKey);
  };
  const apply = (server: SettingsBody) => {
    known = server;
    const local = useSettings.getState().homeAirportIcao;
    useSettings.setState({
      language: server.language,
      // The server has no place for free text such as an airport name: that stays as typed.
      homeAirportIcao:
        server.home_airport_icao ?? (homeAirport(local) ? "" : local),
      pilotWeightKg: server.pilot_weight_kg,
      atisAutoscroll: server.atis_autoscroll,
      checklistAutoscroll: server.checklist_autoscroll,
      checklistVoiceGender: server.checklist_voice_gender,
    });
  };

  const retry = backoff(() => void sync());
  const sync = serial(async () => {
    report({ state: "syncing", reason: null });
    try {
      const server = await api.settings();
      if (!server || localStorage.getItem(pendingKey)) await push();
      else apply(server);
      report({ state: "idle", reason: null, pending: 0 });
      retry.ok();
    } catch (error) {
      const failed = failure(error);
      report({ ...failed, pending: 1 });
      if (failed.state === "offline") retry.failed();
    }
  });
  const later = debounced(sync, 1500);
  const unsubscribe = useSettings.subscribe((state) => {
    if (known && same(settingsBody(state), known)) return;
    localStorage.setItem(pendingKey, "1");
    later();
  });
  const unwake = wakeOnReturn(() => void sync());
  void sync();
  return () => {
    later.cancel();
    retry.stop();
    unsubscribe();
    unwake();
  };
}

const ids = (items: { item_id: string }[]) => items.map((i) => i.item_id);

/**
 * `/me/favorites`: a set both sides add to and remove from. What this device added or removed since
 * the last agreement (`base`) is sent; everything else follows the server. Calls are idempotent.
 */
export function startFavoritesSync({
  api,
  username,
  report,
}: {
  api: Pick<UserDataApi, "favorites" | "putFavorite" | "removeFavorite">;
  username: string;
  report: Report;
}) {
  const baseKey = `nordsweet.favoritesBase.${username}.v1`;
  const readBase = (): string[] => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(baseKey) ?? "[]");
      return Array.isArray(value) ? (value as string[]) : [];
    } catch {
      return [];
    }
  };
  const fetchAll = async () => {
    const all: string[] = [];
    for (let offset = 0; ; offset = all.length) {
      const page = await api.favorites(offset);
      all.push(...ids(page.items));
      if (!page.has_more || !page.items.length) return all;
    }
  };
  let applying = false;

  const retry = backoff(() => void sync());
  const sync = serial(async () => {
    report({ state: "syncing", reason: null });
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const local = useInspiration.getState().favorites;
        const base = new Set(readBase());
        const server = await fetchAll();
        const onServer = new Set(server);
        const added = local.filter((id) => !base.has(id));
        const removed = [...base].filter((id) => !local.includes(id));
        for (const id of added)
          if (!onServer.has(id)) await api.putFavorite(id);
        for (const id of removed)
          if (onServer.has(id)) await api.removeFavorite(id);
        // The agreed set: the server's, plus what was added here, minus what was removed here.
        const agreed = [...new Set([...server, ...added])].filter(
          (id) => !removed.includes(id),
        );
        // A toggle during the calls above: go round again from the new local list.
        if (useInspiration.getState().favorites !== local) continue;
        const merged = [
          ...local.filter((id) => agreed.includes(id)),
          ...agreed.filter((id) => !local.includes(id)),
        ];
        if (!same(merged, local)) {
          applying = true;
          useInspiration.setState({ favorites: merged });
          applying = false;
        }
        localStorage.setItem(baseKey, JSON.stringify(merged));
        break;
      }
      report({ state: "idle", reason: null, pending: 0 });
      retry.ok();
    } catch (error) {
      const failed = failure(error);
      report({ ...failed, pending: 1 });
      if (failed.state === "offline") retry.failed();
    }
  });
  const later = debounced(sync, 1000);
  const unsubscribe = useInspiration.subscribe(() => {
    if (!applying) later();
  });
  const unwake = wakeOnReturn(() => void sync());
  void sync();
  return () => {
    later.cancel();
    retry.stop();
    unsubscribe();
    unwake();
  };
}
