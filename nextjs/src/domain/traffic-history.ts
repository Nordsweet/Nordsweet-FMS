import { distanceNm } from "./geo";
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
  const key =
    normalize(callsign ?? "") ||
    normalize(
      [...remote, ...local].reverse().find((p) => p.callsign.trim())
        ?.callsign ?? "",
    );
  const last = remote.at(-1)?.sampledAt ?? -Infinity;
  const merged = [
    ...remote,
    ...local.filter((sample) => sample.sampledAt > last),
  ].sort((a, b) => a.sampledAt - b.sampledAt);
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
    if (!index || point.sampledAt - samples[index - 1]!.sampledAt > 300000)
      groups.push([]);
    groups.at(-1)!.push([point.lon, point.lat]);
  });
  return groups.filter((group) => group.length >= 2);
}
