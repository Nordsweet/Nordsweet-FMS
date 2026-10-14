import { airspaceKind, polygonContainsPoint } from "./map-navigation";

/** Split a published zone designator from its descriptive name without inventing identifiers. */
export function airspaceCaption(name: string, classType: string) {
  const text = name.trim().replace(/\s+/g, " ");
  const numbered = /^(?:EP|LK)?([A-Z]{1,5})\s*0*(\d+[A-Z]?)(?:\s+|$)/i.exec(
    text,
  );
  if (numbered) {
    const kind = numbered[1]!
      .toUpperCase()
      .replace(/^TRA$/, "TR")
      .replace(/^TSA$/, "TS");
    return {
      title: `${kind} ${numbered[2]!.toUpperCase()}`,
      name: text.slice(numbered[0].length).trim(),
    };
  }
  const terminal =
    /^(MCTR|MTMA|MATZ|ATZ|CTR|TMA|ADIZ|RMZ|TMZ)\s+(EP[A-Z]{2}|LK[A-Z]{2})(?:\s+([A-Z]))?(?:\s+|$)/i.exec(
      text,
    );
  if (terminal)
    return {
      title: [terminal[1], terminal[2], terminal[3]]
        .filter(Boolean)
        .join(" ")
        .toUpperCase(),
      name: text.slice(terminal[0].length).trim(),
    };
  const kind = airspaceKind(text, classType);
  const title = kind === "OTHER" ? classType.toUpperCase() : kind;
  return {
    title,
    name: text.replace(new RegExp(`^${title}\\s*`, "i"), "").trim(),
  };
}

type Point = { x: number; y: number };
const contains = (rings: number[][][], p: Point) =>
  polygonContainsPoint(rings, { lon: p.x, lat: p.y });

/** The entire padded text rectangle must be inside the polygon, excluding holes and concave cuts. */
export function airspaceCaptionFits(
  rings: number[][][],
  center: Point,
  width: number,
  height: number,
) {
  const left = center.x - width / 2 - 3,
    right = center.x + width / 2 + 3;
  const top = center.y - height / 2 - 3,
    bottom = center.y + height / 2 + 3;
  if (
    ![
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
    ].every((p) => contains(rings, p))
  )
    return false;
  // Reject any polygon/hole edge entering the text box, even if all four corners lie inside.
  return !rings.some((ring) =>
    ring.some((a, i) => {
      const b = ring[(i + 1) % ring.length]!;
      let lo = 0,
        hi = 1;
      for (const [axis, min, max] of [
        [0, left, right],
        [1, top, bottom],
      ]) {
        const delta = b[axis!]! - a[axis!]!;
        if (Math.abs(delta) < 1e-12) {
          if (a[axis!]! < min! || a[axis!]! > max!) return false;
        } else {
          const t1 = (min! - a[axis!]!) / delta,
            t2 = (max! - a[axis!]!) / delta;
          lo = Math.max(lo, Math.min(t1, t2));
          hi = Math.min(hi, Math.max(t1, t2));
          if (lo > hi) return false;
        }
      }
      return true;
    }),
  );
}

/** Prefer the area center; if necessary find a nearby interior position that fits both lines. */
export function airspaceCaptionPlacement(
  rings: number[][][],
  textWidth: number,
  fullName: boolean,
) {
  const ring = rings[0];
  if (!ring?.length) return null;
  const xs = ring.map((p) => p[0]!),
    ys = ring.map((p) => p[1]!);
  const left = Math.min(...xs),
    right = Math.max(...xs),
    top = Math.min(...ys),
    bottom = Math.max(...ys);
  let area = 0,
    x = 0,
    y = 0;
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length]!;
    const cross = a[0]! * b[1]! - b[0]! * a[1]!;
    area += cross;
    x += (a[0]! + b[0]!) * cross;
    y += (a[1]! + b[1]!) * cross;
  });
  const center =
    Math.abs(area) > 1e-8
      ? { x: x / (3 * area), y: y / (3 * area) }
      : { x: (left + right) / 2, y: (top + bottom) / 2 };
  if (
    contains(rings, center) &&
    (!fullName || airspaceCaptionFits(rings, center, textWidth, 26))
  )
    return { ...center, fullName };
  const candidates: Point[] = [center];
  for (let row = 1; row < 8; row++)
    for (let col = 1; col < 8; col++)
      candidates.push({
        x: left + ((right - left) * col) / 8,
        y: top + ((bottom - top) * row) / 8,
      });
  candidates.sort(
    (a, b) =>
      (a.x - center.x) ** 2 +
      (a.y - center.y) ** 2 -
      ((b.x - center.x) ** 2 + (b.y - center.y) ** 2),
  );
  if (fullName) {
    const fitted = candidates.find((p) =>
      airspaceCaptionFits(rings, p, textWidth, 26),
    );
    if (fitted) return { ...fitted, fullName: true };
  }
  const point = candidates.find((p) => contains(rings, p));
  return point ? { ...point, fullName: false } : null;
}
