import { describe, expect, it } from "vitest";

import { summarizeTrack, toGpx } from "./track";

const track = [
  { lat: 50, lon: 19, altitudeFt: 1000, time: "2026-10-12T10:00:00.000Z" },
  { lat: 50, lon: 19.5, altitudeFt: 3000, time: "2026-10-12T10:12:00.000Z" },
  { lat: 50, lon: 20, altitudeFt: null, time: "2026-10-12T10:24:00.000Z" },
];

describe("track", () => {
  it("summarizes time, distance and max altitude", () => {
    const s = summarizeTrack(track);
    expect(s.minutes).toBe(24);
    expect(s.distanceNm).toBeCloseTo(38.6, 1);
    expect(s.maxAltitudeFt).toBe(3000);
  });

  it("writes GPX with escaped names and metres", () => {
    const gpx = toGpx(track, "EPKK <> EPNT & back");
    expect(gpx).toContain("<name>EPKK &lt;&gt; EPNT &amp; back</name>");
    expect(gpx).toContain(
      '<trkpt lat="50.000000" lon="19.500000"><ele>914.4</ele>',
    );
    expect(gpx.match(/<trkpt/g)).toHaveLength(3);
  });
});
