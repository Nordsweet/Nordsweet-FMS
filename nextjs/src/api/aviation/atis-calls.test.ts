import { afterEach, expect, it, vi } from "vitest";
import { aviationApi, AviationApiError } from "./client";
import { useAuth } from "~/stores/auth";

const account = {
  username: "grzes",
  enabled: false,
  airports: ["EPKK"],
  requests: [],
};
afterEach(() => {
  vi.unstubAllGlobals();
  useAuth.setState({ session: null });
});

it("reads the authenticated account and sends only the airport/idempotency key when requesting", async () => {
  useAuth.setState({
    session: { username: "grzes", token: "private-session", role: "user" },
  });
  const fetch = vi.fn((_url: URL, _init?: RequestInit) =>
    Promise.resolve(
      new Response(JSON.stringify({ ...account, request_id: "test-id" })),
    ),
  );
  vi.stubGlobal("fetch", fetch);
  expect(await aviationApi.atisCallAccount()).toEqual(account);
  await aviationApi.requestAtisCall({ icao: "epkk", requestId: "test-id" });
  const [url, init] = fetch.mock.calls[1]!;
  expect(url.pathname).toBe("/airports/EPKK/atis-call");
  expect(new Headers(init?.headers).get("Authorization")).toBe(
    "Bearer private-session",
  );
  expect(JSON.parse(init?.body as string)).toEqual({ request_id: "test-id" });
});

it("reads the airport's current telephone ATIS without placing a call", async () => {
  useAuth.setState({
    session: { username: "grzes", token: "t", role: "user" },
  });
  const message = {
    text: "EPKK INFORMATION A QNH 1013",
    error: null,
    changed: false,
    misheard: false,
    redo: false,
  };
  const fetch = vi.fn((_url: URL, _init?: RequestInit) =>
    Promise.resolve(
      new Response(
        JSON.stringify({ icao: "EPKK", captured_at: 1_700_000_000, message }),
      ),
    ),
  );
  vi.stubGlobal("fetch", fetch);
  expect(await aviationApi.atisMessage("epkk")).toEqual({
    icao: "EPKK",
    captured_at: 1_700_000_000,
    message,
  });
  expect(fetch.mock.calls[0]![0].pathname).toBe("/airports/EPKK/atis-message");
  expect(fetch.mock.calls[0]![1]?.method).toBeUndefined();
});

it("keeps requests whose transcript has not arrived yet", async () => {
  useAuth.setState({
    session: { username: "grzes", token: "t", role: "user" },
  });
  const request = {
    id: "a",
    icao: "EPKK",
    status: "ready",
    created_at: 1,
    updated_at: 2,
    error: null,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ...account, requests: [request] })),
      ),
    ),
  );
  const { requests } = await aviationApi.atisCallAccount();
  expect(requests[0]).toMatchObject({
    transcript: null,
    transcript_error: null,
    message: null,
  });
});

it("reports disabled provider errors without ending the session", async () => {
  useAuth.setState({
    session: { username: "grzes", token: "test", role: "user" },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ detail: "Provider disabled" }), {
          status: 503,
        }),
      ),
    ),
  );
  await expect(
    aviationApi.requestAtisCall({ icao: "EPKK", requestId: "id" }),
  ).rejects.toBeInstanceOf(AviationApiError);
  expect(useAuth.getState().session?.username).toBe("grzes");
});
