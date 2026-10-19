import { z } from "zod";

export type ConnectorStatus =
  | "off"
  | "connecting"
  | "live"
  | "paused"
  | "stale"
  | "disconnected"
  | "invalid";
const finite = z.number().finite();
const frameSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.enum(["prepar3d-v5", "demo"]),
  connected: z.boolean(),
  paused: z.boolean(),
  stale: z.boolean(),
  ageMs: finite.nonnegative().nullable(),
  receivedAt: z.string().datetime({ offset: true }).nullable(),
  data: z
    .object({
      latitude: finite.min(-90).max(90),
      longitude: finite.min(-180).max(180),
      altitudeMslFt: finite,
      altitudeAglFt: finite,
      indicatedAltitudeFt: finite,
      groundSpeedKt: finite.nonnegative(),
      indicatedAirspeedKt: finite.nonnegative(),
      trueAirspeedKt: finite.nonnegative(),
      headingTrueDeg: finite,
      headingMagneticDeg: finite,
      trackTrueDeg: finite,
      verticalSpeedFpm: finite,
      pitchDeg: finite,
      bankDeg: finite,
      onGround: finite,
    })
    .nullable(),
});
export type ConnectorFrame = z.infer<typeof frameSchema>;

export function connectorWebSocketUrl(
  url: string,
  token: string,
  secure: boolean,
) {
  const endpoint = new URL(url);
  if (
    !["http:", "https:", "ws:", "wss:"].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    !token.trim()
  )
    throw new Error("invalid");
  if (secure && !["https:", "wss:"].includes(endpoint.protocol))
    throw new Error("invalid");
  endpoint.protocol = ["https:", "wss:"].includes(endpoint.protocol)
    ? "wss:"
    : "ws:";
  endpoint.pathname = "/ws";
  endpoint.search = "";
  endpoint.hash = "";
  endpoint.searchParams.set("token", token.trim());
  return endpoint.href;
}

export function parseConnectorFrame(value: unknown): ConnectorFrame | null {
  const result = frameSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** One connection shared by all position consumers; liveness never depends on GPS fallback. */
export function connectTelemetry(
  url: string,
  token: string,
  receive: (frame: ConnectorFrame) => void,
  status: (value: ConnectorStatus) => void,
) {
  let endpoint: string;
  try {
    endpoint = connectorWebSocketUrl(
      url,
      token,
      location.protocol === "https:",
    );
  } catch {
    status("invalid");
    return () => undefined;
  }
  let stopped = false,
    socket: WebSocket | undefined,
    retry: ReturnType<typeof setTimeout> | undefined;
  let lastMessage = Date.now();
  const connect = () => {
    if (stopped) return;
    status("connecting");
    lastMessage = Date.now();
    const current = (socket = new WebSocket(endpoint));
    current.onmessage = (event: MessageEvent<string>) => {
      if (stopped || socket !== current) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        status("invalid");
        return;
      }
      const frame = parseConnectorFrame(parsed);
      if (!frame) {
        status("invalid");
        return;
      }
      lastMessage = Date.now();
      if (
        !frame.connected ||
        frame.stale ||
        !frame.data ||
        frame.ageMs === null ||
        frame.ageMs > 2000 ||
        !frame.receivedAt
      ) {
        status("stale");
        return;
      }
      receive(frame);
      status(frame.paused ? "paused" : "live");
    };
    current.onclose = () => {
      if (stopped || socket !== current) return;
      status("disconnected");
      retry = setTimeout(connect, 3000);
    };
    current.onerror = () => current.close();
  };
  const watchdog = setInterval(() => {
    if (Date.now() - lastMessage > 2500) status("stale");
    if (Date.now() - lastMessage > 5000) socket?.close();
  }, 500);
  connect();
  return () => {
    stopped = true;
    clearInterval(watchdog);
    clearTimeout(retry);
    socket?.close();
  };
}

/**
 * Pass on the newest value at most once per `ms`: the first goes through at once, later ones wait
 * for the interval. A connector sends several frames a second and every one re-renders the Fly page.
 */
export function throttleLatest<T>(send: (value: T) => void, ms: number) {
  let last = -Infinity,
    pending: { value: T } | undefined,
    timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    timer = undefined;
    if (!pending) return;
    const { value } = pending;
    pending = undefined;
    last = Date.now();
    send(value);
  };
  const throttled = (value: T) => {
    pending = { value };
    if (timer !== undefined) return;
    const wait = last + ms - Date.now();
    if (wait <= 0) flush();
    else timer = setTimeout(flush, wait);
  };
  throttled.cancel = () => {
    clearTimeout(timer);
    timer = pending = undefined;
  };
  return throttled;
}
