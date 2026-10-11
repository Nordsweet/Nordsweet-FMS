export async function start(loadScript) {
await loadScript("./airports.js");
await loadScript("./ground-data.js");
// Waypoints/index.js pulls packages in with document.write, which is ignored for injected scripts.
await loadScript("./Waypoints/Poland.js");

const PDF_FRAGMENT = "#toolbar=0&navpanes=0&scrollbar=0&page=1&view=Fit&zoom=page-fit";
const TAXI_VIEWBOX = { width: 1000, height: 1000 };
const TAXI_RENDER_SCALE = 8;
const TAXI_MAX_SCALE = 10;
const NORD_MAX_SCALE = 6;
const NORD_SEGMENT_LABEL_OFFSET = 13;
const NORD_SEGMENT_LABEL_LEAD = 18;
const NORD_SEGMENT_LABEL_FONT_SIZE = 8.5;
const NORD_SEGMENT_LABEL_OFFSETS = [NORD_SEGMENT_LABEL_OFFSET];
const NORD_SEGMENT_LABEL_SHIFTS = [0, 16, 32, 48, 64, 86];
const NORD_FIX_LABEL_FONT_SIZE = 11.5;
const NORD_FIX_LABEL_LINE_GAP = 12.5;
const NORD_FIX_LABEL_MARKER_PADDING = 6;
const NORD_FIX_LABEL_OTHER_POINT_PADDING = 7;
const NORD_FIX_LABEL_VERTICAL_CENTER_PENALTY = 80;
const NORD_FIX_LABEL_ROUTE_PADDING = 2;
const NORD_FIX_LABEL_ROUTE_OVERLAP_PENALTY = 4200;
const NORD_FIX_LABEL_OFFSETS = [6, 8, 10, 12, 16, 22, 30, 42];
const NORD_LOCAL_TURN_SIDE_THRESHOLD = 120;
const CHART_TYPES = {
  AD1: "Airport information",
  AD2: "Aerodrome chart",
  AD4: "Parking chart",
  AD6: "Obstacle chart",
  AD7: "Precision Approach terrain chart",
  AD8: "SID chart",
  AD9: "STAR chart",
  AD12: "Approach chart",
  AD13: "VFR chart",
  AD14: "Bird Concentration"
};
const CHART_SOURCE_OPTIONS = [
  { key: "nordchart", label: "NordChart", emptyLabel: "No generated NordChart" },
  { key: "national-aip", label: "National AIP", emptyLabel: "No National AIP PDF" },
  { key: "jeppesen", label: "Jeppesen", emptyLabel: "No Jeppesen PDF" }
];
const SEQUENCE = [
  { scope: "DEP", type: "AD4" },
  { scope: "DEP", type: "AD2" },
  { scope: "DEP", type: "AD8" },
  { scope: "ARR", type: "AD9" },
  { scope: "ARR", type: "AD12" },
  { scope: "ARR", type: "AD2" },
  { scope: "ARR", type: "AD4" }
];
const CHART_CATALOG = {
  EPKK: {
    AD2: { title: "AD 2 EPKK 2", src: "./charts/Poland/EPKK/National%20AIP/AD2.pdf" }
  },
  EPZG: {
    AD2: { title: "AD 2 EPZG 2", src: "./charts/Poland/EPZG/National%20AIP/AD2.pdf" }
  },
  EPPO: {
    AD2: { title: "AD 2 EPPO 2-1", src: "./charts/Poland/EPPO/National%20AIP/AD2.pdf" }
  },
  EPNT: {
    AD4: { title: "AD 4 EPNT 2", src: "./charts/Poland/EPNT/National%20AIP/AD4.pdf" }
  },
  EPBC: {
    AD4: { title: "AD 4 EPBC 2", src: "./charts/Poland/EPBC/National%20AIP/AD4.pdf" }
  },
  EPLS: {
    AD4: { title: "AD 4 EPLS 2", src: "./charts/Poland/EPLS/National%20AIP/AD4.pdf" }
  },
  EPPI: {
    AD4: { title: "AD 4 EPPI 2", src: "./charts/Poland/EPPI/National%20AIP/AD4.pdf" }
  }
};

const airports = Array.isArray(window.TECNAM_DATA && window.TECNAM_DATA.airports)
  ? window.TECNAM_DATA.airports
  : [];
const groundAirports = window.NORDSWEET_GROUND_DATA && window.NORDSWEET_GROUND_DATA.airports
  ? window.NORDSWEET_GROUND_DATA.airports
  : {};
function normalizeProcedureBucket(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (value && typeof value === "object") {
    if (value.id || value.designator || value.legs) {
      return [value];
    }
    return Object.values(value).filter((item) => item && typeof item === "object" && (item.id || item.designator || item.legs));
  }
  return [];
}

function getWaypointProcedureAirports() {
  const packages = window.NORDSWEET_PRIVATE_WAYPOINTS || {};
  const merged = {};
  Object.keys(packages).forEach((packageKey) => {
    const procedures = packages[packageKey] && packages[packageKey].procedures
      ? packages[packageKey].procedures
      : {};
    Object.keys(procedures).forEach((icao) => {
      const airportIcao = normalizeId(icao);
      const incoming = procedures[icao] || {};
      if (!airportIcao) {
        return;
      }
      if (!merged[airportIcao]) {
        merged[airportIcao] = { sids: [], stars: [] };
      }
      merged[airportIcao].sids = merged[airportIcao].sids.concat(normalizeProcedureBucket(incoming.sids));
      merged[airportIcao].stars = merged[airportIcao].stars.concat(normalizeProcedureBucket(incoming.stars));
    });
  });
  return merged;
}

const procedureAirports = getWaypointProcedureAirports();
const refs = {
  depSelect: document.getElementById("depSelect"),
  arrSelect: document.getElementById("arrSelect"),
  chartSourceSelect: document.getElementById("chartSourceSelect"),
  progressLabel: document.getElementById("progressLabel"),
  currentLabel: document.getElementById("currentLabel")
};
const paneRefs = Array.from(document.querySelectorAll("[data-chart-pane]")).map((pane, index) => ({
  airportLabel: pane.querySelector("[data-airport-label]"),
  airportRoleLabel: pane.querySelector("[data-airport-role-label]"),
  chartTitle: pane.querySelector("[data-chart-title]"),
  chartTypeLabel: pane.querySelector("[data-chart-type-label]"),
  fileLabel: pane.querySelector("[data-file-label]"),
  headerSourceLabel: pane.querySelector("[data-header-source-label]"),
  index,
  openLink: pane.querySelector("[data-open-link]"),
  pane,
  prevBtn: pane.querySelector("[data-prev-btn]"),
  documentStage: pane.querySelector("[data-document-stage]"),
  nextBtn: pane.querySelector("[data-next-btn]"),
  strip: pane.querySelector("[data-strip]"),
  toolRow: pane.querySelector("[data-tool-row]")
}));
const state = {
  dep: "EPKK",
  arr: "EPPO",
  chartSource: "nordchart",
  activePane: 0,
  lineWidth: 7,
  panes: [
    { index: 0, nordPan: null, nordTransform: { panX: 0, panY: 0, scale: 1 }, stripTap: null, swipe: null, taxiPan: null, taxiTransform: { panX: 0, panY: 0, scale: 1 } },
    { index: 1, nordPan: null, nordTransform: { panX: 0, panY: 0, scale: 1 }, stripTap: null, swipe: null, taxiPan: null, taxiTransform: { panX: 0, panY: 0, scale: 1 } }
  ],
  runtimePdf: {},
  procedureRunways: {}
};

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeChartSource(value) {
  const source = clean(value).toLowerCase();
  return CHART_SOURCE_OPTIONS.some((option) => option.key === source) ? source : "nordchart";
}

function getChartSourceOption(value = state.chartSource) {
  const source = normalizeChartSource(value);
  return CHART_SOURCE_OPTIONS.find((option) => option.key === source) || CHART_SOURCE_OPTIONS[0];
}

function getRuntimePdfKey(airport) {
  return normalizeChartSource(state.chartSource) + ":" + normalizeId(airport);
}

function getPaneState(paneIndex) {
  const index = Math.max(0, Math.min(Number(paneIndex) || 0, state.panes.length - 1));
  return state.panes[index] || state.panes[0];
}

function getPaneIndexFromElement(element) {
  const pane = element && element.closest ? element.closest("[data-chart-pane]") : null;
  return pane ? Math.max(0, Math.min(Number(pane.dataset.chartPane) || 0, state.panes.length - 1)) : state.activePane || 0;
}

function setActivePane(paneIndex) {
  state.activePane = Math.max(0, Math.min(Number(paneIndex) || 0, state.panes.length - 1));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizePdfSource(src) {
  const source = clean(src);
  return source && !source.includes("#") ? source + PDF_FRAGMENT : source;
}

function getAirport(icao) {
  const normalized = clean(icao).toUpperCase();
  return airports.find((airport) => clean(airport.icao).toUpperCase() === normalized) || { icao: normalized, name: normalized };
}

function getAirportLabel(icao) {
  const airport = getAirport(icao);
  return airport && airport.name && airport.name !== airport.icao
    ? airport.icao + " " + airport.name
    : airport.icao || "--";
}

function getAirportOptions() {
  const values = new Map();
  airports.forEach((airport) => {
    const icao = clean(airport && airport.icao).toUpperCase();
    if (icao) {
      values.set(icao, getAirportLabel(icao));
    }
  });
  Object.keys(CHART_CATALOG).forEach((icao) => values.set(icao, getAirportLabel(icao)));
  Object.keys(procedureAirports).forEach((icao) => values.set(icao, getAirportLabel(icao)));
  return Array.from(values.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([icao, label]) => ({ icao, label }));
}

function getFirstAirportWithChart(type) {
  return Object.keys(CHART_CATALOG).find((icao) => CHART_CATALOG[icao] && CHART_CATALOG[icao][type]) || "";
}

function getChartEntry(icao, type, source = state.chartSource) {
  if (normalizeChartSource(source) !== "national-aip") {
    return null;
  }
  const catalog = CHART_CATALOG[clean(icao).toUpperCase()] || {};
  const entry = catalog[clean(type).toUpperCase()];
  if (!entry) {
    return null;
  }
  const chosen = Array.isArray(entry) ? entry[0] : entry;
  return {
    title: clean(chosen.title || chosen.label) || type + " " + icao,
    src: normalizePdfSource(chosen.src || chosen.url || ""),
    fileLabel: clean(chosen.fileLabel || chosen.title || chosen.label) || "PDF",
    source: "national-aip"
  };
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0";
  }
  return String(Math.round(number * 1000) / 1000);
}

function normalizeId(value) {
  return clean(value).replace(/\s+/g, "").toUpperCase();
}

function normalizeProcedureId(value) {
  return clean(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeRunwayId(value) {
  return clean(value).toUpperCase().replace(/^RWY\s*/, "").replace(/^RW/, "");
}

function getProcedureAirportData(icao) {
  const data = procedureAirports[normalizeId(icao)] || {};
  return {
    sids: Array.isArray(data.sids) ? data.sids : [],
    stars: Array.isArray(data.stars) ? data.stars : []
  };
}

function getProcedures(icao, type) {
  const data = getProcedureAirportData(icao);
  return type === "SID" ? data.sids : data.stars;
}

function getProcedureLabel(procedure) {
  return procedure ? clean(procedure.designator || procedure.id) || "Procedure" : "Procedure";
}

function getProcedureRunwayLabel(procedure) {
  const runways = procedure && Array.isArray(procedure.runways)
    ? procedure.runways.map(normalizeRunwayId).filter(Boolean)
    : [];
  return runways.length ? "RWY " + runways.join("/") : "RWY any";
}

function procedureMatchesRunway(procedure, runwayId) {
  const normalizedRunway = normalizeRunwayId(runwayId);
  const runways = procedure && Array.isArray(procedure.runways)
    ? procedure.runways.map(normalizeRunwayId).filter(Boolean)
    : [];
  return !runways.length || !normalizedRunway || runways.includes(normalizedRunway);
}

function getPreferredProcedureRunwayId(icao) {
  const routeData = getRouteData(icao);
  const routeRunway = normalizeRunwayId(getDefaultRunwayEndpoint(routeData, icao));
  if (routeRunway) {
    return routeRunway;
  }

  const airport = getAirport(icao);
  const runways = airport && Array.isArray(airport.runways) ? airport.runways : [];
  return runways.length ? normalizeRunwayId(runways[0] && runways[0].id) : "";
}

function scoreProcedure(procedure, type, runwayId) {
  let score = 0;
  const runways = procedure && Array.isArray(procedure.runways) ? procedure.runways : [];
  if (procedureMatchesRunway(procedure, runwayId)) {
    score += runwayId ? 40 : 5;
  } else if (runways.length) {
    score -= 25;
  }
  return score;
}

function getSuggestedProcedure(icao, type) {
  const procedures = getProcedures(icao, type);
  if (!procedures.length) {
    return null;
  }

  const runwayId = getPreferredProcedureRunwayId(icao);
  return procedures
    .slice()
    .sort((left, right) => {
      const scoreDelta = scoreProcedure(right, type, runwayId) - scoreProcedure(left, type, runwayId);
      return scoreDelta || normalizeProcedureId(left.id || left.designator).localeCompare(normalizeProcedureId(right.id || right.designator));
    })[0] || null;
}

function getProcedureRunwayIds(procedure) {
  return procedure && Array.isArray(procedure.runways)
    ? procedure.runways.map(normalizeRunwayId).filter(Boolean)
    : [];
}

function getAvailableProcedureRunways(procedures) {
  return Array.from(new Set((Array.isArray(procedures) ? procedures : [])
    .flatMap(getProcedureRunwayIds)))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function getProcedureRunwayStateKey(icao, procedureType) {
  return clean(procedureType).toUpperCase() + ":" + normalizeId(icao);
}

function getStoredProcedureRunway(icao, procedureType) {
  return normalizeRunwayId(state.procedureRunways[getProcedureRunwayStateKey(icao, procedureType)] || "");
}

function getSelectedProcedureRunway(icao, procedureType, procedures) {
  const runwayOptions = getAvailableProcedureRunways(procedures);
  if (!runwayOptions.length) {
    return "";
  }

  const stored = getStoredProcedureRunway(icao, procedureType);
  if (stored && runwayOptions.includes(stored)) {
    return stored;
  }

  const preferred = normalizeRunwayId(getPreferredProcedureRunwayId(icao));
  return preferred && runwayOptions.includes(preferred) ? preferred : runwayOptions[0];
}

function getProceduresForRunway(procedures, runwayId) {
  const selectedRunway = normalizeRunwayId(runwayId);
  return selectedRunway
    ? (Array.isArray(procedures) ? procedures : []).filter((procedure) => procedureMatchesRunway(procedure, selectedRunway))
    : (Array.isArray(procedures) ? procedures : []);
}

function getProcedureAltitudeText(altitude) {
  if (!altitude || !altitude.raw) {
    return "";
  }
  return clean(altitude.raw)
    .toUpperCase()
    .replace(/FT/g, "")
    .replace(/[+\-]/g, "")
    .trim();
}

function toRadians(value) {
  return Number(value) * Math.PI / 180;
}

function getStarEntryWaypoint(procedure) {
  const explicitEntry = normalizeId(procedure && (procedure.entryWaypoint || procedure.entryFix || procedure.transition));
  if (explicitEntry) {
    return explicitEntry;
  }

  const designator = normalizeProcedureId(procedure && (procedure.designator || procedure.id));
  const entry = designator.replace(/\d+[A-Z]?$/, "");
  return entry && entry.length >= 3 ? entry : "";
}

function getSyntheticStarEntryPoint(procedure, firstLeg, procedureMeta) {
  const entryWaypoint = getStarEntryWaypoint(procedure);
  const firstWaypoint = normalizeId(firstLeg && firstLeg.waypoint);
  if (!entryWaypoint || entryWaypoint === firstWaypoint) {
    return null;
  }

  const firstLat = Number(firstLeg && firstLeg.lat);
  const firstLon = Number(firstLeg && firstLeg.lon);
  const distanceNm = Number(firstLeg && firstLeg.distanceNm);
  const trueTrack = Number(firstLeg && firstLeg.trackTrue);
  const magneticTrack = Number(firstLeg && firstLeg.trackMag);
  const track = Number.isFinite(trueTrack) ? trueTrack : magneticTrack;
  if (!Number.isFinite(firstLat) || !Number.isFinite(firstLon) || !Number.isFinite(distanceNm) || distanceNm <= 0 || !Number.isFinite(track)) {
    return null;
  }

  const bearing = toRadians(track);
  const northNm = Math.cos(bearing) * distanceNm;
  const eastNm = Math.sin(bearing) * distanceNm;
  const cosLat = Math.max(Math.cos(toRadians(firstLat)), 0.01);
  return {
    ...procedureMeta,
    isAirport: false,
    isSyntheticEntry: true,
    lat: firstLat - northNm / 60,
    lon: firstLon - eastNm / (60 * cosLat),
    waypoint: entryWaypoint
  };
}

function createProcedureProjection(points, width, height, margins) {
  const referenceLat = points.reduce((sum, point) => sum + point.lat, 0) / Math.max(points.length, 1);
  const referenceLon = points.reduce((sum, point) => sum + point.lon, 0) / Math.max(points.length, 1);
  const cosReferenceLat = Math.max(Math.cos(toRadians(referenceLat)), 0.01);
  const localPoints = points.map((point) => ({
    ...point,
    xNm: (point.lon - referenceLon) * 60 * cosReferenceLat,
    yNm: (point.lat - referenceLat) * 60
  }));
  const minX = Math.min(...localPoints.map((point) => point.xNm));
  const maxX = Math.max(...localPoints.map((point) => point.xNm));
  const minY = Math.min(...localPoints.map((point) => point.yNm));
  const maxY = Math.max(...localPoints.map((point) => point.yNm));
  const plotWidth = width - margins.left - margins.right;
  const plotHeight = height - margins.top - margins.bottom;
  const scale = Math.min(plotWidth / Math.max((maxX - minX) * 1.16, 1), plotHeight / Math.max((maxY - minY) * 1.16, 1));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const chartCenterX = margins.left + plotWidth / 2;
  const chartCenterY = margins.top + plotHeight / 2;
  return localPoints.map((point) => ({
    ...point,
    x: chartCenterX + (point.xNm - centerX) * scale,
    y: chartCenterY - (point.yNm - centerY) * scale
  }));
}

function getRouteData(icao) {
  return groundAirports[normalizeId(icao)] || null;
}

function getGroundThing(routeData, id) {
  const normalized = normalizeId(id);
  return (routeData && Array.isArray(routeData.elements) ? routeData.elements : [])
    .find((thing) => normalizeId(thing && thing.id) === normalized) || null;
}

function getConnections(routeData, id) {
  const normalized = normalizeId(id);
  const connections = routeData && routeData.connections && Array.isArray(routeData.connections[normalized])
    ? routeData.connections[normalized]
    : [];
  return connections.map(normalizeId).filter(Boolean);
}

function getTaxiChartConfig(icao) {
  if (normalizeChartSource(state.chartSource) !== "national-aip") {
    return null;
  }
  const routeData = getRouteData(icao);
  const overlay = routeData && routeData.chartOverlay ? routeData.chartOverlay : {};
  const chart = overlay.chart || routeData && routeData.chart || null;
  if (chart && chart.src) {
    return {
      title: clean(chart.title || chart.label) || "Airport chart",
      src: normalizePdfSource(chart.src),
      renderScale: Math.max(1, Number(chart.renderScale) || TAXI_RENDER_SCALE),
      maxScale: Math.max(1, Number(chart.maxScale) || TAXI_MAX_SCALE),
      aspectRatio: Math.max(0.5, Math.min(Number(chart.aspectRatio) || 16 / 9, 3)),
      source: "national-aip"
    };
  }
  return getChartEntry(icao, "AD4") || getChartEntry(icao, "AD2");
}

function getRuntimePdf(key) {
  const entry = state.runtimePdf[key] || null;
  return entry && entry.url ? entry : null;
}

function getTaxiPdfSource(icao) {
  const runtime = getRuntimePdf(getRuntimePdfKey(icao));
  if (runtime) {
    return runtime.url;
  }
  const chart = getTaxiChartConfig(icao);
  return chart ? chart.src : "";
}

function getTaxiPdfLabel(icao) {
  const runtime = getRuntimePdf(getRuntimePdfKey(icao));
  if (runtime) {
    return runtime.label;
  }
  const chart = getTaxiChartConfig(icao);
  return chart ? chart.title : getChartSourceOption().emptyLabel;
}

function isRunwayEndpoint(id) {
  return /^RW\d{2}[LRC]?$/.test(normalizeId(id));
}

function getHoldingPointForRunway(endpoint) {
  const runway = normalizeId(endpoint);
  return runway.startsWith("RW") ? "HP" + runway.slice(2) : "";
}

function getDefaultRunwayEndpoint(routeData, icao) {
  const connections = routeData && routeData.connections ? Object.keys(routeData.connections).map(normalizeId) : [];
  if (normalizeId(icao) === "EPKK" && connections.includes("RW25")) {
    return "RW25";
  }
  return connections.find((id) => isRunwayEndpoint(id)) || "";
}

function getDefaultRouteStart(routeData, icao, runwayEndpoint) {
  const normalizedIcao = normalizeId(icao);
  if (normalizedIcao === "EPKK" && runwayEndpoint === "RW25" && getConnections(routeData, "Z6").length) {
    return "Z6";
  }
  const apron = routeData && Array.isArray(routeData.aprons) ? routeData.aprons[0] : null;
  const stand = apron && Array.isArray(apron.stands) ? apron.stands[0] : null;
  const startOption = stand && Array.isArray(stand.startOptions) && stand.startOptions.length ? stand.startOptions[0] : "";
  return normalizeId(startOption || stand && stand.id || "");
}

function getShortestRoute(routeData, start, target) {
  const source = normalizeId(start);
  const destination = normalizeId(target);
  if (!source || !destination || !routeData) {
    return [];
  }
  const queue = [[source]];
  const visited = new Set([source]);
  while (queue.length) {
    const route = queue.shift();
    const current = route[route.length - 1];
    if (current === destination) {
      return route;
    }
    getConnections(routeData, current).forEach((next) => {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(route.concat(next));
      }
    });
  }
  return [source, destination];
}

function getIntersections(routeData) {
  return routeData && routeData.chartOverlay && Array.isArray(routeData.chartOverlay.intersections)
    ? routeData.chartOverlay.intersections
    : [];
}

function getIntersectionMembers(intersection) {
  return (intersection && Array.isArray(intersection.members) ? intersection.members : [])
    .map(normalizeId)
    .filter(Boolean);
}

function intersectionHas(intersection, id) {
  return getIntersectionMembers(intersection).includes(normalizeId(id));
}

function distance(left, right) {
  if (!left || !right) {
    return 0;
  }
  const dx = Number(left.x) - Number(right.x);
  const dy = Number(left.y) - Number(right.y);
  return Math.sqrt(dx * dx + dy * dy);
}

function pointFromIntersection(intersection) {
  return {
    id: clean(intersection && intersection.id),
    x: Math.max(0, Math.min(TAXI_VIEWBOX.width, Number(intersection && intersection.x))),
    y: Math.max(0, Math.min(TAXI_VIEWBOX.height, Number(intersection && intersection.y)))
  };
}

function chooseIntersection(candidates, previousPoint) {
  const valid = (Array.isArray(candidates) ? candidates : [])
    .filter((intersection) => Number.isFinite(Number(intersection.x)) && Number.isFinite(Number(intersection.y)));
  if (!valid.length) {
    return null;
  }
  if (!previousPoint) {
    return valid[0];
  }
  return valid
    .slice()
    .sort((left, right) => distance(left, previousPoint) - distance(right, previousPoint))[0];
}

function appendRoutePoint(points, point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return;
  }
  const previous = points[points.length - 1];
  if (previous && (previous.id === point.id || distance(previous, point) < 0.5)) {
    return;
  }
  points.push(point);
}

function getChartRoutePoints(routeData, routeIds) {
  const intersections = getIntersections(routeData);
  const points = [];
  for (let index = 0; index < routeIds.length - 1; index += 1) {
    const from = routeIds[index];
    const to = routeIds[index + 1];
    const previous = points[points.length - 1] || null;
    const direct = intersections.filter((intersection) => intersectionHas(intersection, from) && intersectionHas(intersection, to));
    const toOnly = intersections.filter((intersection) => intersectionHas(intersection, to));
    const fromOnly = intersections.filter((intersection) => intersectionHas(intersection, from));
    const chosen = chooseIntersection(direct, previous) || chooseIntersection(toOnly, previous) || chooseIntersection(fromOnly, previous);
    appendRoutePoint(points, pointFromIntersection(chosen));
  }
  return points;
}

function getTaxiRouteInfo(icao) {
  const routeData = getRouteData(icao);
  if (!routeData) {
    return { routeData: null, ids: [], points: [], runway: "" };
  }
  const runway = getDefaultRunwayEndpoint(routeData, icao);
  const start = getDefaultRouteStart(routeData, icao, runway);
  const routeIds = getShortestRoute(routeData, start, runway);
  return {
    routeData,
    ids: routeIds,
    points: getChartRoutePoints(routeData, routeIds),
    runway: runway ? normalizeId(icao) + " RWY " + runway.replace(/^RW/, "") : ""
  };
}

function getSlides() {
  const sourceOption = getChartSourceOption();
  return SEQUENCE.map((item, index) => {
    const icao = item.scope === "ARR" ? state.arr : state.dep;
    const procedureType = item.type === "AD8" ? "SID" : item.type === "AD9" ? "STAR" : "";
    const availableProcedures = sourceOption.key === "nordchart" && procedureType
      ? getProcedures(icao, procedureType)
      : [];
    const usesProcedureSet = sourceOption.key === "nordchart" && (item.type === "AD8" || item.type === "AD9") && procedureType;
    const procedureRunwayOptions = usesProcedureSet ? getAvailableProcedureRunways(availableProcedures) : [];
    const procedureRunway = usesProcedureSet ? getSelectedProcedureRunway(icao, procedureType, availableProcedures) : "";
    const procedures = usesProcedureSet ? getProceduresForRunway(availableProcedures, procedureRunway) : [];
    const procedure = null;
    const chart = getChartEntry(icao, item.type);
    const procedureCount = procedures.length || (procedure ? 1 : 0);
    return {
      index,
      scope: item.scope,
      type: item.type,
      icao,
      chartSource: sourceOption.key,
      chartSourceLabel: sourceOption.label,
      procedure,
      procedures,
      procedureType,
      procedureRunway,
      procedureRunwayOptions,
      airportLabel: getAirportLabel(icao),
      typeLabel: CHART_TYPES[item.type] || "Airport chart",
      sequenceLabel: item.scope + " " + item.type,
      title: procedures.length && procedureRunway ? procedureType + " RWY " + procedureRunway : procedures.length ? "All available " + procedureType + "s" : chart ? chart.title : item.scope + " " + item.type,
      src: chart ? chart.src : "",
      fileLabel: procedureCount ? "Generated NordChart" : chart ? chart.fileLabel : sourceOption.emptyLabel
    };
  });
}

function getSlideProcedures(slide) {
  const procedures = Array.isArray(slide && slide.procedures) ? slide.procedures.filter(Boolean) : [];
  return procedures.length ? procedures : slide && slide.procedure ? [slide.procedure] : [];
}

function clampIndex(index) {
  return Math.max(0, Math.min(Number(index) || 0, SEQUENCE.length - 1));
}

function setIndex(index, paneIndex = state.activePane) {
  const safePaneIndex = Math.max(0, Math.min(Number(paneIndex) || 0, state.panes.length - 1));
  setActivePane(safePaneIndex);
  getPaneState(safePaneIndex).index = clampIndex(index);
  renderPane(safePaneIndex);
  renderTopStatus();
}

function move(delta, paneIndex = state.activePane) {
  const paneState = getPaneState(paneIndex);
  setIndex(paneState.index + delta, paneIndex);
}

function activateStripButtonFromEvent(event, paneIndex = state.activePane) {
  const button = event.target && event.target.closest ? event.target.closest("[data-index]") : null;
  if (!button) {
    return false;
  }
  setIndex(button.dataset.index, paneIndex);
  return true;
}

function renderAirportOptions() {
  const options = getAirportOptions()
    .map((airport) => '<option value="' + escapeHtml(airport.icao) + '">' + escapeHtml(airport.label) + "</option>")
    .join("");
  const sourceOptions = CHART_SOURCE_OPTIONS
    .map((option) => '<option value="' + escapeHtml(option.key) + '">' + escapeHtml(option.label) + "</option>")
    .join("");
  refs.depSelect.innerHTML = options;
  refs.arrSelect.innerHTML = options;
  refs.chartSourceSelect.innerHTML = sourceOptions;
  refs.depSelect.value = state.dep;
  refs.arrSelect.value = state.arr;
  refs.chartSourceSelect.value = normalizeChartSource(state.chartSource);
}

function renderToolRow(slide, routeInfo = null, pane) {
  const sourceLabel = getChartSourceOption(slide.chartSource).label;
  const procedures = getSlideProcedures(slide);
  if (procedures.length) {
    const totalLegs = procedures.reduce((sum, procedure) => sum + (Array.isArray(procedure.legs) ? procedure.legs.length : 0), 0);
    const runwayLabels = getAvailableProcedureRunways(procedures);
    const runwayLabel = runwayLabels.length ? "RWY " + runwayLabels.join("/") : getProcedureRunwayLabel(procedures[0]);
    const procedureRunwayOptions = Array.isArray(slide.procedureRunwayOptions) ? slide.procedureRunwayOptions : [];
    const runwayControl = procedureRunwayOptions.length
      ? '<label class="runway-control"><span>RWY</span><select data-procedure-runway data-airport="' + escapeHtml(slide.icao) + '" data-procedure-type="' + escapeHtml(slide.procedureType) + '">' +
        procedureRunwayOptions.map((runway) => '<option value="' + escapeHtml(runway) + '"' + (runway === slide.procedureRunway ? " selected" : "") + ">" + escapeHtml(runway) + "</option>").join("") +
        "</select></label>"
      : "";
    const restrictions = procedures.length === 1
      ? clean(procedures[0].restrictions) || "Verify current AIP / ATC clearance"
      : slide.procedureRunway ? "Available " + slide.procedureType + " procedures for RWY " + slide.procedureRunway : "All available " + slide.procedureType + " procedures";
    pane.toolRow.innerHTML = [
      "<div><span>" + escapeHtml(sourceLabel + " / " + slide.procedureType) + "</span>" + runwayControl + "</div>",
      "<div>" + escapeHtml(runwayLabel + " / " + String(procedures.length) + (procedures.length === 1 ? " procedure" : " procedures") + " / " + String(totalLegs) + " legs") + "</div>",
      "<div>" + escapeHtml(restrictions) + "</div>"
    ].join("");
    return;
  }

  if (slide.type === "AD4") {
    const overlayStatus = routeInfo && routeInfo.points.length
      ? "Taxi overlay " + routeInfo.points.length + (routeInfo.points.length === 1 ? " point" : " points")
      : "Taxi overlay n/a";
    pane.toolRow.innerHTML = [
      "<div>",
      '<label class="load-pdf">Load PDF<input type="file" accept="application/pdf" data-load-pdf data-airport="' + escapeHtml(slide.icao) + '"></label>',
      "<span>" + escapeHtml(getTaxiPdfLabel(slide.icao)) + "</span>",
      "</div>",
      "<div>" + escapeHtml(sourceLabel + " / " + overlayStatus) + "</div>",
      '<div class="line-control"><span>Line</span><input type="range" min="3" max="16" value="' + escapeHtml(state.lineWidth) + '" data-line-width><strong>' + escapeHtml(state.lineWidth) + "</strong></div>"
    ].join("");
    return;
  }

  pane.toolRow.innerHTML = [
    "<div>Sequence " + escapeHtml(String(slide.index + 1) + " / " + SEQUENCE.length) + "</div>",
    "<div>" + escapeHtml(sourceLabel + " / " + slide.sequenceLabel + " / " + slide.typeLabel) + "</div>",
    "<div>" + escapeHtml(slide.fileLabel) + "</div>"
  ].join("");
}

function getPointString(points) {
  return (Array.isArray(points) ? points : [])
    .map((point) => formatNumber(point.x) + "," + formatNumber(point.y))
    .join(" ");
}

function renderRoutePointMarkup(points, width) {
  const radius = Math.max(5, Number(width) * 0.9);
  const strokeWidth = Math.max(2.2, Number(width) * 0.32);
  return (Array.isArray(points) ? points : [])
    .map((point, index) => (
      '<circle class="route-point" cx="' + formatNumber(point.x) + '" cy="' + formatNumber(point.y) +
      '" r="' + formatNumber(radius) + '" stroke-width="' + formatNumber(strokeWidth) + '"><title>Taxi route point ' +
      String(index + 1) + "</title></circle>"
    ))
    .join("");
}

function getNordProcedurePoints(procedure, icao) {
  const airport = getAirport(icao);
  const runwayLabel = procedure && Array.isArray(procedure.runways) && procedure.runways.length
    ? normalizeRunwayId(procedure.runways[0]) || "--"
    : "--";
  const procedureMeta = {
    procedureAirport: normalizeId(icao),
    procedureId: normalizeProcedureId(procedure && (procedure.id || procedure.designator)),
    procedureRunway: normalizeRunwayId(runwayLabel),
    procedureType: clean(procedure && procedure.type).toUpperCase()
  };
  const isStarProcedure = procedureMeta.procedureType === "STAR";
  const airportPoint = airport && Number.isFinite(Number(airport.lat)) && Number.isFinite(Number(airport.lon))
    ? {
        ...procedureMeta,
        isAirport: true,
        lat: Number(airport.lat),
        lon: Number(airport.lon),
        waypoint: normalizeId(icao) + " RWY " + runwayLabel
      }
    : null;
  const legs = procedure && Array.isArray(procedure.legs) ? procedure.legs : [];
  const validLegs = legs
    .filter((leg) => Number.isFinite(Number(leg.lat)) && Number.isFinite(Number(leg.lon)));
  const legPoints = validLegs
    .map((leg) => ({
      ...procedureMeta,
      altitude: leg.altitude,
      distanceNm: leg.distanceNm,
      isAirport: false,
      lat: Number(leg.lat),
      lon: Number(leg.lon),
      speedKt: leg.speedKt,
      trackMag: leg.trackMag,
      waypoint: clean(leg.waypoint) || "FIX"
    }));
  const starEntryPoint = isStarProcedure
    ? getSyntheticStarEntryPoint(procedure, validLegs[0], procedureMeta)
    : null;

  return isStarProcedure
    ? (starEntryPoint ? [starEntryPoint] : []).concat(legPoints, airportPoint ? [airportPoint] : [])
    : (airportPoint ? [airportPoint] : []).concat(legPoints);
}

function renderNordProcedureGrid(width, height, margins) {
  const verticals = [];
  const horizontals = [];
  for (let index = 0; index <= 8; index += 1) {
    const x = margins.left + (width - margins.left - margins.right) * index / 8;
    const y = margins.top + (height - margins.top - margins.bottom) * index / 8;
    verticals.push('<line class="nord-grid" data-nord-role="grid" data-base-stroke-width="1" x1="' + formatNumber(x) + '" y1="' + margins.top + '" x2="' + formatNumber(x) + '" y2="' + (height - margins.bottom) + '" stroke-width="1"></line>');
    horizontals.push('<line class="nord-grid" data-nord-role="grid" data-base-stroke-width="1" x1="' + margins.left + '" y1="' + formatNumber(y) + '" x2="' + (width - margins.right) + '" y2="' + formatNumber(y) + '" stroke-width="1"></line>');
  }
  return verticals.concat(horizontals).join("");
}

function estimateNordTextWidth(text, fontSize = 13) {
  return Math.max(0, clean(text).length * fontSize * 0.62);
}

function getNordLabelRows(point) {
  const speed = Number(point.speedKt);
  const speedLabel = Number.isFinite(speed) && speed > 0 ? "MAX " + Math.round(speed) + " KT" : "";
  const altitudeLabel = getProcedureAltitudeText(point.altitude);
  return [
    { className: "", text: point.waypoint || "FIX" },
    speedLabel ? { className: " nord-speed", text: speedLabel } : null,
    altitudeLabel ? { className: " nord-restriction", text: altitudeLabel } : null
  ].filter(Boolean);
}

function boxesOverlap(left, right, padding = 0) {
  return !(left.x + left.width + padding < right.x
    || right.x + right.width + padding < left.x
    || left.y + left.height + padding < right.y
    || right.y + right.height + padding < left.y);
}

function pointInBox(point, box, padding = 0) {
  return point.x >= box.x - padding
    && point.x <= box.x + box.width + padding
    && point.y >= box.y - padding
    && point.y <= box.y + box.height + padding;
}

function getPaddedBox(box, padding = 0) {
  return {
    x: box.x - padding,
    y: box.y - padding,
    width: box.width + padding * 2,
    height: box.height + padding * 2
  };
}

function getNordOrientation(a, b, c) {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

function pointOnNordSegment(a, b, point) {
  return point.x <= Math.max(a.x, b.x) + 0.001
    && point.x + 0.001 >= Math.min(a.x, b.x)
    && point.y <= Math.max(a.y, b.y) + 0.001
    && point.y + 0.001 >= Math.min(a.y, b.y);
}

function nordSegmentsIntersect(a, b, c, d) {
  const o1 = getNordOrientation(a, b, c);
  const o2 = getNordOrientation(a, b, d);
  const o3 = getNordOrientation(c, d, a);
  const o4 = getNordOrientation(c, d, b);
  if (Math.abs(o1) < 0.001 && pointOnNordSegment(a, b, c)) {
    return true;
  }
  if (Math.abs(o2) < 0.001 && pointOnNordSegment(a, b, d)) {
    return true;
  }
  if (Math.abs(o3) < 0.001 && pointOnNordSegment(c, d, a)) {
    return true;
  }
  if (Math.abs(o4) < 0.001 && pointOnNordSegment(c, d, b)) {
    return true;
  }
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function nordSegmentIntersectsBox(start, end, box, padding = 0) {
  const paddedBox = getPaddedBox(box, padding);
  if (pointInBox(start, paddedBox) || pointInBox(end, paddedBox)) {
    return true;
  }

  const topLeft = { x: paddedBox.x, y: paddedBox.y };
  const topRight = { x: paddedBox.x + paddedBox.width, y: paddedBox.y };
  const bottomRight = { x: paddedBox.x + paddedBox.width, y: paddedBox.y + paddedBox.height };
  const bottomLeft = { x: paddedBox.x, y: paddedBox.y + paddedBox.height };
  return nordSegmentsIntersect(start, end, topLeft, topRight)
    || nordSegmentsIntersect(start, end, topRight, bottomRight)
    || nordSegmentsIntersect(start, end, bottomRight, bottomLeft)
    || nordSegmentsIntersect(start, end, bottomLeft, topLeft);
}

function getNordSegmentNormal(previousPoint, point, side) {
  const dx = point.x - previousPoint.x;
  const dy = point.y - previousPoint.y;
  const length = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  return {
    x: -dy / length * side,
    y: dx / length * side
  };
}

function normalizeNordDirection(direction, fallback = { x: 1, y: 0 }) {
  const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
  if (!Number.isFinite(length) || length < 0.001) {
    return fallback;
  }
  return { x: direction.x / length, y: direction.y / length };
}

function getNordFixLabelPreferredDirection(index, projected) {
  const point = projected[index];
  if (!point) {
    return { x: 1, y: 0 };
  }

  if (index < projected.length - 1) {
    const nextPoint = projected[index + 1];
    const segmentSide = getNordSegmentLabelSide(point, nextPoint, projected);
    const normal = getNordSegmentNormal(point, nextPoint, segmentSide);
    return normalizeNordDirection({ x: -normal.x, y: -normal.y });
  }

  if (index > 0) {
    const previousPoint = projected[index - 1];
    const segmentSide = getNordSegmentLabelSide(previousPoint, point, projected);
    const normal = getNordSegmentNormal(previousPoint, point, segmentSide);
    return normalizeNordDirection({ x: -normal.x, y: -normal.y });
  }

  return { x: 1, y: 0 };
}

function createNordLabelCandidate(point, rows, width, height, margins, directionX, directionY, offset) {
  const fontSize = NORD_FIX_LABEL_FONT_SIZE;
  const lineGap = NORD_FIX_LABEL_LINE_GAP;
  const labelWidth = Math.max(34, ...rows.map((row) => estimateNordTextWidth(row.text, fontSize)));
  const labelHeight = Math.max(fontSize, rows.length * lineGap);
  const anchor = directionX < 0 ? "end" : directionX > 0 ? "start" : "middle";
  const textX = Math.max(margins.left + labelWidth / 2, Math.min(width - margins.right - labelWidth / 2, point.x + directionX * offset));
  const textY = Math.max(margins.top + labelHeight / 2, Math.min(height - margins.bottom - labelHeight / 2, point.y + directionY * offset));
  const boxX = anchor === "end" ? textX - labelWidth : anchor === "middle" ? textX - labelWidth / 2 : textX;
  const boxY = textY - labelHeight / 2;
  return { anchor, box: { x: boxX, y: boxY, width: labelWidth, height: labelHeight }, lineGap, textX, textY };
}

function shouldAvoidNordRouteLabelOverlap(point) {
  return getNordProcedureContext(point, "procedureAirport") === "EPPO"
    && getNordProcedureContext(point, "procedureType") === "STAR";
}

function getNordRouteLabelOverlapCount(box, projected) {
  let count = 0;
  for (let index = 1; index < projected.length; index += 1) {
    if (nordSegmentIntersectsBox(projected[index - 1], projected[index], box, NORD_FIX_LABEL_ROUTE_PADDING)) {
      count += 1;
    }
  }
  return count;
}

function chooseNordLabelGeometry(point, rows, index, projected, placedBoxes, width, height, margins) {
  const preferredDirection = getNordFixLabelPreferredDirection(index, projected);
  const avoidRouteOverlap = shouldAvoidNordRouteLabelOverlap(point);
  const preferredAlternates = [
    [preferredDirection.x, preferredDirection.y],
    [preferredDirection.x + preferredDirection.y * 0.34, preferredDirection.y - preferredDirection.x * 0.34],
    [preferredDirection.x - preferredDirection.y * 0.34, preferredDirection.y + preferredDirection.x * 0.34]
  ].map(([directionX, directionY]) => {
    const direction = normalizeNordDirection({ x: directionX, y: directionY }, preferredDirection);
    return [direction.x, direction.y];
  });
  const directions = [
    ...preferredAlternates,
    [1, 0],
    [-1, 0],
    [1, -0.25],
    [-1, -0.25],
    [1, 0.85],
    [-1, 0.85],
    [0, -1],
    [0, 1],
    [1, -1],
    [-1, -1],
    [1, 1],
    [-1, 1]
  ];
  const ordered = index % 2 === 0 ? directions : directions.slice(1).concat([directions[0]]);
  const candidates = [];
  ordered.forEach(([directionX, directionY]) => {
    NORD_FIX_LABEL_OFFSETS.forEach((offset) => {
      const candidate = createNordLabelCandidate(point, rows, width, height, margins, directionX, directionY, offset);
      const overlapCount = placedBoxes.filter((box) => boxesOverlap(candidate.box, box, 5)).length;
      const selfPointPenalty = pointInBox(point, candidate.box, NORD_FIX_LABEL_MARKER_PADDING) ? 1 : 0;
      const pointOverlapCount = projected.filter((otherPoint, otherIndex) => otherIndex !== index && pointInBox(otherPoint, candidate.box, NORD_FIX_LABEL_OTHER_POINT_PADDING)).length;
      const routeOverlapCount = avoidRouteOverlap ? getNordRouteLabelOverlapCount(candidate.box, projected) : 0;
      const verticalCenterPenalty = Math.abs(candidate.textY - point.y) * NORD_FIX_LABEL_VERTICAL_CENTER_PENALTY;
      const distancePenalty = verticalCenterPenalty + Math.abs(directionY) * 0.08 + offset / 260;
      const preferredPenalty = (directionX * preferredDirection.x + directionY * preferredDirection.y) >= 0.12 ? 0 : 320;
      candidates.push({ ...candidate, score: selfPointPenalty * 1200 + overlapCount * 900 + pointOverlapCount * 700 + routeOverlapCount * NORD_FIX_LABEL_ROUTE_OVERLAP_PENALTY + preferredPenalty + distancePenalty });
    });
  });

  candidates.sort((left, right) => left.score - right.score);
  const chosen = candidates[0] || createNordLabelCandidate(point, rows, width, height, margins, 1, 0, 28);
  placedBoxes.push(chosen.box);
  return chosen;
}

function getNordFixLabelLayouts(projected, width, height, margins) {
  const placedBoxes = [];
  const layouts = projected.map((point, index) => ({
    geometry: null,
    point,
    rows: getNordLabelRows(point),
    index
  }));
  const order = projected
    .map((point, index) => index)
    .sort((left, right) => Number(projected[left].isAirport) - Number(projected[right].isAirport) || left - right);

  order.forEach((index) => {
    const point = projected[index];
    const rows = layouts[index].rows;
    layouts[index].geometry = chooseNordLabelGeometry(point, rows, index, projected, placedBoxes, width, height, margins);
  });

  return layouts.map(({ geometry, point, rows }) => ({
    geometry,
    point,
    rows
  }));
}

function renderNordProcedureFix(layout) {
  const point = layout.point;
  const rows = layout.rows;
  const geometry = layout.geometry;
  const marker = point.isAirport
    ? '<g data-nord-marker data-base-x="' + formatNumber(point.x) + '" data-base-y="' + formatNumber(point.y) + '" data-marker-radius="10" transform="translate(' + formatNumber(point.x) + " " + formatNumber(point.y) + ')"><circle class="nord-airport" cx="0" cy="0" r="8"></circle></g>'
    : '<g data-nord-marker data-base-x="' + formatNumber(point.x) + '" data-base-y="' + formatNumber(point.y) + '" data-marker-radius="8" transform="translate(' + formatNumber(point.x) + " " + formatNumber(point.y) + ')"><path class="nord-fix" d="M 0 -7 L 7 0 L 0 7 L -7 0 Z"></path></g>';
  const textRows = rows.map((row, rowIndex) =>
    '<tspan class="' + row.className + '" x="0" y="' + formatNumber((rowIndex - (rows.length - 1) / 2) * geometry.lineGap) + '">' + escapeHtml(row.text) + "</tspan>"
  ).join("");
  return marker + '<g data-nord-label data-base-x="' + formatNumber(geometry.textX) + '" data-base-y="' + formatNumber(geometry.textY) + '" data-box-x="' + formatNumber(geometry.box.x) + '" data-box-y="' + formatNumber(geometry.box.y) + '" data-box-width="' + formatNumber(geometry.box.width) + '" data-box-height="' + formatNumber(geometry.box.height) + '" transform="translate(' + formatNumber(geometry.textX) + " " + formatNumber(geometry.textY) + ')"><text class="nord-label" x="0" y="0" text-anchor="' + geometry.anchor + '" dominant-baseline="middle" font-size="' + formatNumber(NORD_FIX_LABEL_FONT_SIZE) + '">' + textRows + "</text></g>";
}

function getNordWaypointCode(point) {
  return clean(point && point.waypoint).toUpperCase().split(/\s+/)[0] || "";
}

function getNordProcedureContext(point, key) {
  return clean(point && point[key]).toUpperCase();
}

function getNordOutsideSegmentSide(previousPoint, point, projected) {
  const dx = point.x - previousPoint.x;
  const dy = point.y - previousPoint.y;
  const length = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const normalX = -dy / length;
  const normalY = dx / length;
  const midX = previousPoint.x + dx * 0.5;
  const midY = previousPoint.y + dy * 0.5;
  const center = projected.reduce((sum, projectedPoint) => ({
    x: sum.x + projectedPoint.x,
    y: sum.y + projectedPoint.y
  }), { x: 0, y: 0 });
  center.x /= Math.max(projected.length, 1);
  center.y /= Math.max(projected.length, 1);
  const leftDistance = Math.pow(midX + normalX - center.x, 2) + Math.pow(midY + normalY - center.y, 2);
  const rightDistance = Math.pow(midX - normalX - center.x, 2) + Math.pow(midY - normalY - center.y, 2);
  return leftDistance >= rightDistance ? 1 : -1;
}

function getNordTurnSegmentLabelSide(beforePoint, vertexPoint, afterPoint) {
  if (!beforePoint || !vertexPoint || !afterPoint) {
    return 0;
  }

  const incomingX = vertexPoint.x - beforePoint.x;
  const incomingY = vertexPoint.y - beforePoint.y;
  const outgoingX = afterPoint.x - vertexPoint.x;
  const outgoingY = afterPoint.y - vertexPoint.y;
  const cross = incomingX * outgoingY - incomingY * outgoingX;
  if (!Number.isFinite(cross) || Math.abs(cross) < NORD_LOCAL_TURN_SIDE_THRESHOLD) {
    return 0;
  }

  return cross > 0 ? 1 : -1;
}

function getNordLocalTurnSegmentLabelSide(previousPoint, point, projected) {
  const index = projected.findIndex((projectedPoint) => projectedPoint === previousPoint);
  if (index < 0) {
    return 0;
  }

  const startTurnSide = getNordTurnSegmentLabelSide(projected[index - 1], previousPoint, point);
  if (startTurnSide) {
    return startTurnSide;
  }

  return getNordTurnSegmentLabelSide(previousPoint, point, projected[index + 2]);
}

function getNordSegmentLabelSide(previousPoint, point, projected) {
  const navurRunway25Chain = ["EPKK", "NIFCU", "KK606", "KK609", "UXBAF", "KK633", "USJOK", "EGLUC", "HIDBE", "TIGJA", "NAVUR"];
  const fromIndex = navurRunway25Chain.indexOf(getNordWaypointCode(previousPoint));
  const toIndex = navurRunway25Chain.indexOf(getNordWaypointCode(point));
  if (fromIndex >= 0 && toIndex === fromIndex + 1) {
    return toIndex <= navurRunway25Chain.indexOf("UXBAF") ? -1 : 1;
  }

  const airport = getNordProcedureContext(point, "procedureAirport") || getNordProcedureContext(previousPoint, "procedureAirport");
  const procedureType = getNordProcedureContext(point, "procedureType") || getNordProcedureContext(previousPoint, "procedureType");
  if (airport === "EPPO" && procedureType === "STAR") {
    const turnSide = getNordLocalTurnSegmentLabelSide(previousPoint, point, projected);
    if (turnSide) {
      return -turnSide;
    }
  }

  return -getNordOutsideSegmentSide(previousPoint, point, projected);
}

function getNordSegmentLabelText(point) {
  const distance = Number(point.distanceNm);
  const track = Number(point.trackMag);
  return [
    Number.isFinite(distance) ? formatNumber(distance).replace(".", ",") + " NM" : "",
    Number.isFinite(track) ? String(Math.round(track)).padStart(3, "0") + "\u00b0" : ""
  ].filter(Boolean).join(" / ");
}

function getNordSegmentLabelBaseGeometry(previousPoint, point, projected) {
  const dx = point.x - previousPoint.x;
  const dy = point.y - previousPoint.y;
  const length = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const flipped = angle > 90 || angle < -90;
  const normalizedAngle = flipped ? angle + 180 : angle;
  const anchorPoint = previousPoint;
  const side = getNordSegmentLabelSide(previousPoint, point, projected);
  const normal = getNordSegmentNormal(previousPoint, point, side);
  const anchor = flipped ? "end" : "start";
  return {
    anchor,
    anchorX: anchorPoint.x,
    anchorY: anchorPoint.y,
    angle: normalizedAngle,
    length,
    normalX: normal.x,
    normalY: normal.y,
    tangentX: dx / length,
    tangentY: dy / length
  };
}

function getNordSegmentLabelGeometry(previousPoint, point, projected, offset = NORD_SEGMENT_LABEL_OFFSET, shift = 0) {
  const base = getNordSegmentLabelBaseGeometry(previousPoint, point, projected);
  const leadShift = shift + NORD_SEGMENT_LABEL_LEAD;
  return {
    ...base,
    labelX: base.anchorX + base.normalX * offset + base.tangentX * leadShift,
    labelY: base.anchorY + base.normalY * offset + base.tangentY * leadShift,
    leadShift,
    offset,
    shift
  };
}

function getNordSegmentLabelSize(label) {
  const height = NORD_SEGMENT_LABEL_FONT_SIZE + 4;
  const width = Math.max(24, estimateNordTextWidth(label, NORD_SEGMENT_LABEL_FONT_SIZE));
  return { height, width };
}

function getNordSegmentLabelBox(geometry, label) {
  return getNordSegmentLabelBoxFromSize(geometry, getNordSegmentLabelSize(label), 1);
}

function getNordSegmentLabelBoxFromSize(geometry, size, scale = 1) {
  const height = size.height * scale;
  const width = size.width * scale;
  const angle = toRadians(geometry.angle);
  const localX = geometry.anchor === "end" ? [-width, 0] : [0, width];
  const localY = [-height / 2, height / 2];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const corners = [
    [localX[0], localY[0]],
    [localX[1], localY[0]],
    [localX[1], localY[1]],
    [localX[0], localY[1]]
  ].map(([x, y]) => ({
    x: geometry.labelX + x * cos - y * sin,
    y: geometry.labelY + x * sin + y * cos
  }));
  const minX = Math.min(...corners.map((corner) => corner.x));
  const maxX = Math.max(...corners.map((corner) => corner.x));
  const minY = Math.min(...corners.map((corner) => corner.y));
  const maxY = Math.max(...corners.map((corner) => corner.y));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function getNordSegmentLabelLayouts(projected, placedBoxes = []) {
  return projected.slice(1).map((point, index) => {
    const previousPoint = projected[index];
    const label = getNordSegmentLabelText(point);
    if (!label) {
      return null;
    }

    const size = getNordSegmentLabelSize(label);
    const candidates = NORD_SEGMENT_LABEL_OFFSETS.flatMap((offset) => NORD_SEGMENT_LABEL_SHIFTS.map((shift) => {
      const geometry = getNordSegmentLabelGeometry(previousPoint, point, projected, offset, shift);
      const maxShift = Math.max(0, geometry.length * 0.82);
      if (shift > 0 && geometry.leadShift > maxShift) {
        return null;
      }
      const box = getNordSegmentLabelBoxFromSize(geometry, size, 1);
      const overlapCount = placedBoxes.filter((usedBox) => boxesOverlap(box, usedBox, 6)).length;
      const pointOverlapCount = projected.filter((projectedPoint) => pointInBox(projectedPoint, box, 10)).length;
      return { box, geometry, label, overlapCount, pointOverlapCount, score: overlapCount * 1200 + pointOverlapCount * 700 + offset / 300 + Math.abs(shift) / 850 };
    }).filter(Boolean));

    if (!candidates.length) {
      return null;
    }

    candidates.sort((left, right) => left.score - right.score);
    const chosen = candidates[0];
    return { ...chosen, candidates, point, previousPoint, size };
  }).filter(Boolean);
}

function renderNordProcedureSegmentLabels(layouts) {
  return layouts.map((layout) => {
    const geometry = layout.geometry;
    const options = layout.candidates
      .map((candidate) => formatNumber(candidate.geometry.offset) + "," + formatNumber(candidate.geometry.shift))
      .join(";");
    return '<g data-nord-segment-label data-base-x="' + formatNumber(geometry.labelX) + '" data-base-y="' + formatNumber(geometry.labelY) + '" data-anchor-x="' + formatNumber(geometry.anchorX) + '" data-anchor-y="' + formatNumber(geometry.anchorY) + '" data-normal-x="' + formatNumber(geometry.normalX) + '" data-normal-y="' + formatNumber(geometry.normalY) + '" data-tangent-x="' + formatNumber(geometry.tangentX) + '" data-tangent-y="' + formatNumber(geometry.tangentY) + '" data-label-offset="' + formatNumber(geometry.offset) + '" data-label-shift="' + formatNumber(geometry.shift) + '" data-label-options="' + escapeHtml(options) + '" data-label-width="' + formatNumber(layout.size.width) + '" data-label-height="' + formatNumber(layout.size.height) + '" data-base-angle="' + formatNumber(geometry.angle) + '" data-text-anchor="' + geometry.anchor + '" style="display: none;" transform="translate(' + formatNumber(geometry.labelX) + " " + formatNumber(geometry.labelY) + ") rotate(" + formatNumber(geometry.angle) + ')"><text class="nord-label nord-segment-label-text" x="0" y="0" text-anchor="' + geometry.anchor + '" font-size="' + formatNumber(NORD_SEGMENT_LABEL_FONT_SIZE) + '">' + escapeHtml(layout.label) + "</text></g>";
  }).join("");
}

function getNordSegmentLabelBoxes(projected, placedBoxes = []) {
  return getNordSegmentLabelLayouts(projected, placedBoxes).map((layout) => layout.box);
}

function getNordPointKey(point) {
  const lat = Number(point && point.lat);
  const lon = Number(point && point.lon);
  return [
    getNordWaypointCode(point),
    Number.isFinite(lat) ? lat.toFixed(6) : "",
    Number.isFinite(lon) ? lon.toFixed(6) : ""
  ].join("|");
}

function getNordSegmentKey(layout) {
  return [
    getNordPointKey(layout.previousPoint),
    getNordPointKey(layout.point),
    clean(layout.label).toUpperCase()
  ].join(">");
}

function getNordProjectedProcedureGroups(procedures, icao, width, height, margins) {
  const groups = (Array.isArray(procedures) ? procedures : [])
    .map((procedure) => ({
      procedure,
      points: getNordProcedurePoints(procedure, icao)
    }))
    .filter((group) => group.points.length >= 2);
  const allPoints = groups.flatMap((group) => group.points);
  if (allPoints.length < 2) {
    return [];
  }

  const projected = createProcedureProjection(allPoints, width, height, margins);
  let offset = 0;
  return groups.map((group) => {
    const count = group.points.length;
    const projectedPoints = projected.slice(offset, offset + count);
    offset += count;
    return { ...group, projected: projectedPoints };
  });
}

function renderNordRouteLines(groups) {
  const halos = [];
  const routes = [];
  groups.forEach((group) => {
    const polyline = group.projected.map((point) => formatNumber(point.x) + "," + formatNumber(point.y)).join(" ");
    const label = getProcedureLabel(group.procedure);
    halos.push('<polyline class="nord-route-halo" data-nord-role="route" data-base-stroke-width="7" points="' + escapeHtml(polyline) + '" stroke-width="7"><title>' + escapeHtml(label) + "</title></polyline>");
    routes.push('<polyline class="nord-route-line" data-nord-role="route" data-base-stroke-width="2.2" points="' + escapeHtml(polyline) + '" stroke-width="2.2"><title>' + escapeHtml(label) + "</title></polyline>");
  });
  return halos.concat(routes).join("");
}

function getNordMultiFixLabelLayouts(groups, width, height, margins) {
  const placedBoxes = [];
  const layouts = new Map();
  groups.forEach((group) => {
    const order = group.projected
      .map((point, index) => index)
      .sort((left, right) => Number(group.projected[left].isAirport) - Number(group.projected[right].isAirport) || left - right);

    order.forEach((index) => {
      const point = group.projected[index];
      const key = getNordPointKey(point);
      if (layouts.has(key)) {
        return;
      }

      const rows = getNordLabelRows(point);
      const geometry = chooseNordLabelGeometry(point, rows, index, group.projected, placedBoxes, width, height, margins);
      layouts.set(key, { geometry, point, rows });
    });
  });
  return Array.from(layouts.values());
}

function getNordMultiSegmentLabelLayouts(groups, placedBoxes) {
  const layouts = new Map();
  groups.forEach((group) => {
    getNordSegmentLabelLayouts(group.projected, placedBoxes).forEach((layout) => {
      const key = getNordSegmentKey(layout);
      if (!layouts.has(key)) {
        layouts.set(key, layout);
      }
    });
  });
  return Array.from(layouts.values());
}

function renderNordProcedureSvg(procedure, icao, paneState) {
  return renderNordProceduresSvg([procedure], icao, paneState, getProcedureLabel(procedure));
}

function renderNordProceduresSvg(procedures, icao, paneState, ariaLabel) {
  const width = 1000;
  const height = 660;
  const margins = { top: 52, right: 54, bottom: 48, left: 54 };
  const groups = getNordProjectedProcedureGroups(procedures, icao, width, height, margins);
  if (!groups.length) {
    return '<div class="empty"><div><strong>NordChart</strong><span>Procedure geometry unavailable.</span></div></div>';
  }

  const fixLayouts = groups.length === 1
    ? getNordFixLabelLayouts(groups[0].projected, width, height, margins)
    : getNordMultiFixLabelLayouts(groups, width, height, margins);
  const segmentLayouts = groups.length === 1
    ? getNordSegmentLabelLayouts(groups[0].projected, fixLayouts.map((layout) => layout.geometry.box))
    : getNordMultiSegmentLabelLayouts(groups, fixLayouts.map((layout) => layout.geometry.box));
  const transform = paneState.nordTransform || { panX: 0, panY: 0, scale: 1 };
  return [
    '<div class="nord-procedure-map" data-nord-map data-pan-x="' + escapeHtml(transform.panX) + '" data-pan-y="' + escapeHtml(transform.panY) + '" data-scale="' + escapeHtml(transform.scale) + '" data-viewbox-width="' + width + '" data-viewbox-height="' + height + '">',
    '<div class="map-controls" aria-label="NordChart controls">',
    '<button type="button" data-nord-zoom="in" aria-label="Zoom in">+</button>',
    '<button type="button" data-nord-zoom="out" aria-label="Zoom out">-</button>',
    '<button type="button" data-nord-zoom="reset" aria-label="Reset NordChart">R</button>',
    "</div>",
    '<svg class="nord-procedure-svg" viewBox="0 0 ' + width + " " + height + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + escapeHtml(ariaLabel || "NordChart procedures") + '">',
    '<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="#fffef7"></rect>',
    '<g data-nord-layer transform="translate(' + formatNumber(transform.panX) + " " + formatNumber(transform.panY) + ") scale(" + formatNumber(transform.scale) + ')">',
    renderNordProcedureGrid(width, height, margins),
    renderNordRouteLines(groups),
    renderNordProcedureSegmentLabels(segmentLayouts),
    fixLayouts.map(renderNordProcedureFix).join(""),
    "</g>",
    "</svg>",
    '<div class="taxi-hint">NordChart. Drag to pan, scroll to zoom.</div>',
    "</div>"
  ].join("");
}

function renderNordProcedureDocument(slide, pane, paneState) {
  const procedures = getSlideProcedures(slide);
  pane.openLink.hidden = true;
  pane.openLink.removeAttribute("href");

  if (!procedures.length) {
    pane.documentStage.innerHTML =
      '<div class="empty"><div><strong>' + escapeHtml(slide.sequenceLabel) + '</strong><span>' +
      escapeHtml(slide.airportLabel + " / " + slide.fileLabel) +
      "</span></div></div>";
    return null;
  }

  const procedure = procedures[0];
  const totalLegs = procedures.reduce((sum, item) => sum + (Array.isArray(item.legs) ? item.legs.length : 0), 0);
  const legs = procedures.flatMap((item) => Array.isArray(item.legs) ? item.legs : []);
  const navSpecLeg = legs.find((leg) => clean(leg && leg.navSpec));
  const navSpec = clean(navSpecLeg && navSpecLeg.navSpec) || "RNAV";
  const title = procedures.length > 1
    ? slide.icao + (slide.procedureRunway ? " RWY " + slide.procedureRunway : "") + " " + slide.procedureType
    : slide.icao + " " + getProcedureLabel(procedure);
  const subtitle = procedures.length > 1
    ? String(procedures.length) + " procedures / " + navSpec
    : getProcedureRunwayLabel(procedure) + " / " + navSpec;
  pane.documentStage.innerHTML = [
    '<div class="nord-procedure">',
    '<div class="nord-procedure-band"><strong>' + escapeHtml(title) + '</strong><span>' + escapeHtml(subtitle) + "</span></div>",
    renderNordProceduresSvg(procedures, slide.icao, paneState, title + " NordChart"),
    '<div class="nord-procedure-foot"><span>NordChart generated from local procedure rules. Not for navigation.</span><span>' + escapeHtml(String(totalLegs) + " legs") + "</span></div>",
    "</div>"
  ].join("");
  syncNordMapTransform(pane.index);
  return procedures.length === 1 ? procedure : procedures;
}

function renderTaxiDocument(slide, routeInfo, pane, paneState) {
  const config = getTaxiChartConfig(slide.icao) || {};
  const source = getTaxiPdfSource(slide.icao);
  const sourceOption = getChartSourceOption(slide.chartSource);
  const renderScale = Math.max(1, Number(config.renderScale) || TAXI_RENDER_SCALE);
  const maxScale = Math.max(1, Number(config.maxScale) || TAXI_MAX_SCALE);
  const aspectRatio = Math.max(0.5, Math.min(Number(config.aspectRatio) || 16 / 9, 3));
  const points = routeInfo ? routeInfo.points : [];
  const pointString = getPointString(points);
  const width = Math.max(3, Math.min(Number(state.lineWidth) || 7, 16));
  const haloWidth = width * 2.6;
  const transform = paneState.taxiTransform || { panX: 0, panY: 0, scale: 1 };
  pane.documentStage.innerHTML = [
    '<div class="taxi-map" data-taxi-map data-pan-x="' + escapeHtml(transform.panX) +
      '" data-pan-y="' + escapeHtml(transform.panY) +
      '" data-scale="' + escapeHtml(transform.scale) +
      '" data-render-scale="' + escapeHtml(renderScale) +
      '" data-max-scale="' + escapeHtml(maxScale) +
      '" style="aspect-ratio:' + escapeHtml(aspectRatio) + ';">',
    '<div class="map-controls" aria-label="Taxi chart controls">',
    '<button type="button" data-zoom="in" aria-label="Zoom in">+</button>',
    '<button type="button" data-zoom="out" aria-label="Zoom out">-</button>',
    '<button type="button" data-zoom="reset" aria-label="Reset taxi chart">R</button>',
    "</div>",
    '<div class="taxi-layer" data-taxi-layer>',
    source
      ? '<object class="pdf-frame" title="' + escapeHtml(slide.title) + '" type="application/pdf" data="' + escapeHtml(source) + '" aria-label="' + escapeHtml(slide.title) + '"></object>'
      : '<div class="empty"><div><strong>' + escapeHtml(sourceOption.label) + '</strong><span>' + escapeHtml(sourceOption.emptyLabel + " assigned.") + '</span></div></div>',
    '<svg class="taxi-overlay" viewBox="0 0 ' + TAXI_VIEWBOX.width + " " + TAXI_VIEWBOX.height + '" preserveAspectRatio="none" aria-label="Taxi route overlay">',
    '<rect x="0" y="0" width="' + TAXI_VIEWBOX.width + '" height="' + TAXI_VIEWBOX.height + '" fill="transparent"/>',
    '<polyline class="route-halo" points="' + escapeHtml(pointString) + '" stroke-width="' + formatNumber(haloWidth) + '"></polyline>',
    '<polyline class="route-line" points="' + escapeHtml(pointString) + '" stroke-width="' + formatNumber(width) + '"></polyline>',
    renderRoutePointMarkup(points, width),
    "</svg>",
    "</div>",
    '<div class="taxi-hint">Taxi chart only. Drag to pan, scroll to zoom.</div>',
    "</div>"
  ].join("");
  pane.openLink.hidden = !source;
  if (source) {
    pane.openLink.href = source.split("#")[0];
  } else {
    pane.openLink.removeAttribute("href");
  }
  syncTaxiMapTransform(pane.index);
}

function getTaxiMapTransform(map) {
  const maxScale = Math.max(1, Number(map && map.dataset.maxScale) || TAXI_MAX_SCALE);
  return {
    panX: Number(map && map.dataset.panX) || 0,
    panY: Number(map && map.dataset.panY) || 0,
    scale: Math.max(1, Math.min(Number(map && map.dataset.scale) || 1, maxScale))
  };
}

function getPanBounds(map, scale) {
  const rect = map ? map.getBoundingClientRect() : null;
  if (!rect || !rect.width || !rect.height || scale <= 1) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  return {
    minX: rect.width - rect.width * scale,
    maxX: 0,
    minY: rect.height - rect.height * scale,
    maxY: 0
  };
}

function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(Number(value) || 0, maxValue));
}

function setTaxiMapTransform(map, transform) {
  if (!map) {
    return;
  }
  const renderScale = Math.max(1, Number(map.dataset.renderScale) || TAXI_RENDER_SCALE);
  const maxScale = Math.max(1, Number(map.dataset.maxScale) || TAXI_MAX_SCALE);
  const scale = Math.max(1, Math.min(Number(transform.scale) || 1, maxScale));
  const bounds = getPanBounds(map, scale);
  const panX = clamp(transform.panX, bounds.minX, bounds.maxX);
  const panY = clamp(transform.panY, bounds.minY, bounds.maxY);
  const layer = map.querySelector("[data-taxi-layer]");
  map.dataset.panX = String(panX);
  map.dataset.panY = String(panY);
  map.dataset.scale = String(scale);
  getPaneState(getPaneIndexFromElement(map)).taxiTransform = { panX, panY, scale };
  if (layer) {
    layer.style.width = formatNumber(renderScale * 100) + "%";
    layer.style.height = formatNumber(renderScale * 100) + "%";
    layer.style.transform = "translate(" + formatNumber(panX) + "px, " + formatNumber(panY) + "px) scale(" + formatNumber(scale / renderScale) + ")";
  }
}

function syncTaxiMapTransform(paneIndex = null) {
  const panes = paneIndex === null || paneIndex === undefined ? paneRefs : [paneRefs[paneIndex]].filter(Boolean);
  panes.forEach((pane) => {
    const map = pane.documentStage.querySelector("[data-taxi-map]");
    if (map) {
      setTaxiMapTransform(map, getTaxiMapTransform(map));
    }
  });
}

function zoomTaxiMap(map, factor, clientX, clientY) {
  if (!map) {
    return;
  }
  const rect = map.getBoundingClientRect();
  const current = getTaxiMapTransform(map);
  const nextScale = Math.max(1, Math.min(current.scale * factor, Math.max(1, Number(map.dataset.maxScale) || TAXI_MAX_SCALE)));
  if (Math.abs(nextScale - current.scale) < 0.001) {
    return;
  }
  const originX = Number.isFinite(clientX) ? clientX - rect.left : rect.width / 2;
  const originY = Number.isFinite(clientY) ? clientY - rect.top : rect.height / 2;
  const ratio = nextScale / current.scale;
  setTaxiMapTransform(map, {
    panX: originX - (originX - current.panX) * ratio,
    panY: originY - (originY - current.panY) * ratio,
    scale: nextScale
  });
}

function getNordMapTransform(map) {
  return {
    panX: Number(map && map.dataset.panX) || 0,
    panY: Number(map && map.dataset.panY) || 0,
    scale: Math.max(1, Math.min(Number(map && map.dataset.scale) || 1, NORD_MAX_SCALE))
  };
}

function getNordPanBounds(map, scale) {
  const width = Math.max(1, Number(map && map.dataset.viewboxWidth) || 1000);
  const height = Math.max(1, Number(map && map.dataset.viewboxHeight) || 660);
  const safeScale = Math.max(1, Number(scale) || 1);
  if (safeScale <= 1.0001) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  return {
    minX: width - width * safeScale,
    maxX: 0,
    minY: height - height * safeScale,
    maxY: 0
  };
}

function getNordSemanticMultiplier(scale, role) {
  const zoomStep = Math.log2(Math.max(scale, 1));

  if (role === "route") {
    return Math.max(0.82, Math.min(1.72, 1 + zoomStep * 0.22));
  }

  if (role === "grid") {
    return Math.max(0.58, Math.min(1, 1 - zoomStep * 0.08));
  }

  if (role === "label") {
    return Math.max(0.86, Math.min(1.24, 1 + zoomStep * 0.07));
  }

  if (role === "marker") {
    return Math.max(0.78, Math.min(1.12, 1 + zoomStep * 0.04));
  }

  return Math.max(0.74, Math.min(1.34, 1 + zoomStep * 0.1));
}

function getNordScaledFixLabelBox(labelGroup, factor) {
  const baseX = Number(labelGroup.dataset.baseX) || 0;
  const baseY = Number(labelGroup.dataset.baseY) || 0;
  const boxX = Number(labelGroup.dataset.boxX) || baseX;
  const boxY = Number(labelGroup.dataset.boxY) || baseY;
  const boxWidth = Number(labelGroup.dataset.boxWidth) || 0;
  const boxHeight = Number(labelGroup.dataset.boxHeight) || 0;
  return {
    x: baseX + (boxX - baseX) * factor,
    y: baseY + (boxY - baseY) * factor,
    width: boxWidth * factor,
    height: boxHeight * factor
  };
}

function getNordScaledMarkerBox(markerGroup, factor) {
  const baseX = Number(markerGroup.dataset.baseX) || 0;
  const baseY = Number(markerGroup.dataset.baseY) || 0;
  const radius = (Number(markerGroup.dataset.markerRadius) || 9) * factor;
  return {
    x: baseX - radius,
    y: baseY - radius,
    width: radius * 2,
    height: radius * 2
  };
}

function getNordSegmentOptions(labelGroup) {
  return clean(labelGroup && labelGroup.dataset.labelOptions)
    .split(";")
    .map((pair) => {
      const parts = pair.split(",").map(Number);
      return { offset: parts[0], shift: parts[1] };
    })
    .filter((option) => Number.isFinite(option.offset) && Number.isFinite(option.shift));
}

function getNordDynamicSegmentGeometry(labelGroup, factor, option) {
  const anchorX = Number(labelGroup.dataset.anchorX) || Number(labelGroup.dataset.baseX) || 0;
  const anchorY = Number(labelGroup.dataset.anchorY) || Number(labelGroup.dataset.baseY) || 0;
  const normalX = Number(labelGroup.dataset.normalX) || 0;
  const normalY = Number(labelGroup.dataset.normalY) || 0;
  const tangentX = Number(labelGroup.dataset.tangentX) || 0;
  const tangentY = Number(labelGroup.dataset.tangentY) || 0;
  const offset = Number(option && option.offset) || NORD_SEGMENT_LABEL_OFFSET;
  const shift = Number(option && option.shift) || 0;
  const leadShift = shift + NORD_SEGMENT_LABEL_LEAD;
  return {
    anchor: clean(labelGroup.dataset.textAnchor) || "start",
    angle: Number(labelGroup.dataset.baseAngle) || 0,
    labelX: anchorX + (normalX * offset + tangentX * leadShift) * factor,
    labelY: anchorY + (normalY * offset + tangentY * leadShift) * factor,
    leadShift,
    offset,
    shift
  };
}

function updateNordSegmentLabelVisibility(layer, scale) {
  const safeScale = Math.max(1, Number(scale) || 1);
  const forceAllLabels = safeScale >= NORD_MAX_SCALE - 0.001;
  const labelMultiplier = getNordSemanticMultiplier(safeScale, "label");
  const markerMultiplier = getNordSemanticMultiplier(safeScale, "marker");
  const labelFactor = labelMultiplier / safeScale;
  const markerFactor = markerMultiplier / safeScale;
  const usedBoxes = [];

  layer.querySelectorAll("[data-nord-label]").forEach((labelGroup) => {
    const box = getNordScaledFixLabelBox(labelGroup, labelFactor);
    if (box.width > 0 && box.height > 0) {
      usedBoxes.push(box);
    }
  });

  layer.querySelectorAll("[data-nord-marker]").forEach((markerGroup) => {
    usedBoxes.push(getNordScaledMarkerBox(markerGroup, markerFactor));
  });

  layer.querySelectorAll("[data-nord-segment-label]").forEach((labelGroup) => {
    const options = getNordSegmentOptions(labelGroup);
    const size = {
      width: Number(labelGroup.dataset.labelWidth) || 0,
      height: Number(labelGroup.dataset.labelHeight) || 0
    };

    const candidates = options.map((option) => {
      const geometry = getNordDynamicSegmentGeometry(labelGroup, labelFactor, option);
      const box = getNordSegmentLabelBoxFromSize(geometry, size, labelFactor);
      const overlapCount = usedBoxes.filter((usedBox) => boxesOverlap(box, usedBox, 6)).length;
      return { box, geometry, overlapCount, score: overlapCount * 1200 + geometry.offset / 300 + Math.abs(geometry.shift) / 850 };
    });

    if (forceAllLabels) {
      const chosen = candidates.find((candidate) =>
        Math.abs(candidate.geometry.offset - NORD_SEGMENT_LABEL_OFFSET) < 0.001
        && Math.abs(candidate.geometry.shift) < 0.001
      ) || candidates[0];
      if (!chosen) {
        labelGroup.style.display = "none";
        labelGroup.dataset.visible = "0";
        return;
      }
      labelGroup.style.display = "";
      labelGroup.dataset.visible = "1";
      labelGroup.dataset.activeOffset = formatNumber(chosen.geometry.offset);
      labelGroup.dataset.activeShift = formatNumber(chosen.geometry.shift);
      labelGroup.setAttribute(
        "transform",
        "translate(" + formatNumber(chosen.geometry.labelX) + " " + formatNumber(chosen.geometry.labelY) + ") rotate(" + formatNumber(chosen.geometry.angle) + ") scale(" + formatNumber(labelFactor) + ")"
      );
      usedBoxes.push(chosen.box);
      return;
    }

    const cleanCandidates = candidates.filter((candidate) => candidate.overlapCount === 0);

    if (!cleanCandidates.length) {
      labelGroup.style.display = "none";
      labelGroup.dataset.visible = "0";
      return;
    }

    cleanCandidates.sort((left, right) => left.score - right.score);
    const chosen = cleanCandidates[0];
    if (!chosen) {
      labelGroup.style.display = "none";
      labelGroup.dataset.visible = "0";
      return;
    }
    labelGroup.style.display = "";
    labelGroup.dataset.visible = "1";
    labelGroup.dataset.activeOffset = formatNumber(chosen.geometry.offset);
    labelGroup.dataset.activeShift = formatNumber(chosen.geometry.shift);
    labelGroup.setAttribute(
      "transform",
      "translate(" + formatNumber(chosen.geometry.labelX) + " " + formatNumber(chosen.geometry.labelY) + ") rotate(" + formatNumber(chosen.geometry.angle) + ") scale(" + formatNumber(labelFactor) + ")"
    );
    usedBoxes.push(chosen.box);
  });
}

function updateNordSemanticScale(map, scale) {
  const layer = map && map.querySelector("[data-nord-layer]");
  if (!layer) {
    return;
  }

  const safeScale = Math.max(1, Number(scale) || 1);
  const labelScale = formatNumber(getNordSemanticMultiplier(safeScale, "label") / safeScale);
  const markerScale = formatNumber(getNordSemanticMultiplier(safeScale, "marker") / safeScale);

  layer.querySelectorAll("[data-nord-label]").forEach((labelGroup) => {
    const baseX = Number(labelGroup.dataset.baseX) || 0;
    const baseY = Number(labelGroup.dataset.baseY) || 0;
    labelGroup.setAttribute(
      "transform",
      "translate(" + formatNumber(baseX) + " " + formatNumber(baseY) + ") scale(" + labelScale + ")"
    );
  });

  layer.querySelectorAll("[data-nord-marker]").forEach((markerGroup) => {
    const baseX = Number(markerGroup.dataset.baseX) || 0;
    const baseY = Number(markerGroup.dataset.baseY) || 0;
    markerGroup.setAttribute(
      "transform",
      "translate(" + formatNumber(baseX) + " " + formatNumber(baseY) + ") scale(" + markerScale + ")"
    );
  });

  updateNordSegmentLabelVisibility(layer, safeScale);

  layer.querySelectorAll("text").forEach((label) => {
    if (label.closest("[data-nord-label], [data-nord-segment-label]")) {
      return;
    }

    if (!label.dataset.baseFontSize) {
      label.dataset.baseFontSize = label.getAttribute("font-size") || "";
    }

    const baseFontSize = Number(label.dataset.baseFontSize) || 0;
    if (baseFontSize > 0) {
      label.setAttribute("font-size", formatNumber(baseFontSize * getNordSemanticMultiplier(safeScale, "label") / safeScale));
    }

    if (!label.dataset.baseStrokeWidth) {
      label.dataset.baseStrokeWidth = label.getAttribute("stroke-width") || "";
    }

    const baseStrokeWidth = Number(label.dataset.baseStrokeWidth) || 0;
    if (baseStrokeWidth > 0) {
      label.style.strokeWidth = formatNumber(baseStrokeWidth * getNordSemanticMultiplier(safeScale, "label") / safeScale);
    }
  });

  layer.querySelectorAll("[stroke-width]").forEach((element) => {
    if (element.closest("[data-nord-label], [data-nord-marker], [data-nord-segment-label]")) {
      return;
    }

    if (element.tagName && element.tagName.toLowerCase() === "text") {
      return;
    }

    if (!element.dataset.baseStrokeWidth) {
      element.dataset.baseStrokeWidth = element.getAttribute("stroke-width") || "";
    }

    const baseStrokeWidth = Number(element.dataset.baseStrokeWidth) || 0;
    if (baseStrokeWidth <= 0) {
      return;
    }

    const role = element.dataset.nordRole || "line";
    const strokeMultiplier = getNordSemanticMultiplier(safeScale, role);
    element.style.strokeWidth = formatNumber(baseStrokeWidth * strokeMultiplier / safeScale);
  });
}

function setNordMapTransform(map, transform) {
  if (!map) {
    return;
  }
  const scale = Math.max(1, Math.min(Number(transform.scale) || 1, NORD_MAX_SCALE));
  const bounds = getNordPanBounds(map, scale);
  const panX = Math.max(bounds.minX, Math.min(Number(transform.panX) || 0, bounds.maxX));
  const panY = Math.max(bounds.minY, Math.min(Number(transform.panY) || 0, bounds.maxY));
  const layer = map.querySelector("[data-nord-layer]");
  map.dataset.panX = String(panX);
  map.dataset.panY = String(panY);
  map.dataset.scale = String(scale);
  getPaneState(getPaneIndexFromElement(map)).nordTransform = { panX, panY, scale };
  if (layer) {
    layer.setAttribute("transform", "translate(" + formatNumber(panX) + " " + formatNumber(panY) + ") scale(" + formatNumber(scale) + ")");
    updateNordSemanticScale(map, scale);
  }
}

function syncNordMapTransform(paneIndex = null) {
  const panes = paneIndex === null || paneIndex === undefined ? paneRefs : [paneRefs[paneIndex]].filter(Boolean);
  panes.forEach((pane) => {
    const map = pane.documentStage.querySelector("[data-nord-map]");
    if (map) {
      setNordMapTransform(map, getNordMapTransform(map));
    }
  });
}

function zoomNordMap(map, factor, clientX, clientY) {
  if (!map) {
    return;
  }
  const rect = map.getBoundingClientRect();
  const width = Math.max(1, Number(map.dataset.viewboxWidth) || 1000);
  const height = Math.max(1, Number(map.dataset.viewboxHeight) || 660);
  const current = getNordMapTransform(map);
  const nextScale = Math.max(1, Math.min(current.scale * factor, NORD_MAX_SCALE));
  if (Math.abs(nextScale - current.scale) < 0.001) {
    return;
  }
  const originX = Number.isFinite(clientX) && rect.width ? (clientX - rect.left) / rect.width * width : width / 2;
  const originY = Number.isFinite(clientY) && rect.height ? (clientY - rect.top) / rect.height * height : height / 2;
  const ratio = nextScale / current.scale;
  setNordMapTransform(map, {
    panX: originX - (originX - current.panX) * ratio,
    panY: originY - (originY - current.panY) * ratio,
    scale: nextScale
  });
}

function renderDocument(slide, pane, paneState) {
  if (getSlideProcedures(slide).length) {
    return renderNordProcedureDocument(slide, pane, paneState);
  }

  if (slide.type === "AD4") {
    const routeInfo = getTaxiRouteInfo(slide.icao);
    renderTaxiDocument(slide, routeInfo, pane, paneState);
    return routeInfo;
  }

  if (slide.src) {
    pane.documentStage.innerHTML =
      '<object class="pdf-frame" title="' + escapeHtml(slide.title) + '" type="application/pdf" data="' +
      escapeHtml(slide.src) + '" aria-label="' + escapeHtml(slide.title) + '"></object>';
    pane.openLink.hidden = false;
    pane.openLink.href = slide.src.split("#")[0];
    return;
  }

  pane.openLink.hidden = true;
  pane.openLink.removeAttribute("href");
  pane.documentStage.innerHTML =
    '<div class="empty"><div><strong>' + escapeHtml(slide.sequenceLabel) + '</strong><span>' +
    escapeHtml(slide.airportLabel + " / " + slide.chartSourceLabel + " / " + slide.typeLabel + " / " + slide.fileLabel) +
    "</span></div></div>";
  return null;
}

function renderStrip(slides, pane, paneState) {
  pane.strip.innerHTML = slides.map((slide, index) => (
    '<button type="button" class="step' + (index === paneState.index ? " active" : "") +
    '" data-index="' + index + '" aria-current="' + (index === paneState.index ? "true" : "false") +
    '" aria-label="' + escapeHtml(slide.sequenceLabel + " " + slide.airportLabel) + '">' +
    "<span>" + escapeHtml(String(index + 1) + " " + slide.scope) + "</span>" +
    "<strong>" + escapeHtml(slide.type) + "</strong>" +
    "<span>" + escapeHtml(slide.icao || "--") + "</span>" +
    "</button>"
  )).join("");
}

function renderTopStatus() {
  const slides = getSlides();
  const left = getPaneState(0);
  const right = getPaneState(1);
  refs.progressLabel.textContent = "Charts";
  refs.currentLabel.textContent = String(clampIndex(left.index) + 1) + " | " + String(clampIndex(right.index) + 1) + " / " + slides.length;
}

function renderPane(paneIndex) {
  const pane = paneRefs[paneIndex];
  if (!pane) {
    return;
  }
  const slides = getSlides();
  const paneState = getPaneState(paneIndex);
  paneState.index = clampIndex(paneState.index);
  const slide = slides[paneState.index];
  const routeInfo = slide.type === "AD4" ? getTaxiRouteInfo(slide.icao) : null;
  const routeLabel = routeInfo && routeInfo.ids.length ? routeInfo.ids.join(" -> ") : slide.title;
  const sourceOption = getChartSourceOption(slide.chartSource);
  const procedures = getSlideProcedures(slide);
  pane.headerSourceLabel.textContent = sourceOption.label;
  refs.chartSourceSelect.value = sourceOption.key;
  pane.airportLabel.textContent = slide.airportLabel;
  pane.airportRoleLabel.textContent = slide.scope === "ARR" ? "Arrival airport" : "Departure airport";
  pane.chartTitle.textContent = routeLabel;
  pane.chartTypeLabel.textContent = procedures.length > 1
    ? slide.procedureType + (slide.procedureRunway ? " / RWY " + slide.procedureRunway : "") + " / " + String(procedures.length) + " procedures"
    : procedures.length === 1
      ? slide.procedureType + " / " + getProcedureRunwayLabel(procedures[0])
    : slide.type === "AD4" && routeInfo && routeInfo.runway
      ? routeInfo.runway
      : slide.type + " / " + slide.typeLabel;
  pane.fileLabel.textContent = slide.type === "AD4" ? getTaxiPdfLabel(slide.icao) : slide.fileLabel;
  pane.prevBtn.disabled = paneState.index <= 0;
  pane.nextBtn.disabled = paneState.index >= slides.length - 1;
  renderDocument(slide, pane, paneState);
  renderToolRow(slide, routeInfo, pane);
  renderStrip(slides, pane, paneState);
}

function render() {
  paneRefs.forEach((pane) => renderPane(pane.index));
  renderTopStatus();
}

function isEditable(target) {
  return Boolean(target && target.closest && target.closest("input, select, textarea, [contenteditable='true']"));
}

refs.depSelect.addEventListener("change", () => {
  state.dep = refs.depSelect.value;
  render();
});
refs.arrSelect.addEventListener("change", () => {
  state.arr = refs.arrSelect.value;
  render();
});
refs.chartSourceSelect.addEventListener("change", () => {
  state.chartSource = normalizeChartSource(refs.chartSourceSelect.value);
  render();
});

function bindPaneEvents(pane) {
  pane.pane.addEventListener("pointerdown", () => setActivePane(pane.index));
  pane.prevBtn.addEventListener("click", () => move(-1, pane.index));
  pane.nextBtn.addEventListener("click", () => move(1, pane.index));

  pane.toolRow.addEventListener("change", (event) => {
    const procedureRunwaySelect = event.target.closest("[data-procedure-runway]");
    if (procedureRunwaySelect) {
      const airport = normalizeId(procedureRunwaySelect.dataset.airport || "");
      const procedureType = clean(procedureRunwaySelect.dataset.procedureType).toUpperCase();
      if (airport && procedureType) {
        state.procedureRunways[getProcedureRunwayStateKey(airport, procedureType)] = normalizeRunwayId(procedureRunwaySelect.value);
        render();
      }
      return;
    }

    const fileInput = event.target.closest("[data-load-pdf]");
    if (!fileInput) {
      return;
    }
    const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    const airport = normalizeId(fileInput.dataset.airport || "");
    if (!file || !airport) {
      return;
    }
    const runtimeKey = getRuntimePdfKey(airport);
    const previous = state.runtimePdf[runtimeKey];
    if (previous && previous.url && previous.url.startsWith("blob:")) {
      URL.revokeObjectURL(previous.url.split("#")[0]);
    }
    state.runtimePdf[runtimeKey] = {
      label: file.name || "Loaded PDF",
      url: URL.createObjectURL(file) + PDF_FRAGMENT
    };
    render();
  });

  pane.toolRow.addEventListener("input", (event) => {
    const widthInput = event.target.closest("[data-line-width]");
    if (!widthInput) {
      return;
    }
    state.lineWidth = Math.max(3, Math.min(Number(widthInput.value) || 7, 16));
    render();
  });

  pane.documentStage.addEventListener("click", (event) => {
    const nordZoomButton = event.target.closest("[data-nord-zoom]");
    if (nordZoomButton) {
      const map = nordZoomButton.closest("[data-nord-map]");
      const action = nordZoomButton.dataset.nordZoom || "";
      if (action === "reset") {
        setNordMapTransform(map, { panX: 0, panY: 0, scale: 1 });
        return;
      }
      zoomNordMap(map, action === "out" ? 1 / 1.22 : 1.22);
      return;
    }

    const zoomButton = event.target.closest("[data-zoom]");
    if (!zoomButton) {
      return;
    }
    const map = zoomButton.closest("[data-taxi-map]");
    const action = zoomButton.dataset.zoom || "";
    if (action === "reset") {
      setTaxiMapTransform(map, { panX: 0, panY: 0, scale: 1 });
      return;
    }
    const rect = map ? map.getBoundingClientRect() : null;
    zoomTaxiMap(
      map,
      action === "out" ? 1 / 1.22 : 1.22,
      rect ? rect.left + rect.width / 2 : undefined,
      rect ? rect.top + rect.height / 2 : undefined
    );
  });

  pane.strip.addEventListener("click", (event) => {
    activateStripButtonFromEvent(event, pane.index);
  });
  pane.strip.addEventListener("pointerdown", (event) => {
    const button = event.target && event.target.closest ? event.target.closest("[data-index]") : null;
    getPaneState(pane.index).stripTap = button
      ? { index: button.dataset.index, pointerId: event.pointerId, x: event.clientX, y: event.clientY }
      : null;
  });
  pane.strip.addEventListener("pointerup", (event) => {
    const paneState = getPaneState(pane.index);
    if (!paneState.stripTap || paneState.stripTap.pointerId !== event.pointerId) {
      return;
    }
    const deltaX = event.clientX - paneState.stripTap.x;
    const deltaY = event.clientY - paneState.stripTap.y;
    const index = paneState.stripTap.index;
    paneState.stripTap = null;
    if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) <= 12) {
      setIndex(index, pane.index);
    }
  });
  pane.strip.addEventListener("pointercancel", () => {
    getPaneState(pane.index).stripTap = null;
  });

  pane.documentStage.addEventListener("pointerdown", (event) => {
    if (event.button && event.button !== 0) {
      return;
    }
    const paneState = getPaneState(pane.index);
    const nordMap = event.target.closest("[data-nord-map]");
    if (nordMap && !event.target.closest("button, input, label")) {
      const transform = getNordMapTransform(nordMap);
      paneState.nordPan = {
        map: nordMap,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        panX: transform.panX,
        panY: transform.panY
      };
      nordMap.classList.add("panning");
      if (nordMap.setPointerCapture) {
        nordMap.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      return;
    }
    if (event.target.closest("[data-nord-map]")) {
      return;
    }
    const taxiMap = event.target.closest("[data-taxi-map]");
    if (taxiMap && !event.target.closest("button, input, label")) {
      const transform = getTaxiMapTransform(taxiMap);
      paneState.taxiPan = {
        map: taxiMap,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        panX: transform.panX,
        panY: transform.panY
      };
      taxiMap.classList.add("panning");
      if (taxiMap.setPointerCapture) {
        taxiMap.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      return;
    }
    if (event.target.closest("[data-taxi-map]")) {
      return;
    }
    paneState.swipe = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };
    if (pane.documentStage.setPointerCapture) {
      pane.documentStage.setPointerCapture(event.pointerId);
    }
  });

  pane.documentStage.addEventListener("pointermove", (event) => {
    const paneState = getPaneState(pane.index);
    if (paneState.nordPan && paneState.nordPan.pointerId === event.pointerId) {
      const map = paneState.nordPan.map;
      const rect = map.getBoundingClientRect();
      const width = Math.max(1, Number(map.dataset.viewboxWidth) || 1000);
      const height = Math.max(1, Number(map.dataset.viewboxHeight) || 660);
      const deltaX = rect.width ? (event.clientX - paneState.nordPan.x) / rect.width * width : 0;
      const deltaY = rect.height ? (event.clientY - paneState.nordPan.y) / rect.height * height : 0;
      setNordMapTransform(map, {
        panX: paneState.nordPan.panX + deltaX,
        panY: paneState.nordPan.panY + deltaY,
        scale: getNordMapTransform(map).scale
      });
      event.preventDefault();
      return;
    }

    if (!paneState.taxiPan || paneState.taxiPan.pointerId !== event.pointerId) {
      return;
    }
    const deltaX = event.clientX - paneState.taxiPan.x;
    const deltaY = event.clientY - paneState.taxiPan.y;
    setTaxiMapTransform(paneState.taxiPan.map, {
      panX: paneState.taxiPan.panX + deltaX,
      panY: paneState.taxiPan.panY + deltaY,
      scale: getTaxiMapTransform(paneState.taxiPan.map).scale
    });
    event.preventDefault();
  });

  ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
    pane.documentStage.addEventListener(eventName, (event) => {
      const paneState = getPaneState(pane.index);
      if (paneState.nordPan && paneState.nordPan.pointerId === event.pointerId) {
        paneState.nordPan.map.classList.remove("panning");
        paneState.nordPan = null;
        return;
      }
      if (paneState.taxiPan && paneState.taxiPan.pointerId === event.pointerId) {
        paneState.taxiPan.map.classList.remove("panning");
        paneState.taxiPan = null;
        return;
      }
      if (!paneState.swipe || paneState.swipe.pointerId !== event.pointerId) {
        return;
      }
      const deltaX = event.clientX - paneState.swipe.x;
      const deltaY = event.clientY - paneState.swipe.y;
      paneState.swipe = null;
      if (event.type !== "pointerup" || Math.abs(deltaX) < 46 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) {
        return;
      }
      move(deltaX < 0 ? 1 : -1, pane.index);
    });
  });

  pane.documentStage.addEventListener("wheel", (event) => {
    const nordMap = event.target.closest("[data-nord-map]");
    if (nordMap) {
      event.preventDefault();
      zoomNordMap(nordMap, event.deltaY < 0 ? 1.14 : 1 / 1.14, event.clientX, event.clientY);
      return;
    }

    const taxiMap = event.target.closest("[data-taxi-map]");
    if (!taxiMap) {
      return;
    }
    event.preventDefault();
    zoomTaxiMap(taxiMap, event.deltaY < 0 ? 1.14 : 1 / 1.14, event.clientX, event.clientY);
  }, { passive: false });
}

paneRefs.forEach(bindPaneEvents);
document.addEventListener("keydown", (event) => {
  if (isEditable(event.target) || event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    move(-1, state.activePane);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    move(1, state.activePane);
  }
});
window.addEventListener("resize", () => {
  syncTaxiMapTransform();
  syncNordMapTransform();
});

renderAirportOptions();
render();

}
