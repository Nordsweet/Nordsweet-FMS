import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";

/** Just enough of the Cache API: a cache is a map of URL to Response. */
class FakeCache {
  entries = new Map<string, Response>();
  async match(url: string) {
    return this.entries.get(url)?.clone();
  }
  async put(url: string, response: Response) {
    this.entries.set(url, response);
  }
  async addAll(urls: string[]) {
    for (const url of urls) this.entries.set(url, new Response(`new ${url}`));
  }
}
class FakeCaches {
  all = new Map<string, FakeCache>();
  async open(name: string) {
    if (!this.all.has(name)) this.all.set(name, new FakeCache());
    return this.all.get(name)!;
  }
  async keys() {
    return [...this.all.keys()];
  }
}

/** Run the real worker script for one release and fire its install event. */
async function install(
  caches: FakeCaches,
  release: { version: string; urls: string[]; hashes: Record<string, string> },
) {
  const listeners = new Map<string, (event: unknown) => void>();
  const self = {
    NORDSWEET_PRECACHE: release,
    addEventListener: (type: string, fn: (event: unknown) => void) =>
      listeners.set(type, fn),
    skipWaiting: vi.fn(),
  };
  new Function("self", "caches", "importScripts", "Response", "URL", script)(
    self,
    caches,
    () => undefined,
    Response,
    URL,
  );
  let done: Promise<unknown> = Promise.resolve();
  listeners.get("install")!({ waitUntil: (p: Promise<unknown>) => (done = p) });
  await done;
}
const script = fs.readFileSync("public/sw.js", "utf8");
const release = (version: string, files: Record<string, string>) => ({
  version,
  urls: Object.keys(files),
  hashes: files,
});

describe("service worker precache", () => {
  it("downloads everything on the first install", async () => {
    const caches = new FakeCaches();
    await install(caches, release("1", { "/a.js": "h1", "/b.js": "h2" }));
    const cache = caches.all.get("nordsweet-next-1")!;
    expect(await (await cache.match("/a.js"))!.text()).toBe("new /a.js");
  });

  it("copies unchanged files from the previous release and downloads only the changed ones", async () => {
    const caches = new FakeCaches();
    await install(caches, release("1", { "/a.js": "h1", "/b.js": "h2" }));
    const old = caches.all.get("nordsweet-next-1")!;
    old.entries.set("/a.js", new Response("kept copy"));
    await install(caches, release("2", { "/a.js": "h1", "/b.js": "h3" }));
    const next = caches.all.get("nordsweet-next-2")!;
    expect(await (await next.match("/a.js"))!.text()).toBe("kept copy");
    expect(await (await next.match("/b.js"))!.text()).toBe("new /b.js");
  });

  it("never reuses a cache whose install did not finish", async () => {
    const caches = new FakeCaches();
    const partial = await caches.open("nordsweet-next-1");
    partial.entries.set("/a.js", new Response("half written"));
    await install(caches, release("2", { "/a.js": "h1" }));
    const next = caches.all.get("nordsweet-next-2")!;
    expect(await (await next.match("/a.js"))!.text()).toBe("new /a.js");
  });
});
