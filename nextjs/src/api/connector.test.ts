import { describe, expect, it, vi, afterEach } from "vitest";
import {
  connectorWebSocketUrl,
  parseConnectorFrame,
  connectTelemetry,
} from "./connector";

const frame = {
  schemaVersion: 1,
  source: "prepar3d-v5",
  connected: true,
  paused: false,
  stale: false,
  ageMs: 10,
  receivedAt: "2026-10-18T12:00:00.1234567Z",
  data: {
    latitude: 52,
    longitude: 21,
    altitudeMslFt: 2500,
    altitudeAglFt: 2100,
    indicatedAltitudeFt: 2600,
    groundSpeedKt: 110,
    indicatedAirspeedKt: 100,
    trueAirspeedKt: 105,
    headingTrueDeg: 90,
    headingMagneticDeg: 85,
    trackTrueDeg: 92,
    verticalSpeedFpm: -300,
    pitchDeg: 2,
    bankDeg: -10,
    onGround: 0,
  },
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("Connector transport", () => {
  it("uses WSS with an encoded credential and rejects mixed content", () => {
    const url = new URL(
      connectorWebSocketUrl(
        "https://pc.test.ts.net:8767/#secret",
        "a+b&c",
        true,
      ),
    );
    expect(url.protocol).toBe("wss:");
    expect(url.pathname).toBe("/ws");
    expect(url.searchParams.get("token")).toBe("a+b&c");
    expect(url.hash).toBe("");
    expect(() =>
      connectorWebSocketUrl("http://localhost:8767", "token", true),
    ).toThrow();
    expect(() =>
      connectorWebSocketUrl(
        "https://user:password@pc.test.ts.net",
        "token",
        true,
      ),
    ).toThrow();
    expect(() =>
      connectorWebSocketUrl("https://pc.test.ts.net", "", true),
    ).toThrow();
  });
  it("accepts the native C# frame and rejects invalid coordinates and nonfinite values", () => {
    expect(parseConnectorFrame(frame)?.data?.altitudeMslFt).toBe(2500);
    expect(
      parseConnectorFrame({ ...frame, data: { ...frame.data, latitude: 91 } }),
    ).toBeNull();
    expect(
      parseConnectorFrame({
        ...frame,
        data: { ...frame.data, groundSpeedKt: Infinity },
      }),
    ).toBeNull();
    expect(parseConnectorFrame({ ...frame, schemaVersion: 2 })).toBeNull();
    expect(
      parseConnectorFrame({ ...frame, data: null, connected: false }),
    ).not.toBeNull();
  });
  it("drops stale frames, detects silence, reconnects and stops cleanly", () => {
    vi.useFakeTimers();
    vi.stubGlobal("location", { protocol: "https:" });
    class Socket {
      static instances: Socket[] = [];
      onmessage?: (event: { data: string }) => void;
      onclose?: () => void;
      constructor() {
        Socket.instances.push(this);
      }
      close() {
        this.onclose?.();
      }
    }
    vi.stubGlobal("WebSocket", Socket);
    const receive = vi.fn(),
      status = vi.fn();
    const stop = connectTelemetry(
      "https://pc.test.ts.net",
      "token",
      receive,
      status,
    );
    const socket = Socket.instances[0]!;
    socket.onmessage?.({ data: JSON.stringify(frame) });
    expect(receive).toHaveBeenCalledTimes(1);
    socket.onmessage?.({ data: JSON.stringify({ ...frame, stale: true }) });
    expect(receive).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenLastCalledWith("stale");
    socket.onmessage?.({ data: JSON.stringify({ ...frame, paused: true }) });
    expect(status).toHaveBeenLastCalledWith("paused");
    vi.advanceTimersByTime(3000);
    expect(status).toHaveBeenLastCalledWith("stale");
    vi.advanceTimersByTime(5500);
    expect(Socket.instances.length).toBe(2);
    stop();
    vi.advanceTimersByTime(10000);
    expect(Socket.instances.length).toBe(2);
  });
});
