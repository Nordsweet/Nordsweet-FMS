import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { trafficHistory } from "~/api/traffic-details";
import { useAuth } from "~/stores/auth";
import { aviationApi } from "./client";
import { meResponseSchema } from "./schemas";

const session = { token: "test-token", username: "admin", role: "admin" };
const json = (body: unknown, init?: ResponseInit) =>
  Promise.resolve(new Response(JSON.stringify(body), init));
function stubFetch(respond: () => Promise<Response>) {
  const fetch = vi.fn((_url: URL | string, _init?: RequestInit) => respond());
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
const header = (init: RequestInit | undefined, name: string) =>
  new Headers(init?.headers).get(name);

beforeEach(() => useAuth.setState({ session }));
afterEach(() => {
  vi.unstubAllGlobals();
  useAuth.setState({ session: null });
});

it("parses the me response", () => {
  expect(meResponseSchema.parse({ username: "a", role: "user" })).toEqual({
    username: "a",
    role: "user",
  });
  expect(meResponseSchema.safeParse({ username: "a" }).success).toBe(false);
});

it.each([
  [
    "a data call",
    () => aviationApi.traffic({ lat: 50, lon: 19 }),
    { count: 0, aircraft: [], sources: {} },
  ],
  [
    "the history call",
    () => trafficHistory({ hex: "48c2a8" }),
    { hex: "48c2a8", history: [] },
  ],
] as const)("sends the bearer token on %s", async (_name, call, body) => {
  const fetch = stubFetch(() => json(body));
  await call();
  expect(header(fetch.mock.calls[0]![1], "Authorization")).toBe(
    "Bearer test-token",
  );
});

it("sends no Authorization header when signed out", async () => {
  useAuth.setState({ session: null });
  const fetch = stubFetch(() => json({ count: 0, aircraft: [], sources: {} }));
  await aviationApi.traffic({ lat: 50, lon: 19 });
  expect(header(fetch.mock.calls[0]![1], "Authorization")).toBeNull();
});

it("ends the session on a 401 mid-session, once and without retrying", async () => {
  const fetch = stubFetch(() =>
    json({ detail: "Not authenticated" }, { status: 401 }),
  );
  await expect(aviationApi.traffic({ lat: 50, lon: 19 })).rejects.toMatchObject(
    { status: 401 },
  );
  expect(useAuth.getState().session).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("keeps the session on other errors, and a late 401 for an old token cannot end a new session", async () => {
  stubFetch(() => json({ detail: "boom" }, { status: 502 }));
  await expect(aviationApi.traffic({ lat: 50, lon: 19 })).rejects.toMatchObject(
    { status: 502 },
  );
  expect(useAuth.getState().session).toEqual(session);

  stubFetch(() => {
    useAuth.getState().signIn({ ...session, token: "newer-token" });
    return json({ detail: "Not authenticated" }, { status: 401 });
  });
  await expect(aviationApi.me()).rejects.toMatchObject({ status: 401 });
  expect(useAuth.getState().session?.token).toBe("newer-token");
});
