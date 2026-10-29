export type GpxPoint = {
  kind: "trkpt" | "rtept" | "wpt";
  name: string;
  lat: number;
  lon: number;
  /** Text of <ele> and <time>; "" when absent. */
  ele: string;
  time: string;
};

/** Every track, route and waypoint of a GPX document in document order. Browser only (DOMParser). */
export function readGpx(text: string): GpxPoint[] {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length)
    throw new Error("gpx-invalid");
  // Namespace-agnostic, so prefixed (gpx:trkpt) documents read the same as default-namespace ones.
  const child = (node: Element, name: string) =>
    node.getElementsByTagNameNS("*", name)[0]?.textContent?.trim() ?? "";
  const coordinate = (node: Element, name: string) =>
    node.hasAttribute(name) ? Number(node.getAttribute(name)) : NaN;
  return [...doc.getElementsByTagName("*")]
    .filter((node) => ["trkpt", "rtept", "wpt"].includes(node.localName))
    .map((node) => ({
      kind: node.localName as GpxPoint["kind"],
      name: child(node, "name"),
      lat: coordinate(node, "lat"),
      lon: coordinate(node, "lon"),
      ele: child(node, "ele"),
      time: child(node, "time"),
    }));
}
