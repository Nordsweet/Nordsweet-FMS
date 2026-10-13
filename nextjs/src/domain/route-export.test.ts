import { expect, it } from "vitest";
import { routeExport } from "./route-export";
it("exports named GPX track/waypoints and KML with escaped names and metre altitudes", () => {
  const points = [{ ident: "A&B", lat: 50, lon: 20, altitudeFt: 1000 }];
  const gpx = routeExport("Test <route>", points, "gpx");
  expect(gpx).toContain(
    '<wpt lat="50" lon="20"><ele>305</ele><name>A&amp;B</name></wpt>',
  );
  expect(gpx).toContain('<trkpt lat="50" lon="20">');
  expect(gpx).toContain("Test &lt;route&gt;");
  expect(routeExport("Test", points, "kml")).toContain(
    "<coordinates>20,50,305</coordinates>",
  );
});
