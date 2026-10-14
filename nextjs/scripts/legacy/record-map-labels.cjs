const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { functionSource, legacyDir } = require("./legacy-functions.cjs");

const source = fs
  .readFileSync(
    path.join(legacyDir, "nextjs/src/runtime/airspaces-map.js"),
    "utf8",
  )
  .replace(/^ +(?=function)/gm, "");
const threshold = source.match(/const POINT_LABEL_MIN_ZOOM = ([\d.]+);/)[1];
const ctx = vm.createContext({});
vm.runInContext(
  [
    "mapLabelZoom",
    "getAirportRunwayLengthM",
    "drawAirportDataLabel",
    "drawSymbol",
    "drawTraffic",
  ]
    .map((name) => functionSource(source, name))
    .join("\n") +
    `
  const POINT_LABEL_MIN_ZOOM = ${threshold};
  var refs = {labelToggle: {checked: true}};
  var T = {searchKey: value => String(value).toUpperCase().replace(/[^A-Z0-9]/g, "")};
  var state = {bounds: {minLon:0,maxLon:10}};
  function animatedTrafficList() {return [{lat:50,lon:19,trackDeg:90,speedKt:100,altitudeFt:3000}];}
  function inBounds() {return true;}
  function getTrafficSymbolStyle() {return {fill:"black",stroke:"white"};}
  function isDroneTraffic() {return false;}
  function getTrafficMapLabel() {return "CALL";}
`,
  ctx,
);

const runway = {
  designator: "09",
  trueHeadingDeg: 90,
  surface: "asphalt",
  lengthM: 2000,
  widthM: 30,
  slopePct: 0,
  toraM: 1800,
  todaM: 2100,
  asdaM: 2200,
  ldaM: 1700,
  threshold: null,
};
const airports = [
  {
    ident: "EPKK",
    name: "Krakow Balice",
    isIcao: true,
    elevationFt: 791,
    runways: [runway],
  },
  {
    ident: "LOCAL",
    name: "Local strip",
    isIcao: false,
    elevationFt: 245.6,
    runways: [],
  },
  {
    ident: "EPKK",
    name: " epkk ",
    isIcao: true,
    elevationFt: 791,
    runways: [runway],
  },
  {
    ident: "LOCAL",
    name: "Local strip",
    isIcao: true,
    elevationFt: 245.6,
    runways: [],
  },
];
function canvasText(action) {
  const text = [];
  const drawing = new Proxy(
    {},
    {
      get: (_, key) =>
        key === "fillText" ? (value) => text.push(value) : () => {},
      set: () => true,
    },
  );
  action(drawing);
  return text;
}
const cases = [];
for (const zoom of [8.999, 9, 9.001, 9.999, 10, 10.001]) {
  const viewport = {
    scale: (2 ** zoom * 256) / 360,
    project: () => ({ x: 20, y: 20 }),
    width: 500,
    height: 500,
  };
  for (const enabled of [false, true]) {
    ctx.refs.labelToggle.checked = enabled;
    const pointNames =
      canvasText((drawing) =>
        ctx.drawSymbol(drawing, viewport, { name: "FIX" }, "ifr"),
      ).length > 0;
    for (const airport of airports) {
      const legacyAirport = {
        ...airport,
        icao: airport.ident,
        elevation: airport.elevationFt,
        runways: airport.runways.map((r) => ({
          length_m: r.lengthM,
          tora: r.toraM,
          toda: r.todaM,
          asda: r.asdaM,
          lda: r.ldaM,
        })),
      };
      const text = canvasText((drawing) =>
        ctx.drawAirportDataLabel(drawing, viewport, legacyAirport, {
          x: 20,
          y: 20,
        }),
      );
      cases.push({
        zoom,
        enabled,
        pointNames,
        airport,
        expected: text.length
          ? { title: text[0], details: text[1] ?? "" }
          : null,
      });
    }
  }
}
const traffic = [false, true].flatMap((enabled) =>
  [8.001, 8, 7.999].map((span) => {
    ctx.refs.labelToggle.checked = enabled;
    ctx.state.bounds.maxLon = span;
    const shown =
      canvasText((drawing) =>
        ctx.drawTraffic(drawing, {
          project: () => ({ x: 20, y: 20 }),
          width: 500,
          height: 500,
        }),
      ).length > 0;
    return { span, enabled, shown };
  }),
);
fs.writeFileSync(
  "tests/fixtures/legacy-map-labels.json",
  JSON.stringify({
    sourceCommit: "5265bc5de9510aa3d83cc469860a730962b96c78",
    cases,
    traffic,
  }),
);
