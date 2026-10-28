import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAuth } from "~/stores/auth";
import { loadChartCatalog, loadChartPdf } from "./charts";

const disk = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock("idb-keyval", () => disk);
let stored: Map<string, unknown>;
beforeEach(() => {
  stored = new Map();
  disk.get
    .mockReset()
    .mockImplementation(async (key: string) => stored.get(key));
  disk.set
    .mockReset()
    .mockImplementation(async (key: string, value: unknown) => {
      stored.set(key, value);
    });
  useAuth.setState({
    session: { token: "chart-test-token", username: "pilot", role: "user" },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useAuth.setState({ session: null });
});
const pdf = {
  kind: "aip" as const,
  id: "a".repeat(64),
  sha256: "b".repeat(64),
};

it("shares concurrent PDF downloads, uses the bearer header and reopens immutable bytes offline", async () => {
  const request = vi.fn().mockResolvedValue(
    new Response("%PDF-1.7\nfixture", {
      headers: { "Content-Type": "application/pdf" },
    }),
  );
  vi.stubGlobal("fetch", request);
  const [a, b] = await Promise.all([loadChartPdf(pdf), loadChartPdf(pdf)]);
  expect(a).toBe(b);
  expect(request).toHaveBeenCalledTimes(1);
  const [url, init] = request.mock.calls[0] as [URL, RequestInit];
  expect(url.pathname).toBe(`/charts/pdf/${pdf.id}`);
  expect(url.search).toBe("");
  expect(new Headers(init.headers).get("Authorization")).toBe(
    "Bearer chart-test-token",
  );
  request.mockRejectedValue(new TypeError("offline"));
  expect(await (await loadChartPdf(pdf)).text()).toBe("%PDF-1.7\nfixture");
  expect(request).toHaveBeenCalledTimes(1);
});

it("still opens a live PDF if device storage is full, and rejects non-PDF responses", async () => {
  disk.set.mockRejectedValue(new DOMException("quota", "QuotaExceededError"));
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("%PDF-1.7\nfixture")),
  );
  expect((await loadChartPdf(pdf)).size).toBeGreaterThan(5);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("<html>failure</html>")),
  );
  await expect(
    loadChartPdf({ ...pdf, sha256: "c".repeat(64) }),
  ).rejects.toThrow("Invalid PDF");
});

it("refreshes a package at its UTC expiry and retains dated data if the refresh is offline", async () => {
  const clock = vi
    .spyOn(Date, "now")
    .mockReturnValue(Date.parse("2026-10-28T23:59:00Z"));
  const data = {
    packages: [
      {
        volume: "IFR",
        effective_from: "2026-10-01",
        effective_until: "2026-10-29",
        source_url: "https://docs.pansa.pl/",
        downloaded_at: "2026-10-28T22:00:00Z",
      },
    ],
    airports: [],
    charts: [],
  };
  const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(data)));
  vi.stubGlobal("fetch", request);
  expect(await loadChartCatalog()).toEqual(data);
  await loadChartCatalog();
  expect(request).toHaveBeenCalledTimes(1);
  clock.mockReturnValue(Date.parse("2026-10-29T00:00:00Z"));
  request.mockRejectedValue(new TypeError("offline"));
  expect(await loadChartCatalog()).toEqual(data);
  expect(request).toHaveBeenCalledTimes(2);
});

it("does not cache a server catalog that is still awaiting its initial import", async () => {
  const request = vi
    .fn()
    .mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ packages: [], airports: [], charts: [] }),
        ),
    );
  vi.stubGlobal("fetch", request);
  await expect(loadChartCatalog()).rejects.toThrow("AIP import is not ready");
  await expect(loadChartCatalog()).rejects.toThrow("AIP import is not ready");
  expect(request).toHaveBeenCalledTimes(2);
  expect(disk.set).not.toHaveBeenCalled();
});
