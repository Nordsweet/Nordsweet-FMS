const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const legacy = process.env.LEGACY_DIR || "/tmp/nordsweet-legacy";
const source = fs.readFileSync(
  path.join(legacy, "nextjs/src/runtime/airspaces-map.js"),
  "utf8",
);
const functions = ["trafficFadeAlpha", "selectedTrafficHistory"].map((name) => {
  const match = source.match(
    new RegExp("function " + name + "\\([\\s\\S]*?\\n      }"),
  );
  if (!match) throw Error(name);
  return match[0];
});
const remote = [
  { lat: 50, lon: 19, sampledAt: 1, callsign: "OLD" },
  { lat: 50.1, lon: 19.1, sampledAt: 2, callsign: "NEW" },
  { lat: 50.2, lon: 19.2, sampledAt: 3, callsign: "OLD" },
  { lat: 50.3, lon: 19.3, sampledAt: 4, callsign: "NEW" },
];
const local = [
  { lat: 50.3, lon: 19.3, sampledAt: 4, callsign: "NEW" },
  { lat: 50.4, lon: 19.4, sampledAt: 5, callsign: "NEW" },
];
const context = {
  window: {},
  Number,
  Map,
  state: { traffic: { historyById: new Map([["test", local]]) } },
  remoteTrafficHistories: new Map([["abc123", { samples: remote }]]),
  TRAFFIC_FADE_START_MS: 60000,
  TRAFFIC_FADE_END_MS: 120000,
  trafficHistoryKey: () => "test",
  getTrafficCallsign: (a) => a.callsign,
};
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(legacy, "nextjs/public/airspace-tools.js"), "utf8"),
  context,
);
vm.runInContext(functions.join("\n"), context);
const input =
  "AC D\nAN TEST CTR\nAL GND\nAH FL095\nDP 50:00:00 N 019:00:00 E\nDP 50:30:00 N 019:00:00 E\nDP 50:00:00 N 019:30:00 E";
const zone = context.window.AirspaceTools.parseOpenAir(input, "test")[0];
const ages = [0, 60000, 90000, 120000, 130000];
const record = {
  sourceCommit: process.env.LEGACY_MAIN_SHA,
  ages,
  alpha: ages.map((age) => context.trafficFadeAlpha(age)),
  history: {
    remote,
    local,
    expected: context.selectedTrafficHistory({
      hex: "ABC123",
      callsign: "NEW",
    }),
  },
  openair: { input, expected: zone.points },
};
fs.writeFileSync(
  "tests/fixtures/legacy-map.json",
  JSON.stringify(record) + "\n",
);
console.log("Recorded map goldens from " + record.sourceCommit);
