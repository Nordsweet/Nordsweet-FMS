import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "~/api";
import { newFlight } from "~/data/flight";
import { flightSnapshotSchema, type ServerFlight } from "~/data/flight-session";
import { flightTrackName, recoveredFlight } from "~/domain/flight-session";
import { useFlight } from "./flight";
import { useInFlight } from "./inflight";
import {
  captureFlight,
  checkPreviousFlight,
  continuePreviousFlight,
  declinePreviousFlight,
  flushFlights,
  useFlightSync,
} from "./flight-sync";
import { FlightSyncError } from "~/api/flight-sync";

const first = {
  lat: 50,
  lon: 20,
  altitudeFt: 5000,
  time: "2026-10-19T21:30:00.000Z",
};
const second = { ...first, lat: 50.1, time: "2026-10-19T21:30:05.000Z" };
function remote(): ServerFlight {
  const pending = captureFlight()!;
  return {
    ...pending,
    revision: 1,
    ended: false,
    updatedAt: pending.startedAt,
    track: [first],
  };
}
beforeEach(() => {
  vi.restoreAllMocks();
  useFlight.getState().load({ ...newFlight(), registration: "SP-OKO" });
  useInFlight.getState().start([
    { ident: "EPNT", lat: 50, lon: 20 },
    { ident: "EPKK", lat: 51, lon: 20 },
  ]);
  useInFlight.setState({ track: [first], phase: "cruise" });
  useFlightSync.setState({
    token: "a".repeat(64),
    pending: [],
    upload: null,
    phase: "ready",
    candidate: null,
    busy: false,
    error: null,
    lastSyncAt: null,
  });
});

describe("durable flight checkpoints", () => {
  it("labels the frozen registration and local start minute, without minute collisions in identity", () => {
    const at = new Date(2026, 9, 19, 23, 30).toISOString();
    expect(flightTrackName("SP-OKO", at)).toBe("SPOKO1910262330");
    const a = captureFlight()!;
    useFlight.getState().update({ registration: "SP-NEW" });
    const b = captureFlight()!;
    expect(b.id).toBe(a.id);
    expect(b.name).toBe(a.name);
    expect(b.registration).toBe("SPOKO");
    expect(flightSnapshotSchema.safeParse(b.snapshot).success).toBe(true);
  });
  it("waits for a choice, downloads the remote prefix and retains an unsent local tail", async () => {
    const cloud = remote();
    useInFlight.setState({ track: [first, second] });
    captureFlight();
    vi.spyOn(api.flightSync.latest, "call").mockResolvedValue(cloud);
    vi.spyOn(api.flightSync.get, "call").mockResolvedValue(cloud);
    await checkPreviousFlight();
    expect(useFlightSync.getState().phase).toBe("prompt");
    await continuePreviousFlight();
    expect(useInFlight.getState().track).toEqual([first, second]);
    expect(useInFlight.getState().phase).toBe("cruise");
    expect(useFlightSync.getState().phase).toBe("ready");
    expect(useFlightSync.getState().pending[0]!.trackCount).toBe(1);
  });
  it("restores a remote-only flight when the local flight state was lost", async () => {
    const cloud = remote();
    useFlightSync.setState({ pending: [] });
    useInFlight.setState({ startedAt: null, track: [] });
    useFlight.getState().reset();
    vi.spyOn(api.flightSync.latest, "call").mockResolvedValue(cloud);
    vi.spyOn(api.flightSync.get, "call").mockResolvedValue(cloud);
    await checkPreviousFlight();
    await continuePreviousFlight();
    expect(useFlight.getState().flight.registration).toBe("SP-OKO");
    expect(useInFlight.getState().track).toEqual([first]);
    expect(useInFlight.getState().route).toEqual(cloud.snapshot.inflight.route);
  });
  it("retries the exact request after a lost acknowledgement without dropping newer points", async () => {
    captureFlight();
    const upload = vi
      .spyOn(api.flightSync.save, "call")
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ revision: 1, trackCount: 1 })
      .mockResolvedValueOnce({ revision: 2, trackCount: 2 });
    await flushFlights();
    expect(useFlightSync.getState().error).toBe("offline");
    useInFlight.setState({ track: [first, second] });
    captureFlight();
    await flushFlights();
    expect(upload.mock.calls[1]![0].flight).toEqual(
      upload.mock.calls[0]![0].flight,
    );
    expect(useFlightSync.getState().pending[0]!.track).toEqual([first, second]);
    await flushFlights();
    expect(upload.mock.calls[2]![0].flight.trackCount).toBe(1);
    expect(useFlightSync.getState().pending[0]!.trackCount).toBe(2);
  });
  it("keeps a completed flight queued until its final track and snapshot are acknowledged", async () => {
    const prior = captureFlight()!;
    useInFlight.getState().end();
    captureFlight();
    vi.spyOn(api.flightSync.save, "call").mockResolvedValue({
      revision: 1,
      trackCount: 1,
    });
    expect(
      useFlightSync.getState().pending[0]!.snapshot.inflight.startedAt,
    ).toBeNull();
    await flushFlights();
    expect(useFlightSync.getState().pending).toEqual([]);
    expect(captureFlight()).toBeNull();
    expect(prior.track).toEqual([first]);
  });
  it("declining archives the previous flight and preserves its track for upload", () => {
    const candidate = captureFlight()!;
    useFlightSync.setState({ candidate, phase: "prompt" });
    declinePreviousFlight();
    expect(
      useFlightSync.getState().pending[0]!.snapshot.inflight.startedAt,
    ).toBeNull();
    expect(useFlightSync.getState().pending[0]!.track).toEqual([first]);
    expect(useInFlight.getState().startedAt).toBeNull();
  });
  it("blocks conflicting writers instead of overwriting a newer checkpoint", async () => {
    captureFlight();
    const upload = vi
      .spyOn(api.flightSync.save, "call")
      .mockRejectedValue(new FlightSyncError(409));
    await flushFlights();
    await flushFlights();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(useFlightSync.getState().error).toBe("conflict");
  });
  it("rejects a different track prefix in favor of the downloaded record", () => {
    const cloud = remote();
    const local = captureFlight()!;
    local.track = [{ ...first, lat: 49 }, second];
    expect(recoveredFlight(cloud, local).track).toEqual([first]);
  });
  it("retains an uncertain request when the browser cannot fit it in a final keepalive", async () => {
    captureFlight();
    const upload = vi
      .spyOn(api.flightSync.save, "call")
      .mockRejectedValueOnce(new Error("ack lost"))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ revision: 1, trackCount: 1 });
    await flushFlights();
    const uncertain = useFlightSync.getState().upload;
    useInFlight.setState({ track: [first, second] });
    captureFlight();
    await flushFlights(true);
    expect(useFlightSync.getState().upload).toBe(uncertain);
    await flushFlights();
    expect(upload.mock.calls[2]![0].flight).toEqual(uncertain);
    expect(useFlightSync.getState().pending[0]!.track).toEqual([first, second]);
  });
  it("does not offer a locally completed flight while its final checkpoint is still offline", async () => {
    const cloud = remote();
    useInFlight.getState().end();
    captureFlight();
    vi.spyOn(api.flightSync.latest, "call").mockResolvedValue(cloud);
    await checkPreviousFlight();
    expect(useFlightSync.getState().phase).toBe("ready");
    expect(useFlightSync.getState().candidate).toBeNull();
    expect(
      useFlightSync.getState().pending[0]!.snapshot.inflight.startedAt,
    ).toBeNull();
  });
});
