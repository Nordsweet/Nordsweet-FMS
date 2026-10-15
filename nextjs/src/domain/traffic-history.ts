import { distanceNm } from "./geo";
const MAX_OBSERVATION_GAP_MS = 5 * 60_000;
export type TrafficSample = {
  lat: number;
  lon: number;
  sampledAt: number;
  callsign: string;
};

/** Never join an airframe's previous flight to the current callsign segment. */
export function currentCallsignHistory(
  remote: TrafficSample[],
  local: TrafficSample[],
  callsign: string | null,
) {
  const normalize = (value: string) =>
    value.trim().toUpperCase().replace(/\s+/g, "");
  // Collector history can be sparser than local polling, including between its
  // first and last samples. Keep those observations instead of discarding them.
  const observations = new Map<number, TrafficSample>();
  for (const sample of [...remote, ...local]) {
    const existing = observations.get(sample.sampledAt);
    observations.set(sample.sampledAt, {
      ...sample,
      callsign: sample.callsign.trim()
        ? sample.callsign
        : (existing?.callsign ?? ""),
    });
  }
  const merged = [...observations.values()].sort(
    (a, b) => a.sampledAt - b.sampledAt,
  );
  const key =
    normalize(callsign ?? "") ||
    normalize(
      [...merged].reverse().find((sample) => sample.callsign.trim())
        ?.callsign ?? "",
    );
  let start = merged.length;
  while (start > 0) {
    const sampleKey = merged[start - 1]!.callsign.trim()
      .toUpperCase()
      .replace(/\s+/g, "");
    if (key && sampleKey && sampleKey !== key) break;
    start--;
  }
  return merged.slice(start);
}

export function appendTrafficSample(
  history: TrafficSample[],
  sample: TrafficSample,
) {
  const last = history.at(-1);
  const next =
    last && sample.sampledAt <= last.sampledAt
      ? history
      : last?.callsign === sample.callsign && distanceNm(last, sample) < 0.015
        ? [...history.slice(0, -1), sample]
        : [...history, sample];
  return next
    .filter((p) => p.sampledAt >= sample.sampledAt - 6 * 3600000)
    .slice(-1440);
}

/** Provider pseudo-callsigns are identifiers, not flight callsigns. */
export function trafficCallsign(value: string | null | undefined) {
  const callsign = value?.trim().toUpperCase() ?? "";
  return /^(ICA|FLR|OGN|SKY)[0-9A-F]{6}$/.test(callsign) ? "" : callsign;
}

/** A five-minute observation gap must never appear as a confirmed flown line. */
export function trafficTrailSegments(samples: TrafficSample[]) {
  const groups: number[][][] = [];
  samples.forEach((point, index) => {
    if (
      !index ||
      point.sampledAt - samples[index - 1]!.sampledAt > MAX_OBSERVATION_GAP_MS
    )
      groups.push([]);
    groups.at(-1)!.push([point.lon, point.lat]);
  });
  return groups.filter((group) => group.length >= 2);
}

/** Link coverage gaps visually without presenting the missing interval as a confirmed track. */
export function trafficTrailGaps(samples: TrafficSample[]) {
  return samples.flatMap((point, index) => {
    const previous = samples[index - 1];
    return previous &&
      point.sampledAt - previous.sampledAt > MAX_OBSERVATION_GAP_MS
      ? [
          [
            [previous.lon, previous.lat],
            [point.lon, point.lat],
          ],
        ]
      : [];
  });
}
