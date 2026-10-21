import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { trafficHistory } from "~/api/traffic-details";
import { useAuth } from "~/stores/auth";
import { AviationApiError, aviationApi } from "./client";
import { loginResponseSchema, meResponseSchema } from "./schemas";

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

it("parses the login and me responses", () => {
  const login = { ...session, expires_in: 2592000 };
  expect(loginResponseSchema.parse(login)).toEqual(login);
  expect(meResponseSchema.parse({ username: "a", role: "user" })).toEqual({
    username: "a",
    role: "user",
  });
  expect(loginResponseSchema.safeParse({ username: "a" }).success).toBe(false);
});

it("logs in with the credentials, without a bearer header", async () => {
  useAuth.setState({ session: null });
  const fetch = stubFetch(() => json({ ...session, expires_in: 2592000 }));
  expect(
    await aviationApi.login({ username: "admin", password: "adminadmin" }),
  ).toMatchObject({ token: "test-token", username: "admin", role: "admin" });
  const [url, init] = fetch.mock.calls[0]!;
  expect(String(url)).toMatch(/\/auth\/login$/);
  expect(init?.method).toBe("POST");
  expect(JSON.parse(init?.body as string)).toEqual({
    username: "admin",
    password: "adminadmin",
  });
  expect(header(init, "Authorization")).toBeNull();
});

it("reports wrong credentials as 401 and rate limiting as 429", async () => {
  useAuth.setState({ session: null });
  stubFetch(() =>
    json({ detail: "Wrong username or password" }, { status: 401 }),
  );
  await expect(
    aviationApi.login({ username: "admin", password: "x" }),
  ).rejects.toMatchObject({ status: 401 });

  stubFetch(() => json({ detail: "Too many attempts" }, { status: 429 }));
  const error: unknown = await aviationApi
    .login({ username: "admin", password: "x" })
    .catch((e: unknown) => e);
  expect(error).toBeInstanceOf(AviationApiError);
  expect(error).toMatchObject({ status: 429 });
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

it("revokes the token on logout using the token held when called", async () => {
  const fetch = stubFetch(() =>
    Promise.resolve(new Response(null, { status: 204 })),
  );
  const done = aviationApi.logout();
  useAuth.getState().signOut();
  await done;
  const [url, init] = fetch.mock.calls[0]!;
  expect(String(url)).toMatch(/\/auth\/logout$/);
  expect(header(init, "Authorization")).toBe("Bearer test-token");
});
