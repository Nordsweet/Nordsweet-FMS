import { afterEach, expect, it, vi } from "vitest";
import { aviationApi, AviationApiError } from "./client";
import { atisCallAccountSchema } from "./schemas";
import { useAuth } from "~/stores/auth";

const account = {
  username: "grzes",
  tokens_available: 10000,
  enabled: false,
  airports: ["EPKK"],
  requests: [],
};
afterEach(() => {
  vi.unstubAllGlobals();
  useAuth.setState({ session: null });
});

it("reads the authenticated balance and sends only the airport/idempotency key when requesting", async () => {
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

it("rejects negative/fractional balances and reports disabled provider errors without ending the session", async () => {
  expect(
    atisCallAccountSchema.safeParse({ ...account, tokens_available: -1 })
      .success,
  ).toBe(false);
  expect(
    atisCallAccountSchema.safeParse({ ...account, tokens_available: 0.5 })
      .success,
  ).toBe(false);
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
