export type ExportPoint = {
  ident: string;
  lat: number;
  lon: number;
  altitudeFt: number;
};
export const escapeXml = (value: string | number) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
/** Legacy GPX/KML: named waypoints plus a continuous track, altitude rounded to metres. */
export function routeExport(
  name: string,
  points: readonly ExportPoint[],
  format: "gpx" | "kml",
) {
  const title = escapeXml(name.trim() === "" ? "Nordsweet route" : name);
  const elevation = (p: ExportPoint) => Math.round(p.altitudeFt * 0.3048);
  const header = '<?xml version="1.0" encoding="UTF-8"?>';
  if (format === "gpx") {
    const point = (p: ExportPoint, tag: string) =>
      `<${tag} lat="${p.lat}" lon="${p.lon}"><ele>${elevation(p)}</ele><name>${escapeXml(p.ident)}</name></${tag}>`;
    return `${header}<gpx version="1.1" creator="Nordsweet FMS" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${title}</name></metadata>${points.map((p) => point(p, "wpt")).join("")}<trk><name>${title}</name><trkseg>${points.map((p) => point(p, "trkpt")).join("")}</trkseg></trk></gpx>`;
  }
  const coord = (p: ExportPoint) => `${p.lon},${p.lat},${elevation(p)}`;
  return `${header}<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${title}</name><Placemark><name>${title}</name><LineString><altitudeMode>absolute</altitudeMode><coordinates>${points.map(coord).join(" ")}</coordinates></LineString></Placemark>${points.map((p) => `<Placemark><name>${escapeXml(p.ident)}</name><Point><altitudeMode>absolute</altitudeMode><coordinates>${coord(p)}</coordinates></Point></Placemark>`).join("")}</Document></kml>`;
}
