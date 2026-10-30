import { type Route } from "@playwright/test";

type Doc = Record<string, unknown>;
type Row = {
  id: string;
  version: number;
  schema_version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  document: Doc | null;
};
type Settings = Doc & { updated_at?: string };
type Airframe = {
  id: string;
  type: string;
  registration: string;
  fuel_indication_mode: string | null;
  state: Doc | null;
};
const normalizeRegistration = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]+/g, "");

export const API = "https://aviation.lab.vibecde.com";
/** Paths of the typed user-data routes (docs/API.md, "User data"). */
export const USER_DATA_ROUTES =
  /^https:\/\/aviation\.lab\.vibecde\.com\/(me|flights|aircraft\/custom|airframes|flight-logs|import)(\/|\?|$)/;

/** The documented behaviour of the user-data routes, in memory, shared by every browser context of a test. */
export function userDataServer() {
  const collections = {
    flights: new Map<string, Row>(),
    "aircraft/custom": new Map<string, Row>(),
  };
  const changedAt = new Map<string, string>();
  let tick = 0;
  const stamp = () => `2026-10-30T10:00:00.${String(++tick).padStart(6, "0")}Z`;
  const server = {
    collections,
    settings: null as Settings | null,
    favorites: new Set<string>(),
    logs: new Map<string, Doc>(),
    tracks: new Map<string, unknown[]>(),
    airframes: new Map<string, Airframe>(),
    readings: [] as Doc[],
    imports: [] as Doc[],
    deleted: false,
    /** Every call: method, path and the Authorization header. */
    seen: [] as { method: string; path: string; authorization: string }[],
    /** Set to make every call fail like a lost connection. */
    down: false,
  };

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, json: body });
  const noContent = (route: Route) => route.fulfill({ status: 204 });

  function documents(
    route: Route,
    name: keyof typeof collections,
    rest: string,
    method: string,
    url: URL,
    body: Doc | null,
  ) {
    const rows = collections[name];
    if (!rest) {
      const since = url.searchParams.get("updatedSince");
      const items = [...rows.values()]
        .filter((r) => !since || changedAt.get(`${name}/${r.id}`)! > since)
        .sort((a, b) =>
          changedAt
            .get(`${name}/${a.id}`)!
            .localeCompare(changedAt.get(`${name}/${b.id}`)!),
        );
      return json(route, {
        items,
        has_more: false,
        cursor: items.length
          ? changedAt.get(`${name}/${items.at(-1)!.id}`)
          : since, // null for a new user, as the server answers
      });
    }
    const id = rest.slice(1);
    const current = rows.get(id);
    if (method === "GET")
      return current
        ? json(route, current)
        : json(route, { detail: "unknown" }, 404);
    const sent =
      method === "PUT"
        ? (body?.version as number)
        : url.searchParams.has("version")
          ? Number(url.searchParams.get("version"))
          : undefined;
    if (method === "DELETE" && !current)
      return json(route, { detail: "unknown" }, 404);
    if (sent !== undefined && (current?.version ?? 0) !== sent)
      return json(
        route,
        { detail: { message: "version conflict", current: current ?? null } },
        409,
      );
    const at = stamp();
    const row: Row = {
      id,
      version: (current?.version ?? 0) + 1,
      schema_version: (body?.schema_version as number | undefined) ?? 1,
      created_at: current?.created_at ?? at,
      updated_at: at,
      deleted_at: method === "DELETE" ? at : null,
      document: method === "DELETE" ? null : (body?.document as Doc),
    };
    rows.set(id, row);
    changedAt.set(`${name}/${id}`, at);
    return method === "DELETE" ? noContent(route) : json(route, row);
  }

  let airframeCount = 0;
  const airframe = (type: string, registration: string) => {
    const key = `${type.toUpperCase()}::${normalizeRegistration(registration)}`;
    const found = [...server.airframes.values()].find(
      (a) => `${a.type}::${a.registration}` === key,
    );
    if (found) return { airframe: found, created: false };
    const created: Airframe = {
      id: `00000000-0000-4000-8000-${String(++airframeCount).padStart(12, "0")}`,
      type: type.toUpperCase(),
      registration: normalizeRegistration(registration),
      fuel_indication_mode: null,
      state: null,
    };
    server.airframes.set(created.id, created);
    return { airframe: created, created: true };
  };
  const reading = (a: Airframe, body: Doc) => {
    const previous = a.state;
    const warnings =
      previous &&
      typeof body.mth === "number" &&
      typeof previous.mth === "number" &&
      body.mth < previous.mth
        ? [
            {
              code: "mth_decreased",
              previous_mth: previous.mth,
              previous_recorded_at: previous.recorded_at,
            },
          ]
        : [];
    a.state = {
      reading_id: body.id,
      recorded_at: body.recorded_at ?? new Date().toISOString(),
      recorded_by: "admin",
      source: body.source ?? "manual",
      mth: body.mth ?? null,
      fuel_remaining_l: body.fuel_remaining_l ?? null,
      fuel_added_l: body.fuel_added_l ?? null,
      fuel_used_l: body.fuel_used_l ?? null,
    };
    return warnings;
  };

  const handle = async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    server.seen.push({
      method,
      path: url.pathname,
      authorization: request.headers().authorization ?? "",
    });
    if (server.down) return route.abort();
    const body = request.postData() ? (request.postDataJSON() as Doc) : null;
    const path = url.pathname;

    if (path === "/me")
      return json(route, {
        id: "00000000-0000-4000-8000-000000000001",
        username: "admin",
        role: "admin",
        organizations: [],
      });
    if (path === "/me/data" && method === "DELETE") {
      if (url.searchParams.get("confirm") !== "admin")
        return json(route, { detail: "confirm with your username" }, 422);
      server.deleted = true;
      collections.flights.clear();
      collections["aircraft/custom"].clear();
      server.settings = null;
      server.favorites.clear();
      server.logs.clear();
      server.airframes.clear();
      return json(route, { deleted: { saved_flights: 1 } });
    }
    if (path === "/me/settings") {
      if (method === "GET")
        return server.settings
          ? json(route, server.settings)
          : json(route, { detail: "no settings yet" }, 404);
      server.settings = { ...body, updated_at: stamp() };
      return json(route, server.settings);
    }
    if (path === "/me/favorites")
      return json(route, {
        items: [...server.favorites].map((item_id) => ({
          item_id,
          created_at: stamp(),
        })),
        has_more: false,
      });
    if (path.startsWith("/me/favorites/")) {
      const id = decodeURIComponent(path.slice("/me/favorites/".length));
      if (method === "PUT") server.favorites.add(id);
      else server.favorites.delete(id);
      return noContent(route);
    }
    if (path.startsWith("/flights"))
      return documents(
        route,
        "flights",
        path.slice("/flights".length),
        method,
        url,
        body,
      );
    if (path.startsWith("/aircraft/custom"))
      return documents(
        route,
        "aircraft/custom",
        path.slice("/aircraft/custom".length),
        method,
        url,
        body,
      );
    if (path === "/import") {
      server.imports.push(body ?? {});
      const part = (
        items: Doc[] | undefined,
        into: Map<string, Row>,
        name: string,
      ) => {
        const result = { imported: 0, skipped: 0, rejected: [] as Doc[] };
        for (const item of items ?? []) {
          const id = item.id as string;
          if (!/^[0-9a-f-]{36}$/.test(id))
            result.rejected.push({ id, error: "id is not a UUID" });
          else if (into.has(id)) result.skipped++;
          else {
            const at = stamp();
            into.set(id, {
              id,
              version: 1,
              schema_version: 1,
              created_at: at,
              updated_at: at,
              deleted_at: null,
              document: item.document as Doc,
            });
            changedAt.set(`${name}/${id}`, at);
            result.imported++;
          }
        }
        return result;
      };
      const importStates = (items: Doc[] | undefined) => {
        const result = { imported: 0, skipped: 0, rejected: [] as Doc[] };
        (items ?? []).forEach((item) => {
          const { airframe: a } = airframe(
            item.type as string,
            (item.registration as string | undefined) ?? "",
          );
          a.fuel_indication_mode ??=
            (item.fuel_indication_mode as string | null) ?? null;
          const values = [
            "mth",
            "fuel_remaining_l",
            "fuel_added_l",
            "fuel_used_l",
          ];
          if (values.every((v) => item[v] == null))
            return void result.skipped++;
          reading(a, {
            ...item,
            id: crypto.randomUUID(),
            recorded_at: item.updated_at,
            source: "import",
          });
          result.imported++;
        });
        return result;
      };
      const settings = body?.settings as Settings | undefined;
      const hadSettings = server.settings !== null;
      if (settings && !hadSettings)
        server.settings = { ...settings, updated_at: stamp() };
      for (const id of (body?.favorites as string[] | undefined) ?? [])
        server.favorites.add(id);
      return json(route, {
        flights: part(
          body?.flights as Doc[] | undefined,
          collections.flights,
          "flights",
        ),
        custom_aircraft: part(
          body?.custom_aircraft as Doc[] | undefined,
          collections["aircraft/custom"],
          "aircraft/custom",
        ),
        airframe_states: importStates(
          body?.airframe_states as Doc[] | undefined,
        ),
        favorites: { imported: 0, skipped: 0, rejected: [] },
        settings: settings ? (hadSettings ? "skipped" : "imported") : undefined,
      });
    }
    if (path === "/airframes" && method === "GET")
      return json(route, {
        items: [...server.airframes.values()],
        has_more: false,
      });
    if (path === "/airframes" && method === "POST") {
      const { airframe: a, created } = airframe(
        body?.type as string,
        (body?.registration as string | undefined) ?? "",
      );
      return json(route, a, created ? 201 : 200);
    }
    const one = /^\/airframes\/([^/]+)(\/readings|\/state)?$/.exec(path);
    if (one) {
      const a = server.airframes.get(one[1]!);
      if (!a) return json(route, { detail: "unknown" }, 404);
      if (method === "PATCH") {
        a.fuel_indication_mode =
          (body?.fuel_indication_mode as string | null) ?? null;
        return json(route, a);
      }
      if (one[2] === "/readings" && method === "POST") {
        server.readings.push(body ?? {});
        const warnings = reading(a, body ?? {});
        return json(route, { reading: { id: body?.id }, warnings }, 201);
      }
      return json(route, a);
    }
    if (path === "/flight-logs" && method === "POST") {
      const id = body?.id as string;
      const created = !server.logs.has(id);
      if (created) {
        server.logs.set(id, body ?? {});
        server.tracks.set(id, (body?.track as unknown[] | undefined) ?? []);
      }
      return json(
        route,
        { log: summary(id), created, warnings: [] },
        created ? 201 : 200,
      );
    }
    if (path === "/flight-logs")
      return json(route, {
        items: [...server.logs.keys()].map(summary),
        has_more: false,
      });
    const log = /^\/flight-logs\/([^/]+)(\/track)?$/.exec(path);
    if (log) {
      const id = log[1]!;
      if (!server.logs.has(id)) return json(route, { detail: "unknown" }, 404);
      if (method === "DELETE") {
        server.logs.delete(id);
        server.tracks.delete(id);
        return noContent(route);
      }
      if (log[2])
        return json(route, {
          log_id: id,
          point_count: server.tracks.get(id)!.length,
          points: server.tracks.get(id),
        });
      return json(route, {
        ...summary(id),
        debrief: server.logs.get(id)!.debrief,
        emergency_sessions: [],
      });
    }
    return json(route, { detail: `unmocked ${method} ${path}` }, 404);
  };

  function summary(id: string) {
    const log = server.logs.get(id) ?? {};
    return {
      id,
      flight_id: log.flight_id ?? null,
      aircraft_type: log.aircraft_type ?? null,
      registration: log.registration ?? "",
      started_at: log.started_at,
      ended_at: log.ended_at,
      off_block_at: log.off_block_at ?? null,
      takeoff_at: log.takeoff_at ?? null,
      landing_at: log.landing_at ?? null,
      on_block_at: log.on_block_at ?? null,
      mth_before: log.mth_before ?? null,
      mth_after: log.mth_after ?? null,
      fuel_before_l: log.fuel_before_l ?? null,
      fuel_after_l: log.fuel_after_l ?? null,
      track_points: (server.tracks.get(id) ?? []).length || null,
    };
  }

  return { server, handle };
}
