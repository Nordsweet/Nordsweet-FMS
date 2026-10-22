import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useServerConnection } from "~/stores/server-connection";
import { aviationFetch } from "./client";

const url = new URL("https://aviation.lab.vibecde.com/traffic");

beforeEach(() => useServerConnection.setState({ lastContactAt: null }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("timestamps receipt, not request start, and bypasses the HTTP cache", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
  let respond!: (response: Response) => void;
  const request = vi.fn(
    (_url: URL, _init?: RequestInit) =>
      new Promise<Response>((resolve) => {
        respond = resolve;
      }),
  );
  vi.stubGlobal("fetch", request);
  const pending = aviationFetch(url);
  expect(useServerConnection.getState().lastContactAt).toBeNull();
  clock.mockReturnValue(4000);
  respond(new Response("{}"));
  await pending;
  expect(useServerConnection.getState().lastContactAt).toBe(4000);
  expect(request.mock.calls[0]?.[1]?.cache).toBe("no-store");
});

it("keeps the last contact when requests fail or are cancelled", async () => {
  useServerConnection.setState({ lastContactAt: 1000 });
  for (const error of [
    new TypeError("Failed to fetch"),
    new DOMException("aborted", "AbortError"),
  ]) {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(aviationFetch(url)).rejects.toBe(error);
    expect(useServerConnection.getState().lastContactAt).toBe(1000);
  }
});

it("counts a server HTTP error as contact without hiding the error response", async () => {
  vi.spyOn(Date, "now").mockReturnValue(5000);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(new Response("upstream unavailable", { status: 502 })),
  );
  expect((await aviationFetch(url)).status).toBe(502);
  expect(useServerConnection.getState().lastContactAt).toBe(5000);
});

it("ignores responses from the separate local logbook proxy", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
  await aviationFetch(new URL("http://localhost/flight-sync/logbook"));
  expect(useServerConnection.getState().lastContactAt).toBeNull();
});
