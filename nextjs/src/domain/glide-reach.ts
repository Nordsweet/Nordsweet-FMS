import {
  type GlideGrid,
  type GlideReach,
  type GlideWind,
} from "~/data/terrain";
import { gridLocation } from "./terrain";
import { toRad, angleDiffDeg } from "./angles";
import { initialBearingDeg, distanceNm, type LatLon } from "./geo";

const DIRECTIONS = [
  [1, 0],
  [2, 1],
  [1, 1],
  [1, 2],
  [0, 1],
  [-1, 2],
  [-1, 1],
  [-2, 1],
  [-1, 0],
  [-2, -1],
  [-1, -1],
  [-1, -2],
  [0, -1],
  [1, -2],
  [1, -1],
  [2, -1],
] as const;
const HEADINGS = DIRECTIONS.map(
  ([x, y]) => ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360,
);
const COUNT = DIRECTIONS.length;

/** Wind triangle for a desired ground track. Crosswind cannot be silently treated as headwind. */
export function glideGroundSpeedKt(
  tasKt: number,
  wind: GlideWind,
  trackDeg: number,
) {
  const a = toRad(trackDeg),
    along = wind.eastKt * Math.sin(a) + wind.northKt * Math.cos(a);
  const cross = wind.eastKt * Math.cos(a) - wind.northKt * Math.sin(a);
  if (!(tasKt > 0) || Math.abs(cross) >= tasKt) return null;
  const speed = Math.sqrt(tasKt ** 2 - cross ** 2) + along;
  return speed > 1 ? speed : null;
}
export function measuredTasKt(gsKt: number, trackDeg: number, wind: GlideWind) {
  return Math.hypot(
    gsKt * Math.sin(toRad(trackDeg)) - wind.eastKt,
    gsKt * Math.cos(toRad(trackDeg)) - wind.northKt,
  );
}

class MinHeap {
  private rows: { state: number; cost: number }[] = [];
  push(value: { state: number; cost: number }) {
    let i = this.rows.length;
    this.rows.push(value);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.rows[p]!.cost <= value.cost) break;
      this.rows[i] = this.rows[p]!;
      i = p;
    }
    this.rows[i] = value;
  }
  pop() {
    const first = this.rows[0],
      last = this.rows.pop();
    if (!first || !last) return null;
    if (this.rows.length) {
      let i = 0;
      while (2 * i + 1 < this.rows.length) {
        let j = 2 * i + 1;
        if (
          j + 1 < this.rows.length &&
          this.rows[j + 1]!.cost < this.rows[j]!.cost
        )
          j++;
        if (this.rows[j]!.cost >= last.cost) break;
        this.rows[i] = this.rows[j]!;
        i = j;
      }
      this.rows[i] = last;
    }
    return first;
  }
}

/** Independent heading-aware minimum-height-loss search; no XCSoar GPL implementation is copied. */
export function solveGlideReach(grid: GlideGrid): GlideReach {
  const { input, size, half, heights } = grid;
  if (
    size > 161 ||
    size < 3 ||
    !Number.isFinite(input.altitudeM) ||
    input.sinkFpm < 50 ||
    input.tasKt <= 0 ||
    !Number.isFinite(
      input.sinkFpm + input.tasKt + input.wind.eastKt + input.wind.northKt,
    ) ||
    input.clearanceM < 0
  )
    throw Error("Invalid glide model");
  const cells = size * size,
    origin = half * size + half;
  const loss = new Float64Array(cells * COUNT).fill(Infinity);
  const parent = new Int32Array(cells * COUNT).fill(-1),
    bestState = new Int32Array(cells).fill(-1);
  const arrivalM = new Float32Array(cells).fill(-Infinity);
  const sinkMps = (input.sinkFpm * 0.3048) / 60;
  const heap = new MinHeap();
  // A turning aircraft can sweep two radii from its turn initiation point. The
  // maximum DEM in that disk's bounding square must clear the entire turn.
  const radiusM = (input.tasKt * 1852) / 3600 / (Math.PI / 60);
  const windDriftM =
    ((Math.hypot(input.wind.eastKt, input.wind.northKt) * 1852) / 3600) * 30;
  const turnCells = Math.ceil((2 * radiusM + windDriftM) / input.stepM);
  const turns = new Float32Array(cells);
  const horizontal = new Float32Array(cells);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let max = -Infinity;
      for (let k = x - turnCells; k <= x + turnCells; k++) {
        const value = k < 0 || k >= size ? NaN : heights[y * size + k]!;
        if (!Number.isFinite(value)) {
          max = NaN;
          break;
        }
        max = Math.max(max, value);
      }
      horizontal[y * size + x] = max;
    }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let max = -Infinity;
      for (let k = y - turnCells; k <= y + turnCells; k++) {
        const value = k < 0 || k >= size ? NaN : horizontal[k * size + x]!;
        if (!Number.isFinite(value)) {
          max = NaN;
          break;
        }
        max = Math.max(max, value);
      }
      turns[y * size + x] = max;
    }
  const costs = DIRECTIONS.map(([dx, dy], h) => {
    const gs = glideGroundSpeedKt(input.tasKt, input.wind, HEADINGS[h]!);
    return gs === null
      ? Infinity
      : ((Math.hypot(dx, dy) * input.stepM) / ((gs * 1852) / 3600)) * sinkMps;
  });
  if (
    Number.isFinite(heights[origin]) &&
    input.altitudeM >= heights[origin]! + input.clearanceM
  ) {
    for (let h = 0; h < COUNT; h++) {
      const state = origin * COUNT + h;
      loss[state] = 0;
      heap.push({ state, cost: 0 });
    }
    arrivalM[origin] = input.altitudeM;
  }
  // Edges are shared by every incoming heading. Check terrain once per edge,
  // not on every heap expansion; this keeps the same conservative geometry.
  const edgeHeight = new Float32Array(cells * COUNT).fill(NaN);
  const destination = new Int32Array(cells * COUNT).fill(-1);
  for (let cell = 0; cell < cells; cell++) {
    const x = cell % size,
      y = Math.floor(cell / size);
    for (let h = 0; h < COUNT; h++) {
      const [dx, dy] = DIRECTIONS[h]!,
        nx = x + dx,
        ny = y + dy;
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= size ||
        ny >= size ||
        Math.hypot(nx - half, ny - half) * input.stepM > input.radiusM
      )
        continue;
      let maximum = -Infinity;
      for (let ey = Math.min(y, ny); ey <= Math.max(y, ny); ey++)
        for (let ex = Math.min(x, nx); ex <= Math.max(x, nx); ex++)
          maximum = Math.max(maximum, heights[ey * size + ex]!);
      const edge = cell * COUNT + h;
      edgeHeight[edge] = maximum;
      destination[edge] = ny * size + nx;
    }
  }
  const transitions = HEADINGS.map((from) =>
    HEADINGS.flatMap((to, h) => {
      const change = Math.abs(angleDiffDeg(from, to));
      return change <= 90.001 ? [{ h, turnLoss: (change / 3) * sinkMps }] : [];
    }),
  );
  let item;
  while ((item = heap.pop())) {
    if (item.cost > loss[item.state]! + 0.0001) continue;
    const cell = Math.floor(item.state / COUNT),
      heading = item.state % COUNT;
    for (const { h, turnLoss } of transitions[heading]!) {
      const edge = cell * COUNT + h,
        next = destination[edge]!,
        height = edgeHeight[edge]!;
      if (next < 0 || !Number.isFinite(height)) continue;
      const turningLoss = cell === origin ? 0 : turnLoss;
      const nextLoss = item.cost + costs[h]! + turningLoss,
        state = next * COUNT + h;
      if (
        !(nextLoss < loss[state]!) ||
        input.altitudeM - nextLoss < height + input.clearanceM
      )
        continue;
      if (
        turningLoss > 0 &&
        (!Number.isFinite(turns[cell]) ||
          input.altitudeM - nextLoss < turns[cell]! + input.clearanceM)
      )
        continue;
      loss[state] = nextLoss;
      parent[state] = item.state;
      heap.push({ state, cost: nextLoss });
      if (input.altitudeM - nextLoss > arrivalM[next]!) {
        arrivalM[next] = input.altitudeM - nextLoss;
        bestState[next] = state;
      }
    }
  }
  const polygons: [number, number][][] = [],
    segments: [number, number][][] = [];
  let visited = 0,
    unknown = 0,
    limited = false;
  const point = (x: number, y: number): [number, number] => {
    const p = gridLocation(
      input.origin,
      (x - half - 0.5) * input.stepM,
      (half - y + 0.5) * input.stepM,
    );
    return [p.lon, p.lat];
  };
  const reached = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < size &&
    y < size &&
    Number.isFinite(arrivalM[y * size + x]);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (!Number.isFinite(heights[y * size + x])) unknown++;
      if (!reached(x, y)) continue;
      visited++;
      const p = [
        point(x, y),
        point(x + 1, y),
        point(x + 1, y + 1),
        point(x, y + 1),
      ];
      polygons.push([...p, p[0]!]);
      for (const [dx, dy, a, b] of [
        [0, -1, 0, 1],
        [1, 0, 1, 2],
        [0, 1, 2, 3],
        [-1, 0, 3, 0],
      ])
        if (!reached(x + dx!, y + dy!)) segments.push([p[a!]!, p[b!]!]);
      if (
        Math.hypot(x - half, y - half) * input.stepM >
        input.radiusM - 2 * input.stepM
      )
        limited = true;
    }
  return {
    polygons,
    paths: segments,
    arrivalM,
    parent,
    bestState,
    size,
    half,
    stepM: input.stepM,
    origin: input.origin,
    altitudeM: input.altitudeM,
    clearanceM: input.clearanceM,
    visited,
    unknown,
    limited,
    terrainM: heights,
  };
}

export function glideCell(reach: GlideReach, location: LatLon) {
  const distance = distanceNm(reach.origin, location) * 1852,
    bearing = toRad(initialBearingDeg(reach.origin, location));
  const x = Math.round(
      reach.half + (distance * Math.sin(bearing)) / reach.stepM,
    ),
    y = Math.round(reach.half - (distance * Math.cos(bearing)) / reach.stepM);
  return x < 0 || y < 0 || x >= reach.size || y >= reach.size
    ? -1
    : y * reach.size + x;
}

/** Exact parent-state chain preserves terrain detours; a convex hull would incorrectly fill blocked peaks. */
export function glidePathTo(
  reach: GlideReach,
  location: LatLon,
): LatLon[] | null {
  const cell = glideCell(reach, location);
  if (cell < 0 || !Number.isFinite(reach.arrivalM[cell])) return null;
  let state = reach.bestState[cell]!,
    limit = reach.parent.length;
  const points: LatLon[] = [];
  while (state >= 0 && limit-- > 0) {
    const index = Math.floor(state / COUNT),
      x = index % reach.size,
      y = Math.floor(index / reach.size);
    points.push(
      gridLocation(
        reach.origin,
        (x - reach.half) * reach.stepM,
        (reach.half - y) * reach.stepM,
      ),
    );
    state = reach.parent[state]!;
  }
  points.push(reach.origin);
  return points.reverse();
}

/** Re-check the complete displayed approach, including its full final, against DEM and wind. */
export function glideApproachClear(
  reach: GlideReach,
  input: GlideGrid["input"],
  path: LatLon[],
  threshold: LatLon & { elevationFt: number },
) {
  let altitude = input.altitudeM;
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]!,
      to = path[i]!,
      length = distanceNm(from, to) * 1852;
    const speed = glideGroundSpeedKt(
      input.tasKt,
      input.wind,
      initialBearingDeg(from, to),
    );
    if (speed === null) return false;
    const loss =
      ((length / ((speed * 1852) / 3600)) * input.sinkFpm * 0.3048) / 60;
    const count = Math.max(1, Math.ceil(length / (reach.stepM / 3)));
    for (let j = 0; j <= count; j++) {
      const p = gridLocation(
        from,
        ((((to.lon - from.lon) * Math.PI) / 180) *
          6371008.8 *
          Math.cos(toRad(from.lat)) *
          j) /
          count,
        ((((to.lat - from.lat) * Math.PI) / 180) * 6371008.8 * j) / count,
      );
      const cell = glideCell(reach, p);
      if (cell < 0) return false;
      const terrain = reach.terrainM[cell]!;
      const remaining = altitude - (loss * j) / count;
      const clearance =
        reach.clearanceM *
        (i === path.length - 1
          ? Math.min(1, distanceNm(p, threshold) / 0.5)
          : 1);
      if (!Number.isFinite(terrain) || remaining < terrain + clearance)
        return false;
    }
    altitude -= loss;
  }
  return altitude >= threshold.elevationFt * 0.3048;
}
