// @ts-nocheck -- legacy DOM engine; type it when this screen is migrated to React.
export async function start(loadScript) {
await loadScript("./navdata.js");
await loadScript("./ground-data.js");
await loadScript("./Waypoints/Poland.js");

const STORAGE_KEY = "nordsweet-waypoint-procedure-editor-v1";
const DEFAULT_COUNTRY = "Poland";
const BUILTIN_WAYPOINT_ORIGIN = "NAVDATA";
const BUILTIN_PROCEDURE_ORIGIN = "PROCEDURE_DATA";
const PRIVATE_WAYPOINT_ORIGIN = "PRIVATE";
const LOCAL_PROTOCOLS = new Set(["file:", "http:", "https:"]);
const LOCAL_HOSTS = new Set(["", "localhost", "127.0.0.1", "::1"]);
const APPROACH_TYPES = new Set(["ILS", "RNP", "VOR", "VIS", "LOC", "NDB", "RNAV"]);
const DME_ARC_CATEGORY = "DME_ARC";
const CHART_PDF_VIEW = "#toolbar=0&navpanes=0&scrollbar=0&page=1&view=Fit&zoom=page-fit";
const CHART_MAX_SCALE = 10;
const CHART_RENDER_SCALE = 8;
const CHART_ZOOM_STEP = 1.18;
const CHART_COORDINATE_PRECISION = 1000;

const refs = {
  addDmeArcPointsBtn: document.getElementById("addDmeArcPointsBtn"),
  addLegBtn: document.getElementById("addLegBtn"),
  addMissedLegBtn: document.getElementById("addMissedLegBtn"),
  approachOtherInput: document.getElementById("approachOtherInput"),
  approachTypeSelect: document.getElementById("approachTypeSelect"),
  airportProcedureCountPill: document.getElementById("airportProcedureCountPill"),
  airportProcedureList: document.getElementById("airportProcedureList"),
  chooseDirBtn: document.getElementById("chooseDirBtn"),
  copyBtn: document.getElementById("copyBtn"),
  countryInput: document.getElementById("countryInput"),
  deleteProcedureBtn: document.getElementById("deleteProcedureBtn"),
  deleteWaypointBtn: document.getElementById("deleteWaypointBtn"),
  dmeArcFields: document.getElementById("dmeArcFields"),
  dmeDistanceInput: document.getElementById("dmeDistanceInput"),
  dmeEntryRadialInput: document.getElementById("dmeEntryRadialInput"),
  dmeExitRadialInput: document.getElementById("dmeExitRadialInput"),
  dmeSourceSelect: document.getElementById("dmeSourceSelect"),
  downloadBtn: document.getElementById("downloadBtn"),
  editorShell: document.getElementById("editorShell"),
  exportText: document.getElementById("exportText"),
  fileNamePill: document.getElementById("fileNamePill"),
  finalGlideSlopeInput: document.getElementById("finalGlideSlopeInput"),
  finalGlideSlopeStartPill: document.getElementById("finalGlideSlopeStartPill"),
  legAltitudeTypeSelect: document.getElementById("legAltitudeTypeSelect"),
  legAltitudeValueInput: document.getElementById("legAltitudeValueInput"),
  legNoteInput: document.getElementById("legNoteInput"),
  legRoleSelect: document.getElementById("legRoleSelect"),
  legSpeedTypeSelect: document.getElementById("legSpeedTypeSelect"),
  legSpeedValueInput: document.getElementById("legSpeedValueInput"),
  legWaypointSelect: document.getElementById("legWaypointSelect"),
  missedApproachBlock: document.getElementById("missedApproachBlock"),
  missedCount: document.getElementById("missedCount"),
  missedLegList: document.getElementById("missedLegList"),
  newProcedureBtn: document.getElementById("newProcedureBtn"),
  newWaypointBtn: document.getElementById("newWaypointBtn"),
  openFileBtn: document.getElementById("openFileBtn"),
  openFileInput: document.getElementById("openFileInput"),
  clearVfrPatternBtn: document.getElementById("clearVfrPatternBtn"),
  clearVfrTouchdownBtn: document.getElementById("clearVfrTouchdownBtn"),
  clearVfrThresholdBtn: document.getElementById("clearVfrThresholdBtn"),
  autoVfrTouchdownBtn: document.getElementById("autoVfrTouchdownBtn"),
  pickVfrPatternPointBtn: document.getElementById("pickVfrPatternPointBtn"),
  pickVfrThresholdBtn: document.getElementById("pickVfrThresholdBtn"),
  pickVfrTouchdownBtn: document.getElementById("pickVfrTouchdownBtn"),
  privateGate: document.getElementById("privateGate"),
  procedureAirportInput: document.getElementById("procedureAirportInput"),
  procedureCategorySelect: document.getElementById("procedureCategorySelect"),
  procedureCountPill: document.getElementById("procedureCountPill"),
  procedureDesignatorInput: document.getElementById("procedureDesignatorInput"),
  procedureDirectionSelect: document.getElementById("procedureDirectionSelect"),
  procedureLegList: document.getElementById("procedureLegList"),
  procedureRunwayInput: document.getElementById("procedureRunwayInput"),
  procedureSelect: document.getElementById("procedureSelect"),
  proceduresPanel: document.getElementById("proceduresPanel"),
  proceduresTabBtn: document.getElementById("proceduresTabBtn"),
  procedureSourceInput: document.getElementById("procedureSourceInput"),
  procedureTitleInput: document.getElementById("procedureTitleInput"),
  routeCount: document.getElementById("routeCount"),
  saveFileBtn: document.getElementById("saveFileBtn"),
  saveProcedureBtn: document.getElementById("saveProcedureBtn"),
  saveWaypointBtn: document.getElementById("saveWaypointBtn"),
  status: document.getElementById("status"),
  addNewVfrCircuitBtn: document.getElementById("addNewVfrCircuitBtn"),
  addRunwayVfrCircuitsBtn: document.getElementById("addRunwayVfrCircuitsBtn"),
  deleteVfrCircuitBtn: document.getElementById("deleteVfrCircuitBtn"),
  deleteVfrIntersectionBtn: document.getElementById("deleteVfrIntersectionBtn"),
  clearVfrLinesBtn: document.getElementById("clearVfrLinesBtn"),
  saveVfrCircuitBtn: document.getElementById("saveVfrCircuitBtn"),
  startVfrLineModeBtn: document.getElementById("startVfrLineModeBtn"),
  stopVfrLineModeBtn: document.getElementById("stopVfrLineModeBtn"),
  startVfrCircuitBtn: document.getElementById("startVfrCircuitBtn"),
  stopVfrCircuitBtn: document.getElementById("stopVfrCircuitBtn"),
  undoVfrCircuitPointBtn: document.getElementById("undoVfrCircuitPointBtn"),
  clearVfrCircuitBtn: document.getElementById("clearVfrCircuitBtn"),
  vfrAirportInput: document.getElementById("vfrAirportInput"),
  vfrAirportPill: document.getElementById("vfrAirportPill"),
  vfrAirportSelect: document.getElementById("vfrAirportSelect"),
  vfrChartMap: document.getElementById("vfrChartMap"),
  vfrChartMapLayer: document.getElementById("vfrChartMapLayer"),
  vfrChartMeta: document.getElementById("vfrChartMeta"),
  vfrChartOverlaySvg: document.getElementById("vfrChartOverlaySvg"),
  vfrChartPdfFrame: document.getElementById("vfrChartPdfFrame"),
  vfrChartPdfInput: document.getElementById("vfrChartPdfInput"),
  vfrChartSourceInput: document.getElementById("vfrChartSourceInput"),
  vfrChartTitleInput: document.getElementById("vfrChartTitleInput"),
  vfrCircuitDirectionSelect: document.getElementById("vfrCircuitDirectionSelect"),
  vfrCircuitIdInput: document.getElementById("vfrCircuitIdInput"),
  vfrCircuitPill: document.getElementById("vfrCircuitPill"),
  vfrCircuitPointCount: document.getElementById("vfrCircuitPointCount"),
  vfrCircuitRunwayInput: document.getElementById("vfrCircuitRunwayInput"),
  vfrCircuitSelect: document.getElementById("vfrCircuitSelect"),
  vfrIntersectionPill: document.getElementById("vfrIntersectionPill"),
  vfrIntersectionSelect: document.getElementById("vfrIntersectionSelect"),
  vfrLinePill: document.getElementById("vfrLinePill"),
  vfrPanel: document.getElementById("vfrPanel"),
  vfrPatternMeta: document.getElementById("vfrPatternMeta"),
  vfrPatternPointSelect: document.getElementById("vfrPatternPointSelect"),
  vfrRunwayMeta: document.getElementById("vfrRunwayMeta"),
  vfrTabBtn: document.getElementById("vfrTabBtn"),
  vfrThresholdCoordinateList: document.getElementById("vfrThresholdCoordinateList"),
  vfrTouchdownMeta: document.getElementById("vfrTouchdownMeta"),
  waypointCoordInput: document.getElementById("waypointCoordInput"),
  waypointCountPill: document.getElementById("waypointCountPill"),
  waypointFilterSelect: document.getElementById("waypointFilterSelect"),
  waypointGroupInput: document.getElementById("waypointGroupInput"),
  waypointLatInput: document.getElementById("waypointLatInput"),
  waypointList: document.getElementById("waypointList"),
  waypointLonInput: document.getElementById("waypointLonInput"),
  waypointNameInput: document.getElementById("waypointNameInput"),
  waypointNoteInput: document.getElementById("waypointNoteInput"),
  waypointOriginSelect: document.getElementById("waypointOriginSelect"),
  waypointRulesSelect: document.getElementById("waypointRulesSelect"),
  waypointsPanel: document.getElementById("waypointsPanel"),
  waypointsTabBtn: document.getElementById("waypointsTabBtn"),
  waypointSearchInput: document.getElementById("waypointSearchInput"),
  waypointSourceInput: document.getElementById("waypointSourceInput")
};

let directoryHandle = null;
let selectedWaypoint = "";
let selectedProcedureId = "";
let selectedVfrAirport = "EPKK";
let selectedVfrCircuit = "";
let selectedVfrRunwayTemplate = "";
let selectedVfrIntersection = "";
let vfrCircuitDrawing = false;
let vfrChartPdfUrl = "";
let vfrChartPdfLabel = "";
let vfrChartPanState = null;
let vfrChartDragState = null;
let vfrLineEndpointDragState = null;
let vfrLineDrawingMode = false;
let vfrLineDraft = null;
let vfrPendingLineStart = null;
let vfrPatternPickRole = "";
let vfrThresholdPickActive = false;
let vfrTouchdownPickActive = false;
let suppressNextVfrChartClick = false;
let activeTab = "waypoints";
let draftProcedure = createEmptyProcedure();
let state = getInitialState();

function isLocalEditorAllowed() {
  if (!LOCAL_PROTOCOLS.has(window.location.protocol)) {
    return false;
  }
  if (window.location.protocol === "file:") {
    return true;
  }
  return LOCAL_HOSTS.has(window.location.hostname);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createEmptyProcedure() {
  return {
    id: "",
    airport: "",
    designator: "",
    category: "SID",
    approachType: "",
    finalGlideSlopeDeg: null,
    dmeArc: createEmptyDmeArc(),
    runway: "",
    direction: "ONE_WAY",
    title: "",
    source: "",
    legs: [],
    missedApproach: []
  };
}

function createEmptyDmeArc() {
  return {
    source: "",
    sourceAirport: "",
    sourceCode: "",
    sourceLabel: "",
    sourceFrequency: "",
    distance: "",
    entryRadial: "",
    exitRadial: "",
    entryPoint: "",
    exitPoint: ""
  };
}

function getInitialState() {
  const loaded = getLoadedCountryData(DEFAULT_COUNTRY);
  const stored = getStoredState();
  if (stored && stored.country) {
    return mergeCountryData(getLoadedCountryData(stored.country) || createCountryState(stored.country), stored);
  }
  return loaded || createCountryState(DEFAULT_COUNTRY);
}

function createCountryState(country) {
  return {
    country: normalizeCountryName(country || DEFAULT_COUNTRY),
    waypoints: {},
    procedures: [],
    vfrCircuits: {}
  };
}

function getStoredState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return normalizeCountryData(parsed);
  } catch (error) {
    return null;
  }
}

function saveLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getLocalCountryState()));
}

function getLoadedCountryData(country) {
  const builtinData = getBuiltinCountryData(country);
  const key = normalizeCountryKey(country);
  const store = window.NORDSWEET_PRIVATE_WAYPOINTS || {};
  const privateData = normalizeCountryData(store[key] || null);
  return mergeCountryData(builtinData, privateData) || builtinData || privateData;
}

function getBuiltinCountryData(country) {
  if (normalizeCountryKey(country) !== "POLAND") {
    return null;
  }
  const next = createCountryState(country || DEFAULT_COUNTRY);
  if (window.NORDSWEET_NAVDATA && window.NORDSWEET_NAVDATA.waypoints) {
    const metadata = window.NORDSWEET_NAVDATA.metadata || {};
    Object.keys(window.NORDSWEET_NAVDATA.waypoints || {}).forEach((key) => {
      const waypoint = normalizeWaypoint(Object.assign({}, window.NORDSWEET_NAVDATA.waypoints[key], {
        id: window.NORDSWEET_NAVDATA.waypoints[key].id || key,
        origin: BUILTIN_WAYPOINT_ORIGIN,
        imported: true,
        rules: "IFR",
        source: window.NORDSWEET_NAVDATA.waypoints[key].source || metadata.source || "navdata.js"
      }));
      if (waypoint) {
        next.waypoints[waypoint.key] = waypoint;
      }
    });
  }
  getGroundRunwayThresholdWaypoints().forEach((waypoint) => {
    next.waypoints[waypoint.key] = waypoint;
  });
  return next;
}

function getGroundRunwayThresholdWaypoints() {
  const airports = window.NORDSWEET_GROUND_DATA && window.NORDSWEET_GROUND_DATA.airports
    ? window.NORDSWEET_GROUND_DATA.airports
    : {};
  const waypoints = [];
  Object.keys(airports).sort().forEach((airportIcao) => {
    const airport = normalizeAirportIcao(airportIcao);
    const runways = airports[airportIcao] && airports[airportIcao].airport && Array.isArray(airports[airportIcao].airport.runways)
      ? airports[airportIcao].airport.runways
      : [];
    runways.forEach((runway) => {
      const runwayId = normalizeRunwayId(runway && runway.id);
      const threshold = runway && runway.threshold && typeof runway.threshold === "object" ? runway.threshold : {};
      const lat = toNullableNumber(threshold.lat);
      const lon = toNullableNumber(threshold.lon);
      const waypointId = normalizeWaypointName("RW" + runwayId);
      const key = getWaypointKey(waypointId, airport);
      if (!airport || !runwayId || !key || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        return;
      }
      waypoints.push({
        id: waypointId,
        group: airport,
        key,
        name: key,
        rules: "BOTH",
        ruleSet: ["IFR", "VFR"],
        lat,
        lon,
        coord: formatCoord(lat, lon),
        source: "ground-data.js runway threshold",
        note: "RWY " + runwayId + " threshold",
        routes: [],
        origin: BUILTIN_WAYPOINT_ORIGIN,
        imported: true,
        runwayThreshold: {
          airport,
          runway: runwayId,
          thresholdId: String(threshold.id || ("THR" + runwayId)).toUpperCase()
        },
        dmeArcPoint: null
      });
    });
  });
  return waypoints;
}

function getGroundVorOptions() {
  const airports = window.NORDSWEET_GROUND_DATA && window.NORDSWEET_GROUND_DATA.airports
    ? window.NORDSWEET_GROUND_DATA.airports
    : {};
  const options = [];
  Object.keys(airports).sort().forEach((airportIcao) => {
    const airportData = airports[airportIcao] || {};
    (airportData.elements || [])
      .filter((element) => String(element && element.type || "").toLowerCase() === "vor")
      .forEach((element) => {
        const code = normalizeVorCode(element.code || element.id);
        if (!code) {
          return;
        }
        const frequency = String(element.frequency || element.freq || "").trim();
        const label = [airportIcao, code, frequency ? frequency + " MHz" : ""].filter(Boolean).join(" / ");
        options.push({
          value: airportIcao + ":" + code,
          airport: airportIcao,
          code,
          frequency,
          label,
          rawLabel: String(element.label || "").trim()
        });
      });
  });
  return options;
}

function normalizeVorCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
}

function getGroundVorOption(value) {
  const normalized = String(value || "").toUpperCase();
  return getGroundVorOptions().find((option) => option.value.toUpperCase() === normalized || option.code === normalized) || null;
}

function mergeCountryData(baseData, overlayData) {
  if (!baseData && !overlayData) {
    return null;
  }
  const country = (overlayData && overlayData.country) || (baseData && baseData.country) || DEFAULT_COUNTRY;
  const next = createCountryState(country);
  Object.assign(next.waypoints, baseData && baseData.waypoints ? clone(baseData.waypoints) : {});
  Object.keys((overlayData && overlayData.waypoints) || {}).forEach((key) => {
    const waypoint = normalizeWaypoint(Object.assign({}, overlayData.waypoints[key], { key: overlayData.waypoints[key].key || key }));
    if (waypoint) {
      next.waypoints[waypoint.key] = waypoint;
    }
  });
  next.procedures = mergeProcedureLists(
    (baseData && baseData.procedures) || [],
    (overlayData && overlayData.procedures) || []
  );
  next.vfrCircuits = mergeVfrCircuitData(
    (baseData && baseData.vfrCircuits) || {},
    (overlayData && overlayData.vfrCircuits) || {}
  );
  return next;
}

function mergeVfrCircuitData(baseCircuits, overlayCircuits) {
  const merged = {};
  [baseCircuits, overlayCircuits].forEach((source) => {
    Object.keys(source || {}).forEach((airport) => {
      const normalizedAirport = normalizeAirportIcao(airport);
      if (!normalizedAirport) {
        return;
      }
      const existing = merged[normalizedAirport] || createEmptyVfrAirport(normalizedAirport);
      const normalized = normalizeVfrAirportData(Object.assign({ airport: normalizedAirport }, source[airport]));
      merged[normalizedAirport] = {
        airport: normalizedAirport,
        chart: Object.assign({}, existing.chart || {}, normalized.chart || {}),
        intersections: normalized.intersections.length ? normalized.intersections : existing.intersections,
        thresholdPoints: Object.assign({}, existing.thresholdPoints || {}, normalized.thresholdPoints || {}),
        constructionLines: normalized.constructionLines.length ? normalized.constructionLines : existing.constructionLines,
        circuits: Object.assign({}, existing.circuits || {}, normalized.circuits || {})
      };
    });
  });
  return merged;
}

function mergeProcedureLists(baseProcedures, overlayProcedures) {
  const merged = [];
  const indexes = new Map();
  (baseProcedures || []).forEach((procedure) => {
    const copy = clone(procedure);
    indexes.set(getProcedureDataKey(copy), merged.length);
    merged.push(copy);
  });
  (overlayProcedures || []).forEach((procedure) => {
    const copy = clone(procedure);
    const key = getProcedureDataKey(copy);
    if (indexes.has(key)) {
      merged[indexes.get(key)] = copy;
    } else {
      indexes.set(key, merged.length);
      merged.push(copy);
    }
  });
  return merged;
}

function getProcedureDataKey(procedure) {
  return [
    normalizeProcedureToken(procedure && procedure.airport, 4),
    normalizeProcedureCategory(procedure && procedure.category),
    normalizeProcedureId(procedure && procedure.id)
  ].join("|");
}

function getLocalCountryState() {
  const local = createCountryState(state.country);
  Object.values(state.waypoints)
    .filter((waypoint) => !waypoint.imported)
    .forEach((waypoint) => {
      local.waypoints[waypoint.key || getWaypointDisplayId(waypoint)] = clone(waypoint);
    });
  local.procedures = clone(state.procedures.filter((procedure) => procedure.origin !== BUILTIN_PROCEDURE_ORIGIN));
  local.vfrCircuits = clone(state.vfrCircuits || {});
  return local;
}

function normalizeCountryName(value) {
  const cleaned = String(value || DEFAULT_COUNTRY).trim().replace(/[^A-Za-z0-9 _-]/g, "");
  return cleaned || DEFAULT_COUNTRY;
}

function normalizeCountryKey(value) {
  return normalizeCountryName(value).replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "POLAND";
}

function getCountryFileName(country = state.country) {
  const base = normalizeCountryName(country).replace(/[^A-Za-z0-9_-]/g, "");
  return (base || DEFAULT_COUNTRY) + ".js";
}

function normalizeWaypointName(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function normalizeWaypointGroup(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

function parseWaypointReference(value, fallbackGroup = "") {
  const raw = String(value || "").trim().toUpperCase();
  const parts = raw.split("/");
  const id = normalizeWaypointName(parts[0]);
  const group = normalizeWaypointGroup(parts[1] || fallbackGroup);
  return {
    id,
    group,
    key: getWaypointKey(id, group)
  };
}

function getWaypointKey(id, group = "") {
  const normalizedId = normalizeWaypointName(id);
  const normalizedGroup = normalizeWaypointGroup(group);
  if (!normalizedId) {
    return "";
  }
  if (!normalizedGroup) {
    return normalizedId;
  }
  if (isRunwayWaypointId(normalizedId)) {
    return normalizedId + "/" + normalizedGroup;
  }
  if (normalizedId.length === 5 && normalizedId.indexOf(normalizedGroup) === 0) {
    return normalizedId;
  }
  return normalizedGroup + normalizedId.charAt(0);
}

function isRunwayWaypointId(id) {
  return /^RW\d{1,2}[LRC]?$/.test(normalizeWaypointName(id));
}

function normalizeWaypointLegReference(value, fallbackAirport = "") {
  const parsed = parseWaypointReference(value);
  if (parsed.key && !parsed.group && fallbackAirport && isRunwayWaypointId(parsed.id)) {
    return getWaypointKey(parsed.id, fallbackAirport);
  }
  return parsed.key;
}

function getWaypointDisplayId(waypointOrKey) {
  if (typeof waypointOrKey === "string") {
    return parseWaypointReference(waypointOrKey).key;
  }
  return getWaypointKey(waypointOrKey && waypointOrKey.id, waypointOrKey && waypointOrKey.group);
}

function getWaypointByRef(ref) {
  const parsed = parseWaypointReference(ref);
  return parsed.key
    ? state.waypoints[parsed.key] || (!parsed.group ? state.waypoints[parsed.id] : null) || null
    : null;
}

function normalizeWaypointSearch(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9/]/g, "").slice(0, 11);
}

function normalizeAirportIcao(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

function getChartCountryFolder(airportIcao) {
  const airport = normalizeAirportIcao(airportIcao);
  if (airport.startsWith("EP")) {
    return "Poland";
  }
  if (airport.startsWith("LZ")) {
    return "Slovakia";
  }
  return "Unknown";
}

function encodeChartPathPart(value) {
  return encodeURIComponent(String(value || "").trim().replace(/[\\/]+/g, ""));
}

function getVfrChartFileSource(fileName, airportIcao) {
  const safeName = String(fileName || "").trim().replace(/[\\/]+/g, "");
  const airport = normalizeAirportIcao(airportIcao);
  if (!safeName) {
    return "";
  }
  return "./charts/" + [
    getChartCountryFolder(airport),
    airport || "UNKNOWN",
    "National AIP",
    "AD13.pdf"
  ].map(encodeChartPathPart).join("/");
}

function normalizeVfrCircuitId(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 12);
}

function normalizeVfrCircuitDirection(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "RIGHT" || normalized === "R") {
    return "RIGHT";
  }
  if (normalized === "BOTH" || normalized === "PUBLISHED") {
    return "BOTH";
  }
  return "LEFT";
}

function normalizeIntersectionId(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24);
}

function normalizeProcedureToken(value, maxLength) {
  const token = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return maxLength ? token.slice(0, maxLength) : token;
}

function normalizeRules(value) {
  if (Array.isArray(value)) {
    const joined = value.map((item) => String(item || "").toUpperCase()).join("/");
    if (joined.includes("IFR") && joined.includes("VFR")) {
      return "BOTH";
    }
    return joined.includes("VFR") ? "VFR" : "IFR";
  }
  const normalized = String(value || "IFR").toUpperCase();
  if (normalized === "BOTH" || normalized === "IFR+VFR" || normalized === "IFR/VFR") {
    return "BOTH";
  }
  return normalized === "VFR" ? "VFR" : "IFR";
}

function getRulesArray(rules) {
  const normalized = normalizeRules(rules);
  return normalized === "BOTH" ? ["IFR", "VFR"] : [normalized];
}

function normalizeWaypoint(raw) {
  const rawGroup = raw && (raw.group || raw.airport || raw.icao);
  const refSource = raw && rawGroup && raw.id
    ? raw.id
    : raw && (raw.key || raw.ref || raw.id || raw.name);
  const parsedRef = parseWaypointReference(refSource, rawGroup);
  const id = parsedRef.id;
  if (!id) {
    return null;
  }
  const lat = toNullableNumber(raw.lat);
  const lon = toNullableNumber(raw.lon);
  const rules = normalizeRules(raw.rules || raw.ruleSet || raw.type || raw.category || "");
  return {
    id,
    group: parsedRef.group,
    key: parsedRef.key,
    name: parsedRef.key,
    rules,
    ruleSet: getRulesArray(rules),
    lat,
    lon,
    coord: String(raw.coord || formatCoord(lat, lon) || "").toUpperCase(),
    source: String(raw.source || "").trim(),
    note: String(raw.note || "").trim(),
    routes: Array.isArray(raw.routes) ? raw.routes.map((route) => String(route || "").toUpperCase()).filter(Boolean) : [],
    origin: String(raw.origin || PRIVATE_WAYPOINT_ORIGIN).toUpperCase() === BUILTIN_WAYPOINT_ORIGIN
      ? BUILTIN_WAYPOINT_ORIGIN
      : PRIVATE_WAYPOINT_ORIGIN,
    imported: raw.imported === true,
    navaid: raw.navaid && typeof raw.navaid === "object" ? clone(raw.navaid) : null,
    cup: raw.cup && typeof raw.cup === "object" ? clone(raw.cup) : null,
    dmeArcPoint: raw.dmeArcPoint && typeof raw.dmeArcPoint === "object" ? clone(raw.dmeArcPoint) : null
  };
}

function createEmptyVfrAirport(airport = selectedVfrAirport) {
  return {
    airport: normalizeAirportIcao(airport),
    chart: {
      title: "",
      src: "",
      renderScale: CHART_RENDER_SCALE,
      maxScale: CHART_MAX_SCALE,
      aspectRatio: 16 / 9,
      color: true
    },
    intersections: [],
    thresholdPoints: {},
    constructionLines: [],
    circuits: {}
  };
}

function toOverlayCoordinate(value) {
  const number = Number(value);
  const clamped = Math.max(0, Math.min(1000, Number.isFinite(number) ? number : 0));
  return Math.round(clamped * CHART_COORDINATE_PRECISION) / CHART_COORDINATE_PRECISION;
}

function normalizeChartPoint(point, airportData) {
  const intersectionId = normalizeIntersectionId(point && (point.intersectionId || point.sourceIntersectionId || point.id));
  const intersection = intersectionId && airportData
    ? getVfrIntersectionById(airportData, intersectionId)
    : null;
  const normalized = {
    x: toOverlayCoordinate(intersection ? intersection.x : point && point.x),
    y: toOverlayCoordinate(intersection ? intersection.y : point && point.y)
  };
  const role = normalizeTrafficPatternRole(point && (point.role || point.trafficPatternRole || point.patternRole));
  const label = String(point && point.label || "").trim();
  if (role) {
    normalized.role = role;
  }
  if (label) {
    normalized.label = label;
  } else if (role) {
    normalized.label = getTrafficPatternRoleLabel(role);
  }
  if (intersection) {
    normalized.intersectionId = intersection.id;
  } else if (intersectionId) {
    normalized.intersectionId = intersectionId;
  }
  return normalized;
}

function normalizeTrafficPatternRole(value) {
  const role = String(value || "").toUpperCase().replace(/[^A-Z0-9_]/g, "");
  return [
    "TURN1",
    "TURN2",
    "TURN3",
    "TURN4",
    "CROSSWIND",
    "DOWNWIND",
    "BASELEG",
    "FINAL",
    "OVER_AIRFIELD",
    "TOUCHDOWN",
    "THRESHOLD"
  ].includes(role) ? role : "";
}

function getTrafficPatternRoleLabel(role) {
  return {
    TURN1: "1",
    TURN2: "2",
    TURN3: "3",
    TURN4: "4 / Final",
    CROSSWIND: "Crosswind",
    DOWNWIND: "Downwind",
    BASELEG: "Base leg",
    FINAL: "Final",
    OVER_AIRFIELD: "Over Airfield",
    TOUCHDOWN: "Touchdown",
    THRESHOLD: "Threshold"
  }[normalizeTrafficPatternRole(role)] || "";
}

function normalizeTrafficPattern(rawPattern, airportData) {
  const rawTurns = rawPattern && rawPattern.turns && typeof rawPattern.turns === "object" ? rawPattern.turns : {};
  const turns = {};
  ["TURN1", "TURN2", "TURN3", "TURN4"].forEach((role) => {
    const point = rawTurns[role] || rawPattern && rawPattern[role];
    if (point && typeof point === "object") {
      turns[role] = normalizeChartPoint(Object.assign({}, point, {
        role,
        label: getTrafficPatternRoleLabel(role)
      }), airportData);
    }
  });
  return {
    turns,
    generated: rawPattern && rawPattern.generated === true
  };
}

function normalizeTouchdownPoint(rawPoint, airportData) {
  if (!rawPoint || typeof rawPoint !== "object") {
    return null;
  }
  const mode = String(rawPoint.mode || rawPoint.source || "").toUpperCase() === "MANUAL" ? "MANUAL" : "AUTO";
  const normalized = normalizeChartPoint(Object.assign({}, rawPoint, {
    role: "TOUCHDOWN",
    label: "Touchdown"
  }), airportData);
  const point = {
    mode,
    label: "Touchdown",
    runway: normalizeProcedureToken(rawPoint.runway, 4),
    rule: String(rawPoint.rule || "").toUpperCase(),
    source: String(rawPoint.source || "").toUpperCase()
  };
  const hasOverlayPoint = Object.prototype.hasOwnProperty.call(rawPoint, "x")
    || Object.prototype.hasOwnProperty.call(rawPoint, "y")
    || normalized.intersectionId;
  if (hasOverlayPoint && Number.isFinite(normalized.x) && Number.isFinite(normalized.y)) {
    point.x = normalized.x;
    point.y = normalized.y;
  }
  if (normalized.intersectionId) {
    point.intersectionId = normalized.intersectionId;
  }
  if (Number.isFinite(Number(rawPoint.length_m))) {
    point.length_m = Number(rawPoint.length_m);
  }
  if (Number.isFinite(Number(rawPoint.distanceFromThresholdM))) {
    point.distanceFromThresholdM = Number(rawPoint.distanceFromThresholdM);
  }
  if (Number.isFinite(Number(rawPoint.lat)) && Number.isFinite(Number(rawPoint.lon))) {
    point.lat = Number(rawPoint.lat);
    point.lon = Number(rawPoint.lon);
  }
  return point;
}

function normalizeVfrAirportData(raw) {
  const airport = normalizeAirportIcao(raw && (raw.airport || raw.icao));
  const chart = raw && raw.chart && typeof raw.chart === "object" ? raw.chart : {};
  const next = createEmptyVfrAirport(airport);
  next.chart = {
    title: String(chart.title || chart.label || "").trim(),
    src: String(chart.src || chart.url || "").trim(),
    renderScale: Math.max(1, Number(chart.renderScale) || CHART_RENDER_SCALE),
    maxScale: Math.max(1, Number(chart.maxScale) || CHART_MAX_SCALE),
    aspectRatio: Math.max(0.5, Math.min(3, Number(chart.aspectRatio) || 16 / 9)),
    color: chart.color !== false
  };

  const seenIntersections = new Set();
  next.intersections = (Array.isArray(raw && raw.intersections) ? raw.intersections : [])
    .map((intersection) => {
      const id = normalizeIntersectionId(intersection && intersection.id);
      return {
        id,
        label: String((intersection && intersection.label) || id).trim(),
        x: toOverlayCoordinate(intersection && intersection.x),
        y: toOverlayCoordinate(intersection && intersection.y)
      };
    })
    .filter((intersection) => {
      if (!intersection.id || seenIntersections.has(intersection.id)) {
        return false;
      }
      seenIntersections.add(intersection.id);
      return true;
    })
    .sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));

  next.constructionLines = (Array.isArray(raw && raw.constructionLines) ? raw.constructionLines : [])
    .map((line, index) => ({
      id: normalizeIntersectionId(line && line.id) || "LINE-" + String(index + 1).padStart(2, "0"),
      x1: toOverlayCoordinate(line && line.x1),
      y1: toOverlayCoordinate(line && line.y1),
      x2: toOverlayCoordinate(line && line.x2),
      y2: toOverlayCoordinate(line && line.y2)
    }))
    .filter((line) => Math.hypot(line.x2 - line.x1, line.y2 - line.y1) >= 4);

  const rawThresholdPoints = raw && raw.thresholdPoints && typeof raw.thresholdPoints === "object" && !Array.isArray(raw.thresholdPoints)
    ? raw.thresholdPoints
    : {};
  Object.keys(rawThresholdPoints).forEach((runwayId) => {
    const id = normalizeRunwayId(runwayId);
    const point = rawThresholdPoints[runwayId];
    if (id && point && typeof point === "object") {
      next.thresholdPoints[id] = normalizeChartPoint(Object.assign({}, point, {
        role: "THRESHOLD",
        label: "THR " + id
      }), next);
    }
  });

  const rawCircuits = raw && raw.circuits && typeof raw.circuits === "object" && !Array.isArray(raw.circuits)
    ? raw.circuits
    : {};
  Object.keys(rawCircuits).forEach((circuitId) => {
    const rawCircuit = rawCircuits[circuitId] || {};
    const id = normalizeVfrCircuitId(rawCircuit.id || circuitId);
    if (!id) {
      return;
    }
    const points = (Array.isArray(rawCircuit.points) ? rawCircuit.points : [])
      .map((point) => normalizeChartPoint(point, next))
      .filter((point, index, list) => {
        const previous = list[index - 1];
        return !previous || previous.x !== point.x || previous.y !== point.y || previous.intersectionId !== point.intersectionId;
      });
    next.circuits[id] = {
      id,
      label: String(rawCircuit.label || id).trim(),
      runway: String(rawCircuit.runway || "").trim().toUpperCase(),
      direction: normalizeVfrCircuitDirection(rawCircuit.direction),
      trafficPattern: normalizeTrafficPattern(rawCircuit.trafficPattern || {}, next),
      touchdownPoint: normalizeTouchdownPoint(rawCircuit.touchdownPoint || rawCircuit.touchdown || null, next),
      closed: rawCircuit.closed === true,
      points,
      notForNavigation: true
    };
  });
  return next;
}

function normalizeCountryData(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const country = normalizeCountryName(raw.country || (raw.metadata && raw.metadata.country) || DEFAULT_COUNTRY);
  const next = createCountryState(country);
  Object.keys(raw.waypoints || {}).forEach((key) => {
    const waypoint = normalizeWaypoint(Object.assign({}, raw.waypoints[key], { key: raw.waypoints[key].key || key }));
    if (waypoint) {
      next.waypoints[waypoint.key] = waypoint;
    }
  });
  next.procedures = normalizeProcedures(raw.procedures);
  const rawVfrCircuits = raw.vfrCircuits || raw.vfrCircuitOverlays || {};
  Object.keys(rawVfrCircuits || {}).forEach((airport) => {
    const normalized = normalizeVfrAirportData(Object.assign({ airport }, rawVfrCircuits[airport]));
    if (normalized.airport) {
      next.vfrCircuits[normalized.airport] = normalized;
    }
  });
  return next;
}

function normalizeProcedures(rawProcedures, origin = PRIVATE_WAYPOINT_ORIGIN) {
  if (Array.isArray(rawProcedures)) {
    return rawProcedures.map((procedure) => normalizeProcedure(Object.assign({ origin }, procedure))).filter(Boolean);
  }
  const list = [];
  Object.keys(rawProcedures || {}).forEach((airport) => {
    const group = rawProcedures[airport] || {};
    ["sids", "stars", "approaches", "dmeArcs", "other"].forEach((bucket) => {
      const procedures = Array.isArray(group[bucket]) ? group[bucket] : [];
      procedures.forEach((procedure) => {
        list.push(normalizeProcedure(Object.assign({ airport, origin }, procedure)));
      });
    });
  });
  return list.filter(Boolean);
}

function normalizeProcedure(raw) {
  const category = normalizeProcedureCategory(raw.category || raw.type);
  const airport = normalizeProcedureToken(raw.airport, 4);
  const designator = normalizeDesignator(raw.designator || raw.id || "");
  const dmeArc = category === DME_ARC_CATEGORY ? normalizeDmeArc(raw.dmeArc || raw, airport) : createEmptyDmeArc();
  const id = normalizeProcedureId(raw.id || [airport, category, raw.approachType || dmeArc.sourceCode, designator, raw.runway].filter(Boolean).join("_"));
  if (!id && !designator) {
    return null;
  }
  return {
    id: id || normalizeProcedureId([airport, category, designator].join("_")),
    airport,
    designator,
    category,
    approachType: normalizeApproachType(raw.approachType || (category === "APPROACH" ? raw.type : "")),
    finalGlideSlopeDeg: category === "APPROACH" ? normalizeFinalGlideSlope(raw.finalGlideSlopeDeg || raw.glideSlopeDeg || raw.glideSlope || raw.finalGlideSlope) : null,
    dmeArc,
    runway: normalizeProcedureToken(Array.isArray(raw.runways) ? raw.runways[0] : raw.runway, 4),
    direction: normalizeProcedureDirection(raw.direction || (raw.bidirectional ? "BIDIRECTIONAL" : "")),
    title: String(raw.title || "").trim(),
    source: String(raw.source || raw.sourcePdf || "").trim(),
    legs: normalizeLegs(raw.legs, airport),
    missedApproach: normalizeLegs(raw.missedApproach, airport),
    origin: String(raw.origin || PRIVATE_WAYPOINT_ORIGIN).toUpperCase() === BUILTIN_PROCEDURE_ORIGIN
      ? BUILTIN_PROCEDURE_ORIGIN
      : PRIVATE_WAYPOINT_ORIGIN
  };
}

function normalizeDmeArc(raw, fallbackAirport = "") {
  const sourceOption = getGroundVorOption(raw.dmeSource || raw.source || raw.sourceCode || raw.sourceVor || "");
  const sourceCode = normalizeVorCode((sourceOption && sourceOption.code) || raw.sourceCode || raw.dmeSource || raw.source || "");
  const sourceAirport = normalizeProcedureToken((sourceOption && sourceOption.airport) || raw.sourceAirport || fallbackAirport, 4);
  const sourceValue = sourceOption ? sourceOption.value : [sourceAirport, sourceCode].filter(Boolean).join(":");
  const entryRadial = normalizeRadial(raw.entryRadial);
  const exitRadial = normalizeRadial(raw.exitRadial);
  return {
    source: sourceValue,
    sourceAirport,
    sourceCode,
    sourceLabel: String((sourceOption && sourceOption.label) || raw.sourceLabel || sourceCode || "").trim(),
    sourceFrequency: String((sourceOption && sourceOption.frequency) || raw.sourceFrequency || raw.frequency || "").trim(),
    distance: normalizeDmeDistance(raw.distance || raw.dmeDistance || raw.distanceNm || ""),
    entryRadial,
    exitRadial,
    entryPoint: normalizeWaypointName(raw.entryPoint) || createDmeArcPointName(sourceCode, entryRadial),
    exitPoint: normalizeWaypointName(raw.exitPoint) || createDmeArcPointName(sourceCode, exitRadial)
  };
}

function normalizeRadial(value) {
  const cleaned = String(value || "").toUpperCase().replace(/[^0-9.]/g, "");
  if (!cleaned) {
    return "";
  }
  const radialNumber = Number(cleaned);
  if (!Number.isFinite(radialNumber)) {
    return "";
  }
  const rounded = Math.round(radialNumber);
  if (rounded < 0 || rounded > 360) {
    return "";
  }
  return String(rounded === 360 ? 360 : rounded).padStart(3, "0");
}

function normalizeDmeDistance(value) {
  const raw = String(value || "").toUpperCase().replace(/DME|NM/g, "").replace(",", ".").trim();
  const number = Number(raw);
  return Number.isFinite(number) && number > 0 ? String(Math.round(number * 10) / 10) : "";
}

function createDmeArcPointName(sourceCode, radial) {
  const code = normalizeVorCode(sourceCode);
  const normalizedRadial = normalizeRadial(radial);
  return code && normalizedRadial ? normalizeWaypointName(code + normalizedRadial) : "";
}

function normalizeProcedureDirection(value) {
  const normalized = String(value || "ONE_WAY").toUpperCase().replace(/[^A-Z0-9_ -]/g, "").replace(/[\s-]+/g, "_");
  if (normalized === "BIDIRECTIONAL" || normalized === "TWO_WAY" || normalized === "BOTH" || normalized === "2_WAY") {
    return "BIDIRECTIONAL";
  }
  return "ONE_WAY";
}

function normalizeFinalGlideSlope(value) {
  const raw = value && typeof value === "object"
    ? (value.angleDeg || value.deg || value.value || value.slope)
    : value;
  const number = Number(String(raw || "").replace(",", ".").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) && number > 0 && number < 10 ? Math.round(number * 100) / 100 : null;
}

function normalizeApproachPointRole(value) {
  const normalized = String(value || "").toUpperCase().replace(/[^A-Z]/g, "");
  return normalized === "IAF" || normalized === "IF" || normalized === "FAF" ? normalized : "";
}

function getFinalGlideSlopeStartWaypoint(procedure) {
  const fafLeg = procedure && Array.isArray(procedure.legs)
    ? procedure.legs.find((leg) => normalizeApproachPointRole(leg.role) === "FAF")
    : null;
  return fafLeg ? fafLeg.waypoint : "";
}

function normalizeAltitudeRestrictionType(value) {
  const normalized = String(value || "AT").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (normalized === "AT_OR_BELOW" || normalized === "BELOW" || normalized === "MAXIMUM" || normalized === "MAX") {
    return "AT_OR_BELOW";
  }
  if (normalized === "AT_OR_ABOVE" || normalized === "ABOVE" || normalized === "MINIMUM" || normalized === "MIN") {
    return "AT_OR_ABOVE";
  }
  return "AT";
}

function normalizeSpeedRestrictionType(value) {
  const normalized = String(value || "MAINTAIN").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (normalized === "MORE_THAN" || normalized === "MORE" || normalized === "ABOVE" || normalized === "MINIMUM" || normalized === "MIN") {
    return "MORE_THAN";
  }
  if (normalized === "LESS_THAN" || normalized === "LESS" || normalized === "BELOW" || normalized === "MAXIMUM" || normalized === "MAX") {
    return "LESS_THAN";
  }
  return "MAINTAIN";
}

function getAltitudeRestrictionLabel(type) {
  const normalized = normalizeAltitudeRestrictionType(type);
  if (normalized === "AT_OR_BELOW") {
    return "At or Below";
  }
  if (normalized === "AT_OR_ABOVE") {
    return "At or Above";
  }
  return "At";
}

function getSpeedRestrictionLabel(type) {
  const normalized = normalizeSpeedRestrictionType(type);
  if (normalized === "MORE_THAN") {
    return "More than";
  }
  if (normalized === "LESS_THAN") {
    return "Less than";
  }
  return "Maintain";
}

function parseAltitudeRestrictionValue(value, fallbackUnit = "") {
  const raw = String(value || "").toUpperCase().replace(",", ".").trim();
  const unitHint = String(fallbackUnit || "").toUpperCase();
  if (!raw) {
    return null;
  }
  const isFlightLevel = /^FL\s*\d/.test(raw) || unitHint === "FL";
  const number = Number(raw.replace(/^FL\s*/, "").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(number)) {
    return null;
  }
  const unit = isFlightLevel ? "FL" : "FT";
  const roundedValue = unit === "FL" ? Math.round(number) : Math.round(number);
  return {
    value: roundedValue,
    unit,
    display: unit === "FL" ? "FL" + String(roundedValue).padStart(3, "0") : roundedValue + " FT",
    altitudeFt: unit === "FL" ? roundedValue * 100 : roundedValue,
    flightLevel: unit === "FL"
  };
}

function normalizeAltitudeRestriction(rawAltitude) {
  if (!rawAltitude) {
    return null;
  }
  const source = typeof rawAltitude === "object" ? rawAltitude : { value: rawAltitude };
  const parsed = parseAltitudeRestrictionValue(
    source.value || source.altitude || source.altitudeFt || source.raw || source.text,
    source.unit
  );
  if (!parsed) {
    const fallbackRaw = String(source.raw || source.text || "").trim();
    return fallbackRaw && /(\d|FL)/i.test(fallbackRaw) ? clone(source) : null;
  }
  const type = normalizeAltitudeRestrictionType(source.type || source.restriction || source.kind);
  return {
    type,
    value: parsed.value,
    unit: parsed.unit,
    altitudeFt: parsed.altitudeFt,
    flightLevel: parsed.flightLevel,
    raw: getAltitudeRestrictionLabel(type) + " " + parsed.display
  };
}

function normalizeSpeedRestriction(rawSpeed) {
  if (!rawSpeed || typeof rawSpeed !== "object") {
    return null;
  }
  const value = toNullableNumber(rawSpeed.value || rawSpeed.speedKt || rawSpeed.speed);
  if (!Number.isFinite(value)) {
    return null;
  }
  const type = normalizeSpeedRestrictionType(rawSpeed.type || rawSpeed.restriction || rawSpeed.kind);
  return {
    type,
    value,
    unit: "KT",
    raw: getSpeedRestrictionLabel(type) + " " + value + " KT"
  };
}

function getAltitudeRestrictionFromInputs() {
  const parsed = parseAltitudeRestrictionValue(refs.legAltitudeValueInput.value);
  if (!parsed) {
    return null;
  }
  return normalizeAltitudeRestriction({
    type: refs.legAltitudeTypeSelect.value,
    value: refs.legAltitudeValueInput.value,
    unit: parsed.unit
  });
}

function getSpeedRestrictionFromInputs() {
  const value = toNullableNumber(refs.legSpeedValueInput.value);
  if (!Number.isFinite(value)) {
    return null;
  }
  return normalizeSpeedRestriction({
    type: refs.legSpeedTypeSelect.value,
    value
  });
}

function clearLegRestrictionInputs() {
  refs.legAltitudeValueInput.value = "";
  refs.legSpeedValueInput.value = "";
  refs.legRoleSelect.value = "";
}

function formatAltitudeRestriction(altitude) {
  const normalized = normalizeAltitudeRestriction(altitude);
  if (!normalized) {
    return "";
  }
  if (Number.isFinite(normalized.value)) {
    const altitudeText = normalized.unit === "FL"
      ? "FL" + String(normalized.value).padStart(3, "0")
      : normalized.value + " FT";
    return "ALT " + getAltitudeRestrictionLabel(normalized.type) + " " + altitudeText;
  }
  return normalized.raw ? "ALT " + normalized.raw : "";
}

function formatSpeedRestriction(leg) {
  const normalized = normalizeSpeedRestriction(leg && leg.speedRestriction);
  if (normalized) {
    return "SPD " + getSpeedRestrictionLabel(normalized.type) + " " + normalized.value + " KT";
  }
  return Number.isFinite(leg && leg.speedKt) ? "SPD " + leg.speedKt + " KT" : "";
}

function getLegRestrictionSummary(leg) {
  return [
    formatAltitudeRestriction(leg && leg.altitude),
    formatSpeedRestriction(leg)
  ].filter(Boolean).join(" / ");
}

function getProcedureRestrictionSummary(procedure) {
  const legs = []
    .concat((procedure && procedure.legs) || [])
    .concat((procedure && procedure.missedApproach) || []);
  const summaries = legs
    .map((leg) => {
      const restriction = getLegRestrictionSummary(leg);
      return restriction ? leg.waypoint + " " + restriction : "";
    })
    .filter(Boolean);
  if (!summaries.length) {
    return "";
  }
  const visible = summaries.slice(0, 4).join("; ");
  return summaries.length > 4 ? visible + "; +" + (summaries.length - 4) + " more" : visible;
}

function normalizeLegs(rawLegs, fallbackAirport = "") {
  return (Array.isArray(rawLegs) ? rawLegs : [])
    .map((leg) => {
      const waypoint = normalizeWaypointLegReference(leg && (leg.waypoint || leg.id || leg.name), fallbackAirport);
      if (!waypoint) {
        return null;
      }
      const speedRestriction = normalizeSpeedRestriction(leg.speedRestriction);
      const speedKt = toNullableNumber(leg.speedKt);
      return {
        waypoint,
        note: String(leg.note || leg.altitudeRaw || "").trim(),
        role: normalizeApproachPointRole(leg.role) || String(leg.role || "").trim(),
        pathTerminator: String(leg.pathTerminator || "TF").trim().toUpperCase(),
        lat: toNullableNumber(leg.lat),
        lon: toNullableNumber(leg.lon),
        coord: String(leg.coord || "").trim().toUpperCase(),
        trackMag: toNullableNumber(leg.trackMag),
        trackTrue: toNullableNumber(leg.trackTrue),
        distanceNm: toNullableNumber(leg.distanceNm),
        altitude: normalizeAltitudeRestriction(leg.altitude || leg.altitudeRestriction),
        speedRestriction,
        speedKt: Number.isFinite(speedKt) ? speedKt : (speedRestriction ? speedRestriction.value : null),
        navSpec: String(leg.navSpec || "").trim()
      };
    })
    .filter(Boolean);
}

function normalizeProcedureCategory(value) {
  const normalized = String(value || "SID").toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "STAR") {
    return "STAR";
  }
  if (normalized === "DME_ARC" || normalized === "DMEARC") {
    return DME_ARC_CATEGORY;
  }
  if (normalized === "APPROACH" || APPROACH_TYPES.has(normalized) || normalized === "OTHER") {
    return "APPROACH";
  }
  return "SID";
}

function normalizeApproachType(value) {
  const normalized = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalized) {
    return "";
  }
  return APPROACH_TYPES.has(normalized) ? normalized : normalized.slice(0, 12);
}

function normalizeDesignator(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9 -]/g, "").replace(/\s+/g, " ").trim().slice(0, 18);
}

function normalizeProcedureId(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 48);
}

function toNullableNumber(value) {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(6)) : null;
}

function formatCoord(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return "";
  }
  return formatCoordPart(Math.abs(lat), lat >= 0 ? "N" : "S", 2) + " " + formatCoordPart(Math.abs(lon), lon >= 0 ? "E" : "W", 3);
}

function formatCoordPart(value, suffix, degreeLength) {
  let degrees = Math.floor(value);
  const minutesFloat = (value - degrees) * 60;
  let minutes = Math.floor(minutesFloat);
  let seconds = Math.round((minutesFloat - minutes) * 60);
  if (seconds === 60) {
    seconds = 0;
    minutes += 1;
  }
  if (minutes === 60) {
    minutes = 0;
    degrees += 1;
  }
  return String(degrees).padStart(degreeLength, "0") + String(minutes).padStart(2, "0") + String(seconds).padStart(2, "0") + suffix;
}

function formatDecimal(value, digits = 6) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "";
}

function formatThresholdGroundCoordinate(threshold) {
  const lat = threshold && Number(threshold.lat);
  const lon = threshold && Number(threshold.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return "";
  }
  return formatDecimal(lat) + ", " + formatDecimal(lon);
}

function parseWaypointCoordinateInput(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  const normalized = raw.toUpperCase().replace(/[°'"]/g, " ").replace(/\s+/g, " ");
  let name = "";
  let group = "";
  let coordinateText = normalized;
  const airportPointMatch = normalized.match(/^([A-Z0-9]{4})\s+([A-Z][A-Z0-9]{0,5})(?:\s*,\s*|\s+)(?=\d|[NSEW])(.+)$/);
  const namedMatch = normalized.match(/^([A-Z][A-Z0-9]{0,5}(?:\/[A-Z0-9]{1,4})?)(?:\s*,\s*|\s+)(?=\d|[NSEW])(.+)$/);
  if (airportPointMatch && !/^[NSEW]$/.test(airportPointMatch[2])) {
    name = normalizeWaypointName(airportPointMatch[2]);
    group = normalizeWaypointGroup(airportPointMatch[1]);
    coordinateText = airportPointMatch[3];
  } else if (namedMatch && !/^[NSEW]$/.test(namedMatch[1])) {
    const waypointRef = parseWaypointReference(namedMatch[1]);
    name = waypointRef.id;
    group = waypointRef.group;
    coordinateText = namedMatch[2];
  }

  const packed = parsePackedCoordinate(coordinateText);
  if (packed) {
    return Object.assign({ name, group }, packed);
  }

  const lat = parseCoordinateComponent(coordinateText, "NS");
  const lon = parseCoordinateComponent(coordinateText, "EW");
  if (!lat || !lon) {
    return null;
  }
  return {
    name,
    group,
    lat: Number(lat.decimal.toFixed(6)),
    lon: Number(lon.decimal.toFixed(6)),
    coord: formatCoord(lat.decimal, lon.decimal)
  };
}

function parsePackedCoordinate(value) {
  const match = String(value || "").toUpperCase().match(/(\d{2})(\d{2})(\d{2}(?:[.,]\d+)?)\s*([NS])\s+(\d{3})(\d{2})(\d{2}(?:[.,]\d+)?)\s*([EW])/);
  if (!match) {
    return null;
  }
  const lat = dmsToDecimal(match[1], match[2], match[3], match[4]);
  const lon = dmsToDecimal(match[5], match[6], match[7], match[8]);
  if (!lat || !lon) {
    return null;
  }
  return {
    lat: Number(lat.decimal.toFixed(6)),
    lon: Number(lon.decimal.toFixed(6)),
    coord: formatCoord(lat.decimal, lon.decimal)
  };
}

function isPackedCoordinateInput(value) {
  return /^\d{6}(?:[.,]\d+)?[NS]\s+\d{7}(?:[.,]\d+)?[EW]$/i.test(String(value || "").trim());
}

function parseCoordinateComponent(value, hemispheres) {
  const dms = parseDmsCoordinate(value, hemispheres);
  if (dms) {
    return dms;
  }
  return parseDecimalCoordinate(value, hemispheres);
}

function parseDecimalCoordinate(value, hemispheres) {
  const suffixPattern = new RegExp("([+-]?\\d{1,3}[\\.,]\\d+)\\s*([" + hemispheres + "])", "ig");
  const prefixPattern = new RegExp("([" + hemispheres + "])\\s*([+-]?\\d{1,3}[\\.,]\\d+)", "ig");
  const suffix = findValidDecimalMatch(value, suffixPattern, false);
  if (suffix) {
    return suffix;
  }
  return findValidDecimalMatch(value, prefixPattern, true);
}

function findValidDecimalMatch(value, pattern, hemisphereFirst) {
  const text = String(value || "").toUpperCase();
  let match = pattern.exec(text);
  while (match) {
    const hemisphere = hemisphereFirst ? match[1] : match[2];
    const decimalToken = hemisphereFirst ? match[2] : match[1];
    const parsed = decimalToCoordinate(decimalToken, hemisphere);
    if (parsed) {
      return parsed;
    }
    match = pattern.exec(text);
  }
  return null;
}

function decimalToCoordinate(decimalValue, hemisphere) {
  const hemisphereValue = String(hemisphere || "").toUpperCase();
  const decimal = Math.abs(Number(String(decimalValue || "").replace(",", ".")));
  const isLat = hemisphereValue === "N" || hemisphereValue === "S";
  const maxDegrees = isLat ? 90 : 180;
  if (!Number.isFinite(decimal) || decimal > maxDegrees) {
    return null;
  }
  const sign = hemisphereValue === "S" || hemisphereValue === "W" ? -1 : 1;
  return {
    decimal: sign * decimal
  };
}

function parseDmsCoordinate(value, hemispheres) {
  const suffixPattern = new RegExp("(\\d{1,3})\\D+(\\d{1,2})\\D+(\\d{1,2}(?:[\\.,]\\d+)?)\\s*([" + hemispheres + "])", "ig");
  const prefixPattern = new RegExp("([" + hemispheres + "])\\s*(\\d{1,3})\\D+(\\d{1,2})\\D+(\\d{1,2}(?:[\\.,]\\d+)?)", "ig");
  const suffix = findValidDmsMatch(value, suffixPattern, false);
  if (suffix) {
    return suffix;
  }
  return findValidDmsMatch(value, prefixPattern, true);
}

function findValidDmsMatch(value, pattern, hemisphereFirst) {
  const text = String(value || "").toUpperCase();
  let match = pattern.exec(text);
  while (match) {
    const parts = hemisphereFirst
      ? { hemisphere: match[1], degrees: match[2], minutes: match[3], seconds: match[4] }
      : { degrees: match[1], minutes: match[2], seconds: match[3], hemisphere: match[4] };
    const parsed = dmsToDecimal(parts.degrees, parts.minutes, parts.seconds, parts.hemisphere);
    if (parsed) {
      return parsed;
    }
    match = pattern.exec(text);
  }
  return null;
}

function dmsToDecimal(degreesValue, minutesValue, secondsValue, hemisphere) {
  const hemisphereValue = String(hemisphere || "").toUpperCase();
  const degrees = Number(degreesValue);
  const minutes = Number(minutesValue);
  const seconds = Number(String(secondsValue || "").replace(",", "."));
  const isLat = hemisphereValue === "N" || hemisphereValue === "S";
  const maxDegrees = isLat ? 90 : 180;
  if (!Number.isFinite(degrees) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }
  if (degrees < 0 || degrees > maxDegrees || minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) {
    return null;
  }
  const sign = hemisphereValue === "S" || hemisphereValue === "W" ? -1 : 1;
  return {
    decimal: sign * (degrees + minutes / 60 + seconds / 3600)
  };
}

function applyWaypointCoordinateInput(options = {}) {
  const value = refs.waypointCoordInput.value.trim();
  if (!value) {
    return null;
  }
  const currentLat = toNullableNumber(refs.waypointLatInput.value);
  const currentLon = toNullableNumber(refs.waypointLonInput.value);
  if (isPackedCoordinateInput(value) && Number.isFinite(currentLat) && Number.isFinite(currentLon)) {
    return {
      name: normalizeWaypointName(refs.waypointNameInput.value),
      lat: currentLat,
      lon: currentLon,
      coord: value.toUpperCase()
    };
  }
  const parsed = parseWaypointCoordinateInput(value);
  if (!parsed) {
    if (!options.silent) {
      setStatus("Could not parse coordinate input.", "warn");
    }
    return null;
  }
  if (parsed.name) {
    refs.waypointNameInput.value = parsed.name;
  }
  if (parsed.group) {
    refs.waypointGroupInput.value = parsed.group;
  }
  refs.waypointLatInput.value = parsed.lat.toFixed(6);
  refs.waypointLonInput.value = parsed.lon.toFixed(6);
  refs.waypointCoordInput.value = parsed.coord;
  if (!options.silent) {
    setStatus("Converted coordinates" + (parsed.name ? " for " + parsed.name : "") + ".", "ok");
  }
  return parsed;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function setStatus(message, type) {
  refs.status.textContent = message;
  refs.status.className = "status" + (type ? " " + type : "");
}

function setActiveTab(tabName) {
  activeTab = tabName === "procedures" ? "procedures" : (tabName === "vfr" ? "vfr" : "waypoints");
  refs.waypointsPanel.hidden = activeTab !== "waypoints";
  refs.proceduresPanel.hidden = activeTab !== "procedures";
  refs.vfrPanel.hidden = activeTab !== "vfr";
  refs.waypointsTabBtn.classList.toggle("active", activeTab === "waypoints");
  refs.proceduresTabBtn.classList.toggle("active", activeTab === "procedures");
  refs.vfrTabBtn.classList.toggle("active", activeTab === "vfr");
  refs.waypointsTabBtn.classList.toggle("secondary", activeTab !== "waypoints");
  refs.proceduresTabBtn.classList.toggle("secondary", activeTab !== "procedures");
  refs.vfrTabBtn.classList.toggle("secondary", activeTab !== "vfr");
  refs.waypointsTabBtn.setAttribute("aria-selected", String(activeTab === "waypoints"));
  refs.proceduresTabBtn.setAttribute("aria-selected", String(activeTab === "procedures"));
  refs.vfrTabBtn.setAttribute("aria-selected", String(activeTab === "vfr"));
  if (activeTab === "vfr") {
    renderVfrEditor();
  }
}

function render() {
  refs.countryInput.value = state.country;
  renderWaypointList();
  renderWaypointSelect();
  renderProcedureSelect();
  renderProcedureDraft();
  renderAirportProcedureList();
  if (activeTab === "vfr") {
    renderVfrEditor();
  }
  renderExport();
}

function renderExport() {
  const text = generateCountryFileText();
  const localWaypointCount = getLocalWaypointCount();
  const importedWaypointCount = getImportedWaypointCount();
  const localProcedureCount = getLocalProcedureCount();
  const importedProcedureCount = getImportedProcedureCount();
  refs.exportText.value = text;
  refs.fileNamePill.textContent = getCountryFileName();
  refs.waypointCountPill.textContent = localWaypointCount + " local / " + importedWaypointCount + " imported navdata";
  refs.procedureCountPill.textContent = localProcedureCount + " local / " + importedProcedureCount + " imported procedures";
}

function getGroundAirportOptions() {
  const airports = window.NORDSWEET_GROUND_DATA && window.NORDSWEET_GROUND_DATA.airports
    ? Object.keys(window.NORDSWEET_GROUND_DATA.airports)
    : [];
  const procedureAirports = new Set(state.procedures.map((procedure) => normalizeAirportIcao(procedure.airport)).filter(Boolean));
  const vfrAirports = new Set(Object.keys(state.vfrCircuits || {}));
  return Array.from(new Set([].concat(airports, Array.from(procedureAirports), Array.from(vfrAirports), selectedVfrAirport).map(normalizeAirportIcao).filter(Boolean)))
    .sort();
}

function ensureVfrAirportData(airport = selectedVfrAirport) {
  const icao = normalizeAirportIcao(airport);
  if (!icao) {
    return null;
  }
  if (!state.vfrCircuits[icao]) {
    state.vfrCircuits[icao] = createEmptyVfrAirport(icao);
  } else {
    state.vfrCircuits[icao] = normalizeVfrAirportData(state.vfrCircuits[icao]);
  }
  return state.vfrCircuits[icao];
}

function getVfrAirportData(airport = selectedVfrAirport) {
  const icao = normalizeAirportIcao(airport);
  return icao && state.vfrCircuits[icao] ? state.vfrCircuits[icao] : null;
}

function getVfrIntersections(airportData) {
  return airportData && Array.isArray(airportData.intersections) ? airportData.intersections : [];
}

function getVfrConstructionLines(airportData) {
  return airportData && Array.isArray(airportData.constructionLines) ? airportData.constructionLines : [];
}

function getVfrConstructionLineById(airportData, lineId) {
  const id = normalizeIntersectionId(lineId);
  return getVfrConstructionLines(airportData).find((line) => line.id === id) || null;
}

function getVfrIntersectionById(airportData, intersectionId) {
  const id = normalizeIntersectionId(intersectionId);
  return getVfrIntersections(airportData).find((intersection) => intersection.id === id) || null;
}

function getUniqueVfrLineId(airportData) {
  const taken = new Set(getVfrConstructionLines(airportData).map((line) => line.id));
  let index = getVfrConstructionLines(airportData).length + 1;
  let id = "LINE-" + String(index).padStart(2, "0");
  while (taken.has(id)) {
    index += 1;
    id = "LINE-" + String(index).padStart(2, "0");
  }
  return id;
}

function getSegmentIntersection(lineA, lineB) {
  const x1 = Number(lineA.x1);
  const y1 = Number(lineA.y1);
  const x2 = Number(lineA.x2);
  const y2 = Number(lineA.y2);
  const x3 = Number(lineB.x1);
  const y3 = Number(lineB.y1);
  const x4 = Number(lineB.x2);
  const y4 = Number(lineB.y2);
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 0.000001) {
    return null;
  }
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
  const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / denominator;
  if (t < -0.0001 || t > 1.0001 || u < -0.0001 || u > 1.0001) {
    return null;
  }
  return {
    x: toOverlayCoordinate(x1 + t * (x2 - x1)),
    y: toOverlayCoordinate(y1 + t * (y2 - y1)),
    lineIds: [lineA.id, lineB.id]
  };
}

function getVfrLineCrossings(airportData) {
  const lines = getVfrConstructionLines(airportData);
  const crossings = [];
  const seen = new Set();
  for (let leftIndex = 0; leftIndex < lines.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < lines.length; rightIndex += 1) {
      const crossing = getSegmentIntersection(lines[leftIndex], lines[rightIndex]);
      if (!crossing) {
        continue;
      }
      const key = Math.round(crossing.x * 10) + ":" + Math.round(crossing.y * 10);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      crossing.id = "CROSS-" + crossings.length;
      crossings.push(crossing);
    }
  }
  return crossings;
}

function findNearestVfrLineCrossing(airportData, point) {
  const transform = getVfrChartTransform();
  const threshold = Math.max(8, 18 / Math.max(transform.scale, 1));
  return getVfrLineCrossings(airportData)
    .map((crossing) => Object.assign({}, crossing, { distance: Math.hypot(crossing.x - point.x, crossing.y - point.y) }))
    .filter((crossing) => crossing.distance <= threshold)
    .sort((left, right) => left.distance - right.distance)[0] || null;
}

function getVfrCircuit(airportData, circuitId) {
  const id = normalizeVfrCircuitId(circuitId);
  return airportData && airportData.circuits ? airportData.circuits[id] || null : null;
}

function getVfrCircuitPoints(airportData, circuitId) {
  const circuit = getVfrCircuit(airportData, circuitId);
  return circuit && Array.isArray(circuit.points)
    ? circuit.points.map((point) => normalizeChartPoint(point, airportData))
    : [];
}

function getTrafficPatternTurns(circuit, airportData) {
  const pattern = circuit && circuit.trafficPattern ? normalizeTrafficPattern(circuit.trafficPattern, airportData) : normalizeTrafficPattern({}, airportData);
  return pattern.turns || {};
}

function hasCompleteTrafficPattern(circuit, airportData) {
  const turns = getTrafficPatternTurns(circuit, airportData);
  return ["TURN1", "TURN2", "TURN3", "TURN4"].every((role) => turns[role]);
}

function midpointTrafficPatternPoint(left, right, role) {
  return {
    x: toOverlayCoordinate((left.x + right.x) / 2),
    y: toOverlayCoordinate((left.y + right.y) / 2),
    role,
    label: getTrafficPatternRoleLabel(role)
  };
}

function buildTrafficPatternPoints(circuit, airportData) {
  const turns = getTrafficPatternTurns(circuit, airportData);
  if (!["TURN1", "TURN2", "TURN3", "TURN4"].every((role) => turns[role])) {
    return [];
  }
  return [
    normalizeChartPoint(Object.assign({}, turns.TURN1, { role: "TURN1", label: getTrafficPatternRoleLabel("TURN1") }), airportData),
    midpointTrafficPatternPoint(turns.TURN1, turns.TURN2, "CROSSWIND"),
    normalizeChartPoint(Object.assign({}, turns.TURN2, { role: "TURN2", label: getTrafficPatternRoleLabel("TURN2") }), airportData),
    midpointTrafficPatternPoint(turns.TURN2, turns.TURN3, "DOWNWIND"),
    normalizeChartPoint(Object.assign({}, turns.TURN3, { role: "TURN3", label: getTrafficPatternRoleLabel("TURN3") }), airportData),
    midpointTrafficPatternPoint(turns.TURN3, turns.TURN4, "BASELEG"),
    normalizeChartPoint(Object.assign({}, turns.TURN4, { role: "TURN4", label: getTrafficPatternRoleLabel("TURN4") }), airportData),
    midpointTrafficPatternPoint(turns.TURN4, turns.TURN1, "OVER_AIRFIELD")
  ];
}

function applyTrafficPatternToCircuit(airportData, circuit) {
  if (!circuit || !hasCompleteTrafficPattern(circuit, airportData)) {
    return false;
  }
  circuit.points = buildTrafficPatternPoints(circuit, airportData);
  circuit.trafficPattern.generated = true;
  circuit.closed = true;
  return true;
}

function getGroundAirportData(airport = selectedVfrAirport) {
  const icao = normalizeAirportIcao(airport);
  return window.NORDSWEET_GROUND_DATA && window.NORDSWEET_GROUND_DATA.airports
    ? window.NORDSWEET_GROUND_DATA.airports[icao] || null
    : null;
}

function getGroundRunways(airport = selectedVfrAirport) {
  const groundAirport = getGroundAirportData(airport);
  return groundAirport && groundAirport.airport && Array.isArray(groundAirport.airport.runways)
    ? groundAirport.airport.runways
    : [];
}

function normalizeRunwayId(value) {
  return String(value || "").toUpperCase().replace(/^RWY?/, "").replace(/[^0-9LRC]/g, "").slice(0, 4);
}

function getVfrCircuitDirectionSuffix(direction) {
  const normalized = normalizeVfrCircuitDirection(direction);
  if (normalized === "RIGHT") {
    return "R";
  }
  if (normalized === "BOTH") {
    return "B";
  }
  return "L";
}

function getDefaultVfrCircuitId(runwayId, direction) {
  const id = normalizeRunwayId(runwayId);
  if (!id) {
    return "";
  }
  return normalizeVfrCircuitId("RWY" + id + "-" + getVfrCircuitDirectionSuffix(direction));
}

function formatGroundRunwayLabel(runway, prefix = "RWY") {
  const runwayId = normalizeRunwayId(runway && (runway.normalizedId || runway.id));
  const parts = [prefix + " " + (runwayId || "?")];
  const length = Number(runway && (runway.length_m || runway.tora || runway.lda || 0));
  if (Number.isFinite(length) && length > 0) {
    parts.push(Math.round(length) + " m");
  }
  return parts.join(" / ");
}

function getUniqueVfrCircuitId(airportData, baseId) {
  const normalizedBase = normalizeVfrCircuitId(baseId);
  if (!normalizedBase) {
    return "";
  }
  if (!airportData || !airportData.circuits || !airportData.circuits[normalizedBase]) {
    return normalizedBase;
  }
  for (let index = 2; index < 100; index += 1) {
    const suffix = "-" + index;
    const candidate = normalizeVfrCircuitId(normalizedBase.slice(0, Math.max(1, 12 - suffix.length)) + suffix);
    if (!airportData.circuits[candidate]) {
      return candidate;
    }
  }
  return "";
}

function getGroundRunway(airport, runwayId) {
  const id = normalizeRunwayId(runwayId);
  return getGroundRunways(airport).find((runway) => normalizeRunwayId(runway && runway.id) === id) || null;
}

function getOppositeRunwayId(runwayId) {
  const id = normalizeRunwayId(runwayId);
  const match = id.match(/^(\d{1,2})([LRC]?)$/);
  if (!match) {
    return "";
  }
  const number = Number(match[1]);
  const oppositeNumber = ((number + 17) % 36) + 1;
  const suffix = match[2] === "L" ? "R" : (match[2] === "R" ? "L" : match[2]);
  return String(oppositeNumber).padStart(2, "0") + suffix;
}

function findVfrThresholdOverlayPoint(airportData, runwayId) {
  const id = normalizeRunwayId(runwayId);
  if (!id) {
    return null;
  }
  if (airportData && airportData.thresholdPoints && airportData.thresholdPoints[id]) {
    return normalizeChartPoint(airportData.thresholdPoints[id], airportData);
  }
  const candidates = [
    "THR" + id,
    "THRESHOLD" + id,
    "RW" + id,
    "RWY" + id,
    id
  ];
  return getVfrIntersections(airportData).find((intersection) => {
    const key = normalizeIntersectionId(intersection.id);
    const label = normalizeIntersectionId(intersection.label);
    return candidates.some((candidate) => key === candidate || label === candidate || key.includes(candidate) || label.includes(candidate));
  }) || null;
}

function interpolatePoint(left, right, ratio) {
  return {
    x: toOverlayCoordinate(left.x + (right.x - left.x) * ratio),
    y: toOverlayCoordinate(left.y + (right.y - left.y) * ratio)
  };
}

function createAutoTouchdownPoint(airportData, circuit) {
  const runwayId = normalizeRunwayId(circuit && (circuit.runway || refs.vfrCircuitRunwayInput.value));
  const runway = getGroundRunway(selectedVfrAirport, runwayId);
  if (!runway) {
    return null;
  }
  const lengthM = Number(runway.length_m || runway.tora || runway.lda || 0);
  const rule = lengthM < 1000 ? "THRESHOLD" : "305M_FROM_THRESHOLD";
  const touchdown = {
    mode: "AUTO",
    label: "Touchdown",
    runway: runwayId,
    rule,
    source: "AUTO",
    length_m: Number.isFinite(lengthM) ? lengthM : 0,
    distanceFromThresholdM: rule === "THRESHOLD" ? 0 : 305
  };
  if (runway.threshold && Number.isFinite(Number(runway.threshold.lat)) && Number.isFinite(Number(runway.threshold.lon))) {
    touchdown.lat = Number(runway.threshold.lat);
    touchdown.lon = Number(runway.threshold.lon);
  }
  const threshold = findVfrThresholdOverlayPoint(airportData, runwayId);
  if (threshold && rule === "THRESHOLD") {
    touchdown.x = threshold.x;
    touchdown.y = threshold.y;
    touchdown.intersectionId = threshold.id;
  } else if (threshold && rule === "305M_FROM_THRESHOLD" && lengthM > 0) {
    const opposite = findVfrThresholdOverlayPoint(airportData, getOppositeRunwayId(runwayId));
    if (opposite) {
      const point = interpolatePoint(threshold, opposite, Math.min(1, 305 / lengthM));
      touchdown.x = point.x;
      touchdown.y = point.y;
    }
  }
  return touchdown;
}

function setVfrCircuitPoints(airportData, circuitId, points) {
  const circuit = getVfrCircuit(airportData, circuitId);
  if (!circuit) {
    return;
  }
  circuit.points = (Array.isArray(points) ? points : []).map((point) => normalizeChartPoint(point, airportData));
}

function areSameVfrCircuitPoint(left, right) {
  if (!left || !right) {
    return false;
  }
  const leftIntersection = normalizeIntersectionId(left.intersectionId);
  const rightIntersection = normalizeIntersectionId(right.intersectionId);
  if (leftIntersection && rightIntersection && leftIntersection === rightIntersection) {
    return true;
  }
  return Math.abs(Number(left.x) - Number(right.x)) <= 0.001 && Math.abs(Number(left.y) - Number(right.y)) <= 0.001;
}

function getChartSourceWithView(source) {
  const src = String(source || "").trim();
  return src ? (src.includes("#") ? src : src + CHART_PDF_VIEW) : "";
}

function getVfrChartTransform() {
  return {
    panX: Number(refs.vfrChartMap.dataset.panX) || 0,
    panY: Number(refs.vfrChartMap.dataset.panY) || 0,
    scale: Math.max(1, Math.min(CHART_MAX_SCALE, Number(refs.vfrChartMap.dataset.scale) || 1))
  };
}

function getVfrChartPanBounds(scale) {
  const rect = refs.vfrChartMap.getBoundingClientRect();
  const safeScale = Math.max(1, Math.min(CHART_MAX_SCALE, Number(scale) || 1));
  if (safeScale <= 1.0001) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  return {
    minX: Math.max(rect.width || 1, 1) * (1 - safeScale),
    maxX: 0,
    minY: Math.max(rect.height || 1, 1) * (1 - safeScale),
    maxY: 0
  };
}

function setVfrChartTransform(transform, options = {}) {
  const current = getVfrChartTransform();
  const scale = Math.max(1, Math.min(CHART_MAX_SCALE, Number(transform.scale) || current.scale));
  const bounds = getVfrChartPanBounds(scale);
  const panX = Math.max(bounds.minX, Math.min(bounds.maxX, Number(transform.panX) || 0));
  const panY = Math.max(bounds.minY, Math.min(bounds.maxY, Number(transform.panY) || 0));
  refs.vfrChartMap.dataset.scale = String(scale);
  refs.vfrChartMap.dataset.panX = String(panX);
  refs.vfrChartMap.dataset.panY = String(panY);
  refs.vfrChartMapLayer.style.width = (CHART_RENDER_SCALE * 100) + "%";
  refs.vfrChartMapLayer.style.height = (CHART_RENDER_SCALE * 100) + "%";
  refs.vfrChartMapLayer.style.transform = "translate(" + panX.toFixed(3) + "px, " + panY.toFixed(3) + "px) scale(" + (scale / CHART_RENDER_SCALE).toFixed(6) + ")";
  if (options.refresh !== false) {
    renderVfrChartOverlay();
  }
}

function getVfrChartPointFromEvent(event) {
  const rect = refs.vfrChartOverlaySvg.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return { x: 0, y: 0 };
  }
  return {
    x: toOverlayCoordinate(((event.clientX - rect.left) / rect.width) * 1000),
    y: toOverlayCoordinate(((event.clientY - rect.top) / rect.height) * 1000)
  };
}

function getUniqueVfrIntersectionId(airportData, point) {
  const taken = new Set(getVfrIntersections(airportData).map((intersection) => intersection.id));
  const baseId = normalizeIntersectionId("INT-" + Math.round(point.x) + "-" + Math.round(point.y));
  if (!taken.has(baseId)) {
    return baseId;
  }
  let index = 2;
  while (taken.has(baseId + "-" + index)) {
    index += 1;
  }
  return baseId + "-" + index;
}

function renderVfrEditor() {
  const airports = getGroundAirportOptions();
  if (!selectedVfrAirport || !airports.includes(selectedVfrAirport)) {
    selectedVfrAirport = airports[0] || "EPKK";
  }
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  refs.vfrAirportSelect.innerHTML = airports.length
    ? airports.map((airport) => '<option value="' + escapeHtml(airport) + '">' + escapeHtml(airport) + '</option>').join("")
    : '<option value="">No airports</option>';
  refs.vfrAirportSelect.value = selectedVfrAirport;
  refs.vfrAirportInput.value = selectedVfrAirport;

  const chart = airportData.chart || {};
  refs.vfrChartSourceInput.value = chart.src || "";
  refs.vfrChartTitleInput.value = chart.title || "";
  refs.vfrChartMap.style.setProperty("--chart-aspect-ratio", String(Math.max(0.5, Math.min(3, Number(chart.aspectRatio) || 16 / 9))));
  const chartUrl = vfrChartPdfUrl || getChartSourceWithView(chart.src);
  if (refs.vfrChartPdfFrame.getAttribute("data-current-chart") !== chartUrl) {
    refs.vfrChartPdfFrame.setAttribute("data-current-chart", chartUrl);
    if (chartUrl) {
      refs.vfrChartPdfFrame.setAttribute("data", chartUrl);
    } else {
      refs.vfrChartPdfFrame.removeAttribute("data");
    }
  }

  renderVfrCircuitControls(airportData);
  renderVfrIntersectionControls(airportData);
  renderVfrChartOverlay();
  setVfrChartTransform(getVfrChartTransform(), { refresh: false });
}

function renderVfrThresholdCoordinateList(airportData, groundRunways) {
  const runways = Array.isArray(groundRunways) ? groundRunways : [];
  if (!runways.length) {
    refs.vfrThresholdCoordinateList.innerHTML = "No runway threshold coordinates loaded for " + escapeHtml(selectedVfrAirport || "this airport") + ".";
    return;
  }
  refs.vfrThresholdCoordinateList.innerHTML = runways.map((runway) => {
    const runwayId = normalizeRunwayId(runway && runway.id);
    const threshold = runway && runway.threshold && typeof runway.threshold === "object" ? runway.threshold : {};
    const thresholdId = String(threshold.id || ("THR" + runwayId)).toUpperCase();
    const groundCoordinate = formatThresholdGroundCoordinate(threshold);
    const lat = Number(threshold.lat);
    const lon = Number(threshold.lon);
    const dms = Number.isFinite(lat) && Number.isFinite(lon) ? formatCoord(lat, lon) : "";
    const chartPoint = airportData && airportData.thresholdPoints && airportData.thresholdPoints[runwayId]
      ? normalizeChartPoint(airportData.thresholdPoints[runwayId], airportData)
      : null;
    const chartLabel = chartPoint && Number.isFinite(chartPoint.x) && Number.isFinite(chartPoint.y)
      ? "Chart x/y " + formatDecimal(chartPoint.x, 2) + ", " + formatDecimal(chartPoint.y, 2)
      : "Chart point not set";
    return [
      '<div class="threshold-coordinate-row">',
      '<strong>RWY ' + escapeHtml(runwayId || "?") + '</strong>',
      '<span><small>' + escapeHtml(thresholdId) + ' ground</small>' + escapeHtml(groundCoordinate || "Missing lat/lon") + (dms ? '<br>' + escapeHtml(dms) : "") + '</span>',
      '<span><small>Overlay reference</small>' + escapeHtml(chartLabel) + '</span>',
      '</div>'
    ].join("");
  }).join("");
}

function renderVfrCircuitControls(airportData) {
  const circuits = Object.values(airportData.circuits || {}).sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));
  const groundRunways = getGroundRunways(selectedVfrAirport)
    .map((runway) => Object.assign({}, runway, { normalizedId: normalizeRunwayId(runway && runway.id) }))
    .filter((runway) => runway.normalizedId);
  const groundRunwayMap = new Map(groundRunways.map((runway) => [runway.normalizedId, runway]));
  if (!circuits.some((circuit) => circuit.id === selectedVfrCircuit)) {
    const hasRunwayTemplate = selectedVfrRunwayTemplate && groundRunwayMap.has(selectedVfrRunwayTemplate);
    selectedVfrCircuit = hasRunwayTemplate ? "" : (circuits[0] ? circuits[0].id : "");
    if (!hasRunwayTemplate) {
      selectedVfrRunwayTemplate = "";
    }
    vfrCircuitDrawing = false;
  }
  const circuitRunways = new Set(circuits.map((circuit) => normalizeRunwayId(circuit.runway)).filter(Boolean));
  const circuitOptions = circuits.map((circuit) => {
    const runwayId = normalizeRunwayId(circuit.runway);
    const runway = runwayId ? groundRunwayMap.get(runwayId) : null;
    const runwayLabel = runway ? formatGroundRunwayLabel(runway) : (runwayId ? "RWY " + runwayId : "");
    const label = [circuit.id, runwayLabel].filter(Boolean).join(" / ");
    return '<option value="' + escapeHtml(circuit.id) + '">' + escapeHtml(label) + '</option>';
  });
  const runwayTemplateOptions = groundRunways
    .filter((runway) => !circuitRunways.has(runway.normalizedId))
    .map((runway) => '<option value="RUNWAY:' + escapeHtml(runway.normalizedId) + '">' + escapeHtml("New " + formatGroundRunwayLabel(runway)) + '</option>');
  refs.vfrCircuitSelect.innerHTML = circuitOptions.length || runwayTemplateOptions.length
    ? circuitOptions.concat(runwayTemplateOptions).join("")
    : '<option value="">No circuits or runways</option>';
  const selected = getVfrCircuit(airportData, selectedVfrCircuit);
  const points = selected ? getVfrCircuitPoints(airportData, selected.id) : [];
  const activeRunwayTemplate = selected ? "" : (selectedVfrRunwayTemplate || (circuits.length ? "" : (groundRunways[0] ? groundRunways[0].normalizedId : "")));
  if (activeRunwayTemplate) {
    selectedVfrRunwayTemplate = activeRunwayTemplate;
  }
  refs.vfrCircuitSelect.value = selected ? selected.id : (activeRunwayTemplate ? "RUNWAY:" + activeRunwayTemplate : "");
  refs.vfrCircuitIdInput.value = selected
    ? selected.id
    : (activeRunwayTemplate ? getUniqueVfrCircuitId(airportData, getDefaultVfrCircuitId(activeRunwayTemplate, refs.vfrCircuitDirectionSelect.value)) : refs.vfrCircuitIdInput.value);
  refs.vfrCircuitRunwayInput.value = selected ? selected.runway || "" : (activeRunwayTemplate || refs.vfrCircuitRunwayInput.value);
  refs.vfrCircuitDirectionSelect.value = selected ? normalizeVfrCircuitDirection(selected.direction) : normalizeVfrCircuitDirection(refs.vfrCircuitDirectionSelect.value);
  refs.vfrCircuitPointCount.value = String(points.length);
  renderVfrTrafficPatternControls(airportData, selected);
  renderVfrTouchdownControls(airportData, selected);
  refs.startVfrCircuitBtn.textContent = vfrCircuitDrawing ? "Drawing..." : "Start drawing";
  refs.startVfrCircuitBtn.classList.toggle("active", vfrCircuitDrawing);
  refs.stopVfrCircuitBtn.disabled = !vfrCircuitDrawing;
  refs.undoVfrCircuitPointBtn.disabled = !selectedVfrCircuit || !points.length;
  refs.clearVfrCircuitBtn.disabled = !selectedVfrCircuit || !points.length;
  refs.deleteVfrCircuitBtn.disabled = !selectedVfrCircuit;
  refs.addNewVfrCircuitBtn.disabled = !selectedVfrAirport;
  refs.addRunwayVfrCircuitsBtn.disabled = !groundRunways.length;
  refs.startVfrLineModeBtn.textContent = vfrLineDrawingMode ? "Lines..." : "Draw lines";
  refs.startVfrLineModeBtn.classList.toggle("active", vfrLineDrawingMode);
  refs.stopVfrLineModeBtn.disabled = !vfrLineDrawingMode;
  refs.clearVfrLinesBtn.disabled = !getVfrConstructionLines(airportData).length;
  refs.vfrAirportPill.textContent = selectedVfrAirport || "No airport";
  refs.vfrCircuitPill.textContent = circuits.length + " circuits";
  refs.vfrLinePill.textContent = getVfrConstructionLines(airportData).length + " lines";
  if (groundRunways.length) {
    const circuitRunways = new Set(circuits.map((circuit) => normalizeRunwayId(circuit.runway)).filter(Boolean));
    const readyCount = groundRunways.filter((runway) => circuitRunways.has(runway.normalizedId)).length;
    refs.vfrRunwayMeta.textContent = groundRunways.length + " runways loaded from ground-data. Circuits prepared for " + readyCount + "/" + groundRunways.length + " runways.";
  } else {
    refs.vfrRunwayMeta.textContent = "No runway list found in ground-data.js for " + (selectedVfrAirport || "this airport") + ". You can still enter a runway manually.";
  }
  renderVfrThresholdCoordinateList(airportData, groundRunways);
  refs.vfrChartMeta.textContent = vfrLineDrawingMode
    ? (vfrPendingLineStart
        ? "Line mode: click the second point to finish the construction line."
        : "Line mode: click the first point, then click the second point to create a construction line. Click a line crossing to create an intersection.")
    : selected
      ? (vfrCircuitDrawing ? "Drawing " + selected.id + ": click line crossings/intersections, thresholds or touchdown points in circuit order." : "Selected " + selected.id + ".") + " Points: " + points.length + "."
      : "Create a VFR circuit, then draw it over the chart.";
}

function renderVfrTouchdownControls(airportData, circuit) {
  const touchdown = circuit && circuit.touchdownPoint ? normalizeTouchdownPoint(circuit.touchdownPoint, airportData) : null;
  const runwayId = normalizeRunwayId((circuit && circuit.runway) || refs.vfrCircuitRunwayInput.value);
  const threshold = runwayId && airportData.thresholdPoints ? airportData.thresholdPoints[runwayId] : null;
  refs.pickVfrTouchdownBtn.textContent = vfrTouchdownPickActive ? "Picking..." : "Pick touchdown";
  refs.pickVfrTouchdownBtn.classList.toggle("active", vfrTouchdownPickActive);
  refs.pickVfrTouchdownBtn.disabled = !circuit;
  refs.pickVfrThresholdBtn.textContent = vfrThresholdPickActive ? "Picking..." : "Pick threshold";
  refs.pickVfrThresholdBtn.classList.toggle("active", vfrThresholdPickActive);
  refs.pickVfrThresholdBtn.disabled = !circuit && !runwayId;
  refs.clearVfrThresholdBtn.disabled = !threshold;
  refs.autoVfrTouchdownBtn.disabled = !circuit || (touchdown && touchdown.mode === "MANUAL");
  refs.clearVfrTouchdownBtn.disabled = !circuit || !touchdown;
  refs.vfrTouchdownMeta.textContent = circuit
    ? touchdown
      ? "Touchdown: " + touchdown.mode + (touchdown.intersectionId ? " / " + touchdown.intersectionId : "") + (touchdown.rule ? " / " + touchdown.rule : "") + ". Threshold: " + (threshold ? "RWY " + runwayId + " set." : "not set.")
      : "No touchdown point. Threshold: " + (threshold ? "RWY " + runwayId + " set." : "not set.") + " Pick an intersection manually or use auto touchdown."
    : "Create or select a VFR circuit before setting touchdown.";
}

function renderVfrTrafficPatternControls(airportData, circuit) {
  const turns = getTrafficPatternTurns(circuit, airportData);
  const setTurns = ["TURN1", "TURN2", "TURN3", "TURN4"].filter((role) => turns[role]);
  refs.pickVfrPatternPointBtn.textContent = vfrPatternPickRole ? "Picking..." : "Pick turn";
  refs.pickVfrPatternPointBtn.classList.toggle("active", !!vfrPatternPickRole);
  refs.pickVfrPatternPointBtn.disabled = !circuit;
  refs.clearVfrPatternBtn.disabled = !circuit || !setTurns.length;
  refs.vfrPatternMeta.textContent = circuit
    ? [
        vfrPatternPickRole ? "Click chart to set " + getTrafficPatternRoleLabel(vfrPatternPickRole) + "." : "Select turn 1-4, then Pick turn and click the chart.",
        setTurns.length ? "Set: " + setTurns.map(getTrafficPatternRoleLabel).join(", ") + "." : "No turns set.",
        hasCompleteTrafficPattern(circuit, airportData) ? "Traffic pattern points are generated automatically." : "Set all four turns to generate Crosswind, Downwind, Base leg, Final and Over Airfield."
      ].join(" ")
    : "Create or select a VFR circuit before setting traffic pattern turns.";
}

function renderVfrIntersectionControls(airportData) {
  const intersections = getVfrIntersections(airportData);
  if (!intersections.some((intersection) => intersection.id === selectedVfrIntersection)) {
    selectedVfrIntersection = intersections[0] ? intersections[0].id : "";
  }
  refs.vfrIntersectionSelect.innerHTML = intersections.length
    ? intersections.map((intersection) => '<option value="' + escapeHtml(intersection.id) + '">' + escapeHtml(intersection.id + " / " + intersection.x + "," + intersection.y) + '</option>').join("")
    : '<option value="">No intersections</option>';
  refs.vfrIntersectionSelect.value = selectedVfrIntersection;
  refs.vfrIntersectionPill.textContent = intersections.length + " intersections";
  refs.deleteVfrIntersectionBtn.disabled = !selectedVfrIntersection;
}

function renderVfrChartOverlay() {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const transform = getVfrChartTransform();
  const markerScale = (1 + Math.log2(Math.max(transform.scale, 1)) * 0.06) / transform.scale;
  const strokeWidth = 5 / transform.scale;
  const gridStrokeWidth = 1 / transform.scale;
  const gridLines = [250, 500, 750].map((value) =>
    '<line class="chart-overlay-grid" x1="' + value + '" y1="0" x2="' + value + '" y2="1000" stroke-width="' + gridStrokeWidth.toFixed(3) + '"></line>' +
    '<line class="chart-overlay-grid" x1="0" y1="' + value + '" x2="1000" y2="' + value + '" stroke-width="' + gridStrokeWidth.toFixed(3) + '"></line>'
  ).join("");
  const constructionLineMarkup = getVfrConstructionLines(airportData).map((line) =>
    '<line class="vfr-construction-line" x1="' + line.x1 + '" y1="' + line.y1 + '" x2="' + line.x2 + '" y2="' + line.y2 + '" stroke-width="' + Math.max(1.2, 2.8 / transform.scale).toFixed(3) + '"><title>' + escapeHtml(line.id) + '</title></line>'
  ).join("");
  const lineEndpointMarkup = getVfrConstructionLines(airportData).map((line) => {
    const activeStart = vfrLineEndpointDragState && vfrLineEndpointDragState.lineId === line.id && vfrLineEndpointDragState.endpoint === "start";
    const activeEnd = vfrLineEndpointDragState && vfrLineEndpointDragState.lineId === line.id && vfrLineEndpointDragState.endpoint === "end";
    const radius = Math.max(5.2, 8 / transform.scale).toFixed(3);
    const stroke = Math.max(1.2, 2 / transform.scale).toFixed(3);
    const hitRadius = Math.max(12, 20 / transform.scale).toFixed(3);
    return [
      '<g data-vfr-line-endpoint="' + escapeHtml(line.id) + '" data-vfr-line-endpoint-position="start">',
      '<circle class="vfr-line-endpoint-hitbox" cx="' + line.x1 + '" cy="' + line.y1 + '" r="' + hitRadius + '"></circle>',
      '<circle class="vfr-line-endpoint' + (activeStart ? " dragging" : "") + '" cx="' + line.x1 + '" cy="' + line.y1 + '" r="' + radius + '" stroke-width="' + stroke + '"><title>' + escapeHtml(line.id + " start") + '</title></circle>',
      '</g>',
      '<g data-vfr-line-endpoint="' + escapeHtml(line.id) + '" data-vfr-line-endpoint-position="end">',
      '<circle class="vfr-line-endpoint-hitbox" cx="' + line.x2 + '" cy="' + line.y2 + '" r="' + hitRadius + '"></circle>',
      '<circle class="vfr-line-endpoint' + (activeEnd ? " dragging" : "") + '" cx="' + line.x2 + '" cy="' + line.y2 + '" r="' + radius + '" stroke-width="' + stroke + '"><title>' + escapeHtml(line.id + " end") + '</title></circle>',
      '</g>'
    ].join("");
  }).join("");
  const lineDraftMarkup = vfrLineDraft
    ? '<line class="vfr-construction-line-preview" x1="' + vfrLineDraft.x1 + '" y1="' + vfrLineDraft.y1 + '" x2="' + vfrLineDraft.x2 + '" y2="' + vfrLineDraft.y2 + '" stroke-width="' + Math.max(1.4, 3.4 / transform.scale).toFixed(3) + '"></line>'
    : "";
  const lineCrossingMarkup = getVfrLineCrossings(airportData).map((crossing) =>
    '<circle class="vfr-line-intersection-target" data-vfr-line-crossing="' + escapeHtml(crossing.id) + '" cx="' + crossing.x + '" cy="' + crossing.y + '" r="' + Math.max(5, 9 / transform.scale).toFixed(3) + '" stroke-width="' + Math.max(1.2, 2 / transform.scale).toFixed(3) + '"><title>Line crossing ' + escapeHtml(crossing.lineIds.join(" / ")) + '</title></circle>'
  ).join("");
  const circuitMarkup = Object.values(airportData.circuits || {}).map((circuit) => {
    const points = getVfrCircuitPoints(airportData, circuit.id);
    const shouldCloseCircuit = (circuit.closed === true || hasCompleteTrafficPattern(circuit, airportData)) && points.length > 2;
    const linePoints = shouldCloseCircuit ? points.concat(points[0]) : points;
    const pointString = linePoints.map((point) => point.x + "," + point.y).join(" ");
    if (!points.length) {
      return "";
    }
    const active = circuit.id === selectedVfrCircuit;
    return (points.length > 1
        ? '<polyline class="vfr-circuit-halo" points="' + escapeHtml(pointString) + '" stroke-width="' + (strokeWidth * (active ? 3 : 2.1)).toFixed(3) + '"></polyline>' +
          '<polyline class="vfr-circuit-line" points="' + escapeHtml(pointString) + '" stroke-width="' + (strokeWidth * (active ? 1.18 : 0.86)).toFixed(3) + '"><title>' + escapeHtml(circuit.id + " VFR circuit") + '</title></polyline>'
        : "") +
      points.map((point, index) => {
        const endpoint = index === 0 || index === points.length - 1;
        const label = point.label || getTrafficPatternRoleLabel(point.role);
        return '<circle class="vfr-circuit-point' + (endpoint ? " endpoint" : "") + '" cx="' + point.x + '" cy="' + point.y + '" r="' + Math.max(3.2, strokeWidth * (endpoint ? 1 : 0.68)).toFixed(3) + '" stroke-width="' + Math.max(1.2, strokeWidth * 0.28).toFixed(3) + '"><title>' + escapeHtml(circuit.id + " point " + (index + 1) + (label ? " / " + label : "")) + '</title></circle>' +
          (label ? '<text class="vfr-circuit-label" x="' + (point.x + Math.max(8, 14 / transform.scale)).toFixed(3) + '" y="' + (point.y - Math.max(7, 12 / transform.scale)).toFixed(3) + '" font-size="' + Math.max(16, 22 / transform.scale).toFixed(3) + '">' + escapeHtml(label) + '</text>' : "");
      }).join("");
  }).join("");
  const touchdownMarkup = Object.values(airportData.circuits || {}).map((circuit) => {
    const touchdown = circuit.touchdownPoint ? normalizeTouchdownPoint(circuit.touchdownPoint, airportData) : null;
    if (!touchdown || !Number.isFinite(touchdown.x) || !Number.isFinite(touchdown.y)) {
      return "";
    }
    return '<circle class="vfr-circuit-point endpoint" data-vfr-touchdown-point="' + escapeHtml(circuit.id || "") + '" cx="' + touchdown.x + '" cy="' + touchdown.y + '" r="' + Math.max(5.5, 8 / transform.scale).toFixed(3) + '" stroke-width="' + Math.max(1.4, 2 / transform.scale).toFixed(3) + '"><title>' + escapeHtml((circuit.id || "VFR") + " Touchdown / " + touchdown.mode) + '</title></circle>' +
      '<text class="vfr-circuit-label" data-vfr-touchdown-point="' + escapeHtml(circuit.id || "") + '" x="' + (touchdown.x + Math.max(8, 14 / transform.scale)).toFixed(3) + '" y="' + (touchdown.y - Math.max(7, 12 / transform.scale)).toFixed(3) + '" font-size="' + Math.max(16, 22 / transform.scale).toFixed(3) + '">TD</text>';
  }).join("");
  const thresholdMarkup = Object.keys(airportData.thresholdPoints || {}).map((runwayId) => {
    const threshold = normalizeChartPoint(airportData.thresholdPoints[runwayId], airportData);
    if (!Number.isFinite(threshold.x) || !Number.isFinite(threshold.y)) {
      return "";
    }
    return '<circle class="vfr-circuit-point" data-vfr-threshold-point="' + escapeHtml(runwayId) + '" cx="' + threshold.x + '" cy="' + threshold.y + '" r="' + Math.max(4.8, 7 / transform.scale).toFixed(3) + '" stroke-width="' + Math.max(1.2, 2 / transform.scale).toFixed(3) + '"><title>' + escapeHtml("RWY " + runwayId + " threshold") + '</title></circle>' +
      '<text class="vfr-circuit-label" data-vfr-threshold-point="' + escapeHtml(runwayId) + '" x="' + (threshold.x + Math.max(8, 14 / transform.scale)).toFixed(3) + '" y="' + (threshold.y + Math.max(18, 24 / transform.scale)).toFixed(3) + '" font-size="' + Math.max(15, 20 / transform.scale).toFixed(3) + '">' + escapeHtml("THR " + runwayId) + '</text>';
  }).join("");
  const markers = getVfrIntersections(airportData).map((intersection) => {
    const active = intersection.id === selectedVfrIntersection;
    const dragging = vfrChartDragState && vfrChartDragState.id === intersection.id;
    return '<g class="intersection-marker' + (active ? " active" : "") + (dragging ? " dragging" : "") + '" data-vfr-intersection-marker="' + escapeHtml(intersection.id) + '" transform="translate(' + intersection.x + " " + intersection.y + ') scale(' + markerScale.toFixed(4) + ')">' +
      '<title>' + escapeHtml(intersection.id) + '</title>' +
      '<path class="intersection-hitbox" d="M -20 0 L 20 0 M 0 -20 L 0 20"></path>' +
      '<path class="intersection-cross-halo" d="M -15 0 L 15 0 M 0 -15 L 0 15"></path>' +
      '<path class="intersection-cross" d="M -15 0 L 15 0 M 0 -15 L 0 15"></path>' +
      '</g>';
  }).join("");
  refs.vfrChartOverlaySvg.innerHTML =
    '<rect class="chart-overlay-hitbox" x="0" y="0" width="1000" height="1000"></rect>' +
    gridLines +
    constructionLineMarkup +
    lineDraftMarkup +
    circuitMarkup +
    thresholdMarkup +
    touchdownMarkup +
    lineCrossingMarkup +
    lineEndpointMarkup +
    markers;
}

function getLocalWaypointCount() {
  return Object.values(state.waypoints).filter((waypoint) => !waypoint.imported).length;
}

function getImportedWaypointCount() {
  return Object.values(state.waypoints).filter((waypoint) => waypoint.imported).length;
}

function getLocalProcedureCount() {
  return state.procedures.filter((procedure) => procedure.origin !== BUILTIN_PROCEDURE_ORIGIN).length;
}

function getImportedProcedureCount() {
  return state.procedures.filter((procedure) => procedure.origin === BUILTIN_PROCEDURE_ORIGIN).length;
}

function renderWaypointList() {
  const search = normalizeWaypointSearch(refs.waypointSearchInput.value);
  const filter = refs.waypointFilterSelect.value;
  const waypoints = Object.values(state.waypoints)
    .filter((waypoint) => {
      const displayId = getWaypointDisplayId(waypoint);
      const sourceText = [
        waypoint.id,
        waypoint.group || "",
        waypoint.cup && waypoint.cup.code,
        waypoint.cup && waypoint.cup.name,
        waypoint.cup && waypoint.cup.pointName,
        waypoint.cup && waypoint.cup.reportingPointName
      ].filter(Boolean).join(" ").toUpperCase();
      return !search || displayId.includes(search) || sourceText.includes(search);
    })
    .filter((waypoint) => filter === "ALL" || waypoint.rules === filter || (filter !== "BOTH" && waypoint.rules === "BOTH"))
    .sort((left, right) => getWaypointDisplayId(left).localeCompare(getWaypointDisplayId(right)));

  refs.waypointList.innerHTML = waypoints.length
    ? waypoints.map((waypoint) => {
      const position = [waypoint.lat, waypoint.lon].every(Number.isFinite)
        ? waypoint.lat.toFixed(6) + ", " + waypoint.lon.toFixed(6)
        : (waypoint.coord || "No position");
      const routes = waypoint.routes && waypoint.routes.length ? waypoint.routes.slice(0, 4).join(" ") : "";
      const displayId = getWaypointDisplayId(waypoint);
      return [
        '<article class="item-card' + (selectedWaypoint === displayId ? " active" : "") + '" role="button" tabindex="0" data-waypoint-id="' + escapeHtml(displayId) + '">',
        '<strong class="waypoint-card-title">' + escapeHtml(displayId) + '</strong>',
        '<div class="meta-line"><span class="pill">' + escapeHtml(waypoint.rules) + '</span><span class="pill">' + escapeHtml(waypoint.origin || PRIVATE_WAYPOINT_ORIGIN) + '</span>' + (waypoint.group ? '<span class="pill">' + escapeHtml(waypoint.group) + '</span>' : "") + '<span class="waypoint-position">' + escapeHtml(position) + '</span></div>',
        routes ? '<div class="small">' + escapeHtml(routes) + '</div>' : "",
        waypoint.note ? '<div class="small">' + escapeHtml(waypoint.note) + '</div>' : "",
        '</article>'
      ].join("");
    }).join("")
    : '<div class="empty-card">No waypoints yet.</div>';
}

function renderWaypointSelect() {
  const selected = refs.legWaypointSelect.value || "";
  const options = Object.values(state.waypoints)
    .sort((left, right) => getWaypointDisplayId(left).localeCompare(getWaypointDisplayId(right)))
    .map((waypoint) => {
      const displayId = getWaypointDisplayId(waypoint);
      return '<option value="' + escapeHtml(displayId) + '">' + escapeHtml(displayId + " - " + waypoint.rules + " - " + (waypoint.origin || PRIVATE_WAYPOINT_ORIGIN)) + '</option>';
    });
  refs.legWaypointSelect.innerHTML = options.length ? options.join("") : '<option value="">No waypoints</option>';
  if (selected && getWaypointByRef(selected)) {
    refs.legWaypointSelect.value = selected;
  }
}

function renderProcedureSelect() {
  const selected = selectedProcedureId;
  const options = state.procedures
    .slice()
    .sort((left, right) => getProcedureLabel(left).localeCompare(getProcedureLabel(right)))
    .map((procedure) => '<option value="' + escapeHtml(procedure.id) + '">' + escapeHtml(getProcedureLabel(procedure) + " - " + (procedure.origin || PRIVATE_WAYPOINT_ORIGIN)) + '</option>');
  refs.procedureSelect.innerHTML = '<option value="">Draft procedure</option>' + options.join("");
  refs.procedureSelect.value = selected && state.procedures.some((procedure) => procedure.id === selected) ? selected : "";
}

function getProcedureAirportForList() {
  return normalizeProcedureToken((refs.procedureAirportInput && refs.procedureAirportInput.value) || draftProcedure.airport, 4);
}

function renderAirportProcedureList() {
  const airport = getProcedureAirportForList();
  if (!airport) {
    refs.airportProcedureCountPill.textContent = "Select airport";
    refs.airportProcedureList.innerHTML = '<div class="empty-card">Enter airport ICAO to see loaded procedures.</div>';
    return;
  }
  const procedures = state.procedures
    .filter((procedure) => normalizeProcedureToken(procedure.airport, 4) === airport)
    .sort((left, right) => {
      const categoryOrder = { SID: 1, STAR: 2, APPROACH: 3, DME_ARC: 4 };
      const leftOrder = categoryOrder[left.category] || 9;
      const rightOrder = categoryOrder[right.category] || 9;
      return leftOrder - rightOrder || getProcedureLabel(left).localeCompare(getProcedureLabel(right));
    });
  const privateCount = procedures.filter((procedure) => procedure.origin !== BUILTIN_PROCEDURE_ORIGIN).length;
  const importedCount = procedures.length - privateCount;
  refs.airportProcedureCountPill.textContent = procedures.length + " total / " + privateCount + " local / " + importedCount + " imported";
  refs.airportProcedureList.innerHTML = procedures.length
    ? procedures.map((procedure) => {
      const typeLabel = procedure.category === "APPROACH"
        ? (procedure.approachType || "APP")
        : (procedure.category === DME_ARC_CATEGORY ? "DME ARC" : procedure.category);
      const runway = procedure.runway ? "RWY " + procedure.runway : "No runway";
      const origin = procedure.origin || PRIVATE_WAYPOINT_ORIGIN;
      const restrictions = getProcedureRestrictionSummary(procedure);
      return [
        '<article class="item-card' + (selectedProcedureId === procedure.id ? " active" : "") + '" role="button" tabindex="0" data-airport-procedure-id="' + escapeHtml(procedure.id) + '">',
        '<strong>' + escapeHtml(procedure.designator || procedure.id) + '</strong>',
        '<div class="meta-line"><span class="pill">' + escapeHtml(typeLabel) + '</span><span class="pill">' + escapeHtml(runway) + '</span><span class="pill">' + escapeHtml(origin) + '</span></div>',
        restrictions ? '<div class="small restriction-line">Restrictions: ' + escapeHtml(restrictions) + '</div>' : "",
        procedure.title ? '<div class="small">' + escapeHtml(procedure.title) + '</div>' : "",
        '</article>'
      ].join("");
    }).join("")
    : '<div class="empty-card">No procedures loaded for ' + escapeHtml(airport) + '.</div>';
}

function renderDmeSourceOptions(selectedValue = "") {
  const selected = String(selectedValue || "").toUpperCase();
  const options = getGroundVorOptions();
  refs.dmeSourceSelect.innerHTML = options.length
    ? options.map((option) => '<option value="' + escapeHtml(option.value) + '">' + escapeHtml(option.label) + '</option>').join("")
    : '<option value="">No VORs in ground-data.js</option>';
  if (selected && options.some((option) => option.value.toUpperCase() === selected)) {
    refs.dmeSourceSelect.value = selectedValue;
  }
}

function renderProcedureDraft() {
  refs.procedureAirportInput.value = draftProcedure.airport;
  refs.procedureDesignatorInput.value = draftProcedure.designator;
  refs.procedureCategorySelect.value = draftProcedure.category;
  refs.procedureDirectionSelect.value = normalizeProcedureDirection(draftProcedure.direction);
  refs.procedureRunwayInput.value = draftProcedure.runway;
  refs.procedureTitleInput.value = draftProcedure.title;
  refs.procedureSourceInput.value = draftProcedure.source;
  const dmeArc = normalizeDmeArc(draftProcedure.dmeArc || {}, draftProcedure.airport);
  renderDmeSourceOptions(dmeArc.source);
  refs.dmeDistanceInput.value = dmeArc.distance;
  refs.dmeEntryRadialInput.value = dmeArc.entryRadial;
  refs.dmeExitRadialInput.value = dmeArc.exitRadial;
  const approachType = draftProcedure.approachType || "ILS";
  refs.approachTypeSelect.value = APPROACH_TYPES.has(approachType) ? approachType : "OTHER";
  refs.approachOtherInput.value = APPROACH_TYPES.has(approachType) ? "" : approachType;
  refs.finalGlideSlopeInput.value = Number.isFinite(draftProcedure.finalGlideSlopeDeg) ? draftProcedure.finalGlideSlopeDeg : "";
  const isApproach = draftProcedure.category === "APPROACH";
  const isDmeArc = draftProcedure.category === DME_ARC_CATEGORY;
  const finalGlideSlopeStart = getFinalGlideSlopeStartWaypoint(draftProcedure);
  refs.finalGlideSlopeStartPill.textContent = finalGlideSlopeStart
    ? "FAF " + finalGlideSlopeStart
    : "Select FAF on a route point";
  document.querySelectorAll(".approach-only").forEach((element) => {
    element.hidden = !isApproach;
  });
  document.querySelectorAll(".dme-arc-only").forEach((element) => {
    element.hidden = !isDmeArc;
  });
  refs.approachTypeSelect.disabled = !isApproach;
  refs.approachOtherInput.disabled = !isApproach || refs.approachTypeSelect.value !== "OTHER";
  refs.finalGlideSlopeInput.disabled = !isApproach;
  refs.legRoleSelect.disabled = !isApproach;
  refs.dmeSourceSelect.disabled = !isDmeArc;
  refs.dmeDistanceInput.disabled = !isDmeArc;
  refs.dmeEntryRadialInput.disabled = !isDmeArc;
  refs.dmeExitRadialInput.disabled = !isDmeArc;
  refs.procedureLegList.innerHTML = renderLegCards(draftProcedure.legs, "route");
  refs.missedLegList.innerHTML = renderLegCards(draftProcedure.missedApproach, "missed");
  refs.routeCount.textContent = draftProcedure.legs.length + " legs";
  refs.missedCount.textContent = draftProcedure.missedApproach.length + " legs";
  renderAirportProcedureList();
}

function renderLegCards(legs, listName) {
  return legs.length
    ? legs.map((leg, index) => {
      const waypoint = getWaypointByRef(leg.waypoint) || {};
      const lat = Number.isFinite(waypoint.lat) ? waypoint.lat : leg.lat;
      const lon = Number.isFinite(waypoint.lon) ? waypoint.lon : leg.lon;
      const position = [lat, lon].every(Number.isFinite) ? lat.toFixed(6) + ", " + lon.toFixed(6) : "";
      const meta = [
        waypoint.rules || "",
        leg.pathTerminator || "",
        normalizeApproachPointRole(leg.role),
        getLegRestrictionSummary(leg),
        leg.note || position
      ].filter(Boolean).join(" / ");
      return [
        '<article class="leg-card">',
        '<span class="leg-index">' + (index + 1) + '</span>',
        '<div><strong>' + escapeHtml(leg.waypoint) + '</strong>',
        '<div class="meta-line"><span>' + escapeHtml(meta) + '</span></div></div>',
        '<div class="mini-actions">',
        '<button type="button" class="icon secondary" title="Move up" data-move-leg="' + listName + '|' + index + '|up">Up</button>',
        '<button type="button" class="icon secondary" title="Move down" data-move-leg="' + listName + '|' + index + '|down">Dn</button>',
        '<button type="button" class="icon danger" title="Delete" data-delete-leg="' + listName + '|' + index + '">Del</button>',
        '</div>',
        '</article>'
      ].join("");
    }).join("")
    : '<div class="empty-card">No legs yet.</div>';
}

function populateWaypointForm(waypointId) {
  const waypoint = getWaypointByRef(waypointId);
  if (!waypoint) {
    clearWaypointForm();
    return;
  }
  selectedWaypoint = getWaypointDisplayId(waypoint);
  refs.waypointNameInput.value = waypoint.id;
  refs.waypointGroupInput.value = waypoint.group || "";
  refs.waypointRulesSelect.value = waypoint.rules;
  refs.waypointOriginSelect.value = waypoint.origin === BUILTIN_WAYPOINT_ORIGIN ? BUILTIN_WAYPOINT_ORIGIN : PRIVATE_WAYPOINT_ORIGIN;
  refs.waypointLatInput.value = Number.isFinite(waypoint.lat) ? waypoint.lat : "";
  refs.waypointLonInput.value = Number.isFinite(waypoint.lon) ? waypoint.lon : "";
  refs.waypointCoordInput.value = waypoint.coord || "";
  refs.waypointSourceInput.value = waypoint.source || "";
  refs.waypointNoteInput.value = waypoint.note || "";
  renderWaypointList();
}

function clearWaypointForm() {
  selectedWaypoint = "";
  refs.waypointNameInput.value = "";
  refs.waypointGroupInput.value = "";
  refs.waypointRulesSelect.value = "IFR";
  refs.waypointOriginSelect.value = PRIVATE_WAYPOINT_ORIGIN;
  refs.waypointLatInput.value = "";
  refs.waypointLonInput.value = "";
  refs.waypointCoordInput.value = "";
  refs.waypointSourceInput.value = "";
  refs.waypointNoteInput.value = "";
  renderWaypointList();
}

function saveWaypoint() {
  applyWaypointCoordinateInput({ silent: true });
  const id = normalizeWaypointName(refs.waypointNameInput.value);
  const group = normalizeWaypointGroup(refs.waypointGroupInput.value);
  const key = getWaypointKey(id, group);
  if (!id) {
    setStatus("Waypoint needs a name.", "warn");
    return;
  }
  const lat = toNullableNumber(refs.waypointLatInput.value);
  const lon = toNullableNumber(refs.waypointLonInput.value);
  const previousKey = selectedWaypoint && selectedWaypoint !== key ? selectedWaypoint : "";
  const previousWaypoint = getWaypointByRef(selectedWaypoint || key) || {};
  const normalizedCoord = formatCoord(lat, lon) || String(refs.waypointCoordInput.value || "").toUpperCase().trim();
  const origin = refs.waypointOriginSelect.value === BUILTIN_WAYPOINT_ORIGIN ? BUILTIN_WAYPOINT_ORIGIN : PRIVATE_WAYPOINT_ORIGIN;
  const storedId = group && !isRunwayWaypointId(id) ? key : id;
  const waypoint = {
    id: storedId,
    group,
    key,
    name: key,
    rules: normalizeRules(refs.waypointRulesSelect.value),
    ruleSet: getRulesArray(refs.waypointRulesSelect.value),
    lat,
    lon,
    coord: normalizedCoord,
    source: refs.waypointSourceInput.value.trim(),
    note: refs.waypointNoteInput.value.trim(),
    routes: Array.isArray(previousWaypoint.routes) ? previousWaypoint.routes : [],
    origin,
    imported: false,
    navaid: previousWaypoint.navaid || null,
    cup: previousWaypoint.cup || null,
    dmeArcPoint: previousWaypoint.dmeArcPoint || null,
    runwayThreshold: previousWaypoint.runwayThreshold || null
  };
  if (previousKey) {
    delete state.waypoints[previousKey];
    state.procedures.forEach((procedure) => {
      procedure.legs.forEach((leg) => {
        if (leg.waypoint === previousKey) {
          leg.waypoint = key;
        }
      });
      procedure.missedApproach.forEach((leg) => {
        if (leg.waypoint === previousKey) {
          leg.waypoint = key;
        }
      });
    });
  }
  state.waypoints[key] = waypoint;
  selectedWaypoint = key;
  saveLocalState();
  setStatus("Saved waypoint " + key + ".", "ok");
  render();
}

function deleteWaypoint() {
  const id = selectedWaypoint || getWaypointKey(refs.waypointNameInput.value, refs.waypointGroupInput.value);
  if (!id || !getWaypointByRef(id)) {
    setStatus("Select a waypoint first.", "warn");
    return;
  }
  const currentWaypoint = getWaypointByRef(id);
  if (currentWaypoint.imported) {
    setStatus(id + " is imported from navdata.js. Save it first if you want a private override.", "warn");
    return;
  }
  const isUsed = state.procedures.some((procedure) => {
    return procedure.legs.concat(procedure.missedApproach).some((leg) => leg.waypoint === id);
  });
  if (isUsed && !window.confirm("Waypoint " + id + " is used in procedures. Delete anyway?")) {
    return;
  }
  delete state.waypoints[getWaypointDisplayId(currentWaypoint)];
  const builtinWaypoint = getBuiltinWaypoint(id, state.country);
  if (builtinWaypoint) {
    state.waypoints[getWaypointDisplayId(builtinWaypoint)] = builtinWaypoint;
    clearWaypointForm();
    saveLocalState();
    setStatus("Deleted private override for " + id + ". NAVDATA point is visible again.", "warn");
    render();
    return;
  }
  state.procedures.forEach((procedure) => {
    procedure.legs = procedure.legs.filter((leg) => leg.waypoint !== id);
    procedure.missedApproach = procedure.missedApproach.filter((leg) => leg.waypoint !== id);
  });
  clearWaypointForm();
  saveLocalState();
  setStatus("Deleted waypoint " + id + ".", "warn");
  render();
}

function getBuiltinWaypoint(id, country) {
  const builtinData = getBuiltinCountryData(country);
  const key = parseWaypointReference(id).key;
  return builtinData && builtinData.waypoints ? builtinData.waypoints[key] || null : null;
}

function syncDraftFromInputs() {
  const existingProcedureId = selectedProcedureId && draftProcedure.id ? draftProcedure.id : "";
  draftProcedure.airport = normalizeProcedureToken(refs.procedureAirportInput.value, 4);
  draftProcedure.designator = normalizeDesignator(refs.procedureDesignatorInput.value);
  draftProcedure.category = normalizeProcedureCategory(refs.procedureCategorySelect.value);
  draftProcedure.runway = normalizeProcedureToken(refs.procedureRunwayInput.value, 4);
  draftProcedure.direction = normalizeProcedureDirection(refs.procedureDirectionSelect.value);
  draftProcedure.title = refs.procedureTitleInput.value.trim();
  draftProcedure.source = refs.procedureSourceInput.value.trim();
  draftProcedure.dmeArc = draftProcedure.category === DME_ARC_CATEGORY ? getDmeArcFromInputs() : createEmptyDmeArc();
  draftProcedure.approachType = draftProcedure.category === "APPROACH"
    ? normalizeApproachType(refs.approachTypeSelect.value === "OTHER" ? refs.approachOtherInput.value : refs.approachTypeSelect.value)
    : "";
  draftProcedure.finalGlideSlopeDeg = draftProcedure.category === "APPROACH"
    ? normalizeFinalGlideSlope(refs.finalGlideSlopeInput.value)
    : null;
  draftProcedure.id = existingProcedureId || createProcedureId(draftProcedure);
  if (draftProcedure.category !== "APPROACH") {
    draftProcedure.missedApproach = [];
  }
}

function getDmeArcFromInputs() {
  const sourceOption = getGroundVorOption(refs.dmeSourceSelect.value);
  const sourceCode = normalizeVorCode(sourceOption && sourceOption.code);
  const entryRadial = normalizeRadial(refs.dmeEntryRadialInput.value);
  const exitRadial = normalizeRadial(refs.dmeExitRadialInput.value);
  return {
    source: sourceOption ? sourceOption.value : "",
    sourceAirport: sourceOption ? sourceOption.airport : "",
    sourceCode,
    sourceLabel: sourceOption ? sourceOption.label : "",
    sourceFrequency: sourceOption ? sourceOption.frequency : "",
    distance: normalizeDmeDistance(refs.dmeDistanceInput.value),
    entryRadial,
    exitRadial,
    entryPoint: createDmeArcPointName(sourceCode, entryRadial),
    exitPoint: createDmeArcPointName(sourceCode, exitRadial)
  };
}

function createProcedureId(procedure) {
  return normalizeProcedureId([
    procedure.airport,
    procedure.category === "APPROACH" ? (procedure.approachType || "APP") : (procedure.category === DME_ARC_CATEGORY ? "DMEARC" : procedure.category),
    procedure.category === DME_ARC_CATEGORY && procedure.dmeArc ? procedure.dmeArc.sourceCode : "",
    procedure.category === DME_ARC_CATEGORY && procedure.dmeArc ? procedure.dmeArc.distance : "",
    procedure.designator,
    procedure.runway
  ].filter(Boolean).join("_"));
}

function getProcedureLabel(procedure) {
  const typeLabel = procedure.category === "APPROACH"
    ? (procedure.approachType || "APP")
    : (procedure.category === DME_ARC_CATEGORY ? "DME Arc" : procedure.category);
  const parts = [procedure.airport, typeLabel, procedure.designator || procedure.id];
  if (procedure.category === DME_ARC_CATEGORY && procedure.dmeArc && procedure.dmeArc.sourceCode) {
    parts.push(procedure.dmeArc.sourceCode + " " + (procedure.dmeArc.distance || "?") + " DME");
  }
  if (procedure.runway) {
    parts.push("RWY " + procedure.runway);
  }
  if (normalizeProcedureDirection(procedure.direction) === "BIDIRECTIONAL") {
    parts.push("2-way");
  }
  return parts.filter(Boolean).join(" / ");
}

function loadProcedure(procedureId) {
  const procedure = state.procedures.find((candidate) => candidate.id === procedureId);
  selectedProcedureId = procedure ? procedure.id : "";
  draftProcedure = procedure ? clone(procedure) : createEmptyProcedure();
  renderProcedureSelect();
  renderProcedureDraft();
}

function saveProcedure() {
  syncDraftFromInputs();
  if (!draftProcedure.airport) {
    setStatus("Procedure needs an airport ICAO.", "warn");
    return;
  }
  if (draftProcedure.category === DME_ARC_CATEGORY && !ensureDmeArcProcedurePoints(draftProcedure, { addLegs: true })) {
    return;
  }
  if (!draftProcedure.designator && draftProcedure.category !== DME_ARC_CATEGORY) {
    setStatus("Procedure needs a designator.", "warn");
    return;
  }
  if (!draftProcedure.designator && draftProcedure.category === DME_ARC_CATEGORY) {
    draftProcedure.designator = createDmeArcDesignator(draftProcedure.dmeArc);
    draftProcedure.id = createProcedureId(draftProcedure);
  }
  if (!draftProcedure.legs.length) {
    setStatus("Procedure needs at least one route leg.", "warn");
    return;
  }
  const missingLeg = draftProcedure.legs.concat(draftProcedure.missedApproach)
    .find((leg) => !getWaypointByRef(leg.waypoint) && ![leg.lat, leg.lon].every(Number.isFinite));
  if (missingLeg) {
    setStatus("Procedure uses missing waypoint " + missingLeg.waypoint + ".", "warn");
    return;
  }
  if (draftProcedure.category === "APPROACH" && !draftProcedure.approachType) {
    setStatus("Approach needs a type.", "warn");
    return;
  }
  if (draftProcedure.category === "APPROACH" && Number.isFinite(draftProcedure.finalGlideSlopeDeg) && !getFinalGlideSlopeStartWaypoint(draftProcedure)) {
    setStatus("Final glide slope needs a FAF point.", "warn");
    return;
  }
  const next = clone(draftProcedure);
  next.origin = PRIVATE_WAYPOINT_ORIGIN;
  const existingIndex = state.procedures.findIndex((procedure) => procedure.id === selectedProcedureId || procedure.id === next.id);
  if (existingIndex >= 0) {
    state.procedures[existingIndex] = next;
  } else {
    state.procedures.push(next);
  }
  selectedProcedureId = next.id;
  saveLocalState();
  setStatus("Saved procedure " + getProcedureLabel(next) + ".", "ok");
  render();
}

function createDmeArcDesignator(dmeArc) {
  if (!dmeArc || !dmeArc.sourceCode) {
    return "DME ARC";
  }
  return [dmeArc.sourceCode, dmeArc.distance ? dmeArc.distance + " DME" : "", "ARC"].filter(Boolean).join(" ");
}

function ensureDmeArcProcedurePoints(procedure, options = {}) {
  const dmeArc = normalizeDmeArc(procedure.dmeArc || {}, procedure.airport);
  if (!dmeArc.sourceCode) {
    setStatus("DME Arc needs a DME source.", "warn");
    return false;
  }
  if (!dmeArc.distance) {
    setStatus("DME Arc needs a DME distance.", "warn");
    return false;
  }
  if (!dmeArc.entryRadial || !dmeArc.exitRadial) {
    setStatus("DME Arc needs entry and exit radials.", "warn");
    return false;
  }
  dmeArc.entryPoint = createDmeArcPointName(dmeArc.sourceCode, dmeArc.entryRadial);
  dmeArc.exitPoint = createDmeArcPointName(dmeArc.sourceCode, dmeArc.exitRadial);
  if (!dmeArc.entryPoint || !dmeArc.exitPoint) {
    setStatus("DME Arc radial point names could not be created.", "warn");
    return false;
  }
  procedure.dmeArc = dmeArc;
  createOrUpdateDmeArcWaypoint(dmeArc.entryPoint, "ENTRY", dmeArc);
  createOrUpdateDmeArcWaypoint(dmeArc.exitPoint, "EXIT", dmeArc);
  if (options.addLegs) {
    addDmeArcLegIfMissing(procedure, dmeArc.entryPoint, "DME ARC ENTRY RDL " + dmeArc.entryRadial);
    addDmeArcLegIfMissing(procedure, dmeArc.exitPoint, "DME ARC EXIT RDL " + dmeArc.exitRadial);
  }
  return true;
}

function createOrUpdateDmeArcWaypoint(pointId, role, dmeArc) {
  const key = getWaypointKey(pointId);
  const previous = getWaypointByRef(key) || {};
  state.waypoints[key] = {
    id: pointId,
    group: "",
    key,
    name: key,
    rules: "IFR",
    ruleSet: ["IFR"],
    lat: Number.isFinite(previous.lat) ? previous.lat : null,
    lon: Number.isFinite(previous.lon) ? previous.lon : null,
    coord: previous.coord || "",
    source: "DME ARC " + dmeArc.sourceCode + " " + dmeArc.distance + " DME",
    note: role + " radial " + (role === "ENTRY" ? dmeArc.entryRadial : dmeArc.exitRadial) + " from " + dmeArc.sourceCode,
    routes: Array.isArray(previous.routes) ? previous.routes : [],
    origin: PRIVATE_WAYPOINT_ORIGIN,
    imported: false,
    dmeArcPoint: {
      role,
      source: dmeArc.source,
      sourceCode: dmeArc.sourceCode,
      distance: dmeArc.distance,
      radial: role === "ENTRY" ? dmeArc.entryRadial : dmeArc.exitRadial
    }
  };
}

function addDmeArcLegIfMissing(procedure, waypointId, note) {
  if (!procedure.legs.some((leg) => leg.waypoint === waypointId)) {
    procedure.legs.push({ waypoint: waypointId, note, role: "DME_ARC" });
  }
}

function deleteProcedure() {
  const procedureId = selectedProcedureId || refs.procedureSelect.value;
  const index = state.procedures.findIndex((procedure) => procedure.id === procedureId);
  if (index < 0) {
    setStatus("Select a procedure first.", "warn");
    return;
  }
  const currentProcedure = state.procedures[index];
  if (currentProcedure.origin === BUILTIN_PROCEDURE_ORIGIN) {
    setStatus(getProcedureLabel(currentProcedure) + " is imported. Save it first if you want a private override.", "warn");
    return;
  }
  const label = getProcedureLabel(state.procedures[index]);
  state.procedures.splice(index, 1);
  const builtinProcedure = getBuiltinProcedure(currentProcedure);
  if (builtinProcedure) {
    state.procedures.push(builtinProcedure);
  }
  selectedProcedureId = "";
  draftProcedure = createEmptyProcedure();
  saveLocalState();
  setStatus(builtinProcedure ? "Deleted private override for " + label + ". Imported procedure is visible again." : "Deleted procedure " + label + ".", "warn");
  render();
}

function getBuiltinProcedure(procedure) {
  const builtinData = getBuiltinCountryData(state.country);
  const key = getProcedureDataKey(procedure);
  return builtinData && Array.isArray(builtinData.procedures)
    ? builtinData.procedures.find((candidate) => getProcedureDataKey(candidate) === key) || null
    : null;
}

function addLeg(target) {
  const waypoint = parseWaypointReference(refs.legWaypointSelect.value).key;
  if (!waypoint || !getWaypointByRef(waypoint)) {
    setStatus("Add at least one waypoint first.", "warn");
    return;
  }
  syncDraftFromInputs();
  const list = target === "missed" ? draftProcedure.missedApproach : draftProcedure.legs;
  const speedRestriction = getSpeedRestrictionFromInputs();
  const role = draftProcedure.category === "APPROACH" && target !== "missed"
    ? normalizeApproachPointRole(refs.legRoleSelect.value)
    : "";
  list.push({
    waypoint,
    note: refs.legNoteInput.value.trim(),
    role,
    altitude: getAltitudeRestrictionFromInputs(),
    speedRestriction,
    speedKt: speedRestriction ? speedRestriction.value : null
  });
  refs.legNoteInput.value = "";
  clearLegRestrictionInputs();
  setStatus("Added " + waypoint + " to " + (target === "missed" ? "missed approach." : "route."), "ok");
  renderProcedureDraft();
  renderExport();
}

function moveLeg(target, index, direction) {
  syncDraftFromInputs();
  const list = target === "missed" ? draftProcedure.missedApproach : draftProcedure.legs;
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= list.length) {
    return;
  }
  const item = list[index];
  list[index] = list[nextIndex];
  list[nextIndex] = item;
  renderProcedureDraft();
  renderExport();
}

function deleteLeg(target, index) {
  syncDraftFromInputs();
  const list = target === "missed" ? draftProcedure.missedApproach : draftProcedure.legs;
  list.splice(index, 1);
  renderProcedureDraft();
  renderExport();
}

function saveVfrChartFields() {
  const typedAirport = normalizeAirportIcao(refs.vfrAirportInput.value);
  if (typedAirport && typedAirport !== selectedVfrAirport) {
    selectedVfrAirport = typedAirport;
    selectedVfrCircuit = "";
    selectedVfrRunwayTemplate = "";
    selectedVfrIntersection = "";
    vfrCircuitDrawing = false;
  }
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  if (!airportData) {
    setStatus("Enter VFR airport ICAO first.", "warn");
    return null;
  }
  airportData.chart = Object.assign({}, airportData.chart || {}, {
    title: refs.vfrChartTitleInput.value.trim(),
    src: refs.vfrChartSourceInput.value.trim(),
    renderScale: CHART_RENDER_SCALE,
    maxScale: CHART_MAX_SCALE,
    aspectRatio: 16 / 9,
    color: true
  });
  return airportData;
}

function saveVfrCircuit() {
  const airportData = saveVfrChartFields();
  if (!airportData) {
    return;
  }
  const nextId = normalizeVfrCircuitId(refs.vfrCircuitIdInput.value || selectedVfrCircuit);
  if (!nextId) {
    setStatus("Enter VFR circuit ID first, e.g. RWY25-L.", "warn");
    return;
  }
  const previousId = selectedVfrCircuit && selectedVfrCircuit !== nextId ? selectedVfrCircuit : "";
  const existing = previousId ? airportData.circuits[previousId] : airportData.circuits[nextId];
  const points = existing && Array.isArray(existing.points) ? existing.points : [];
  if (previousId) {
    delete airportData.circuits[previousId];
  }
  airportData.circuits[nextId] = {
    id: nextId,
    label: nextId,
    runway: refs.vfrCircuitRunwayInput.value.trim().toUpperCase(),
    direction: normalizeVfrCircuitDirection(refs.vfrCircuitDirectionSelect.value),
    trafficPattern: existing && existing.trafficPattern ? normalizeTrafficPattern(existing.trafficPattern, airportData) : normalizeTrafficPattern({}, airportData),
    touchdownPoint: existing && existing.touchdownPoint ? normalizeTouchdownPoint(existing.touchdownPoint, airportData) : null,
    closed: existing && existing.closed === true,
    points: points.map((point) => normalizeChartPoint(point, airportData)),
    notForNavigation: true
  };
  selectedVfrCircuit = nextId;
  selectedVfrRunwayTemplate = "";
  saveLocalState();
  setStatus("Saved VFR circuit " + nextId + " for " + selectedVfrAirport + ".", "ok");
  render();
}

function createVfrCircuitEntry(id, runwayId, direction, airportData, existing) {
  return {
    id,
    label: id,
    runway: normalizeRunwayId(runwayId),
    direction: normalizeVfrCircuitDirection(direction),
    trafficPattern: existing && existing.trafficPattern ? normalizeTrafficPattern(existing.trafficPattern, airportData) : normalizeTrafficPattern({}, airportData),
    touchdownPoint: existing && existing.touchdownPoint ? normalizeTouchdownPoint(existing.touchdownPoint, airportData) : null,
    closed: existing && existing.closed === true,
    points: existing && Array.isArray(existing.points)
      ? existing.points.map((point) => normalizeChartPoint(point, airportData))
      : [],
    notForNavigation: true
  };
}

function getPreferredNewVfrRunway(airportData) {
  const typedRunway = normalizeRunwayId(refs.vfrCircuitRunwayInput.value);
  if (typedRunway) {
    return typedRunway;
  }
  if (selectedVfrRunwayTemplate) {
    return selectedVfrRunwayTemplate;
  }
  const circuitRunways = new Set(Object.values(airportData.circuits || {}).map((circuit) => normalizeRunwayId(circuit.runway)).filter(Boolean));
  const missingRunway = getGroundRunways(selectedVfrAirport)
    .map((runway) => normalizeRunwayId(runway && runway.id))
    .find((runwayId) => runwayId && !circuitRunways.has(runwayId));
  return missingRunway || normalizeRunwayId(getGroundRunways(selectedVfrAirport)[0] && getGroundRunways(selectedVfrAirport)[0].id);
}

function addNewVfrCircuit() {
  const airportData = saveVfrChartFields();
  if (!airportData) {
    return;
  }
  const direction = normalizeVfrCircuitDirection(refs.vfrCircuitDirectionSelect.value);
  const runwayId = getPreferredNewVfrRunway(airportData);
  if (!runwayId) {
    setStatus("Enter runway or choose an airport with runways before adding a circuit.", "warn");
    return;
  }
  const typedId = normalizeVfrCircuitId(refs.vfrCircuitIdInput.value);
  const baseId = typedId && !airportData.circuits[typedId]
    ? typedId
    : getDefaultVfrCircuitId(runwayId, direction);
  const id = getUniqueVfrCircuitId(airportData, baseId);
  if (!id) {
    setStatus("Could not create a unique VFR circuit ID.", "warn");
    return;
  }
  airportData.circuits[id] = createVfrCircuitEntry(id, runwayId, direction, airportData);
  selectedVfrCircuit = id;
  selectedVfrRunwayTemplate = "";
  vfrCircuitDrawing = false;
  vfrPatternPickRole = "";
  vfrThresholdPickActive = false;
  vfrTouchdownPickActive = false;
  refs.vfrCircuitIdInput.value = id;
  refs.vfrCircuitRunwayInput.value = runwayId;
  saveLocalState();
  setStatus("Added new VFR circuit " + id + " for RWY " + runwayId + ".", "ok");
  render();
}

function addVfrCircuitsForGroundRunways() {
  const airportData = saveVfrChartFields();
  if (!airportData) {
    return;
  }
  const runways = getGroundRunways(selectedVfrAirport)
    .map((runway) => normalizeRunwayId(runway && runway.id))
    .filter(Boolean);
  if (!runways.length) {
    setStatus("No runways found in ground-data.js for " + selectedVfrAirport + ".", "warn");
    return;
  }
  const direction = normalizeVfrCircuitDirection(refs.vfrCircuitDirectionSelect.value);
  const existingRunways = new Set(Object.values(airportData.circuits || {}).map((circuit) => normalizeRunwayId(circuit.runway)).filter(Boolean));
  const created = [];
  runways.forEach((runwayId) => {
    if (existingRunways.has(runwayId)) {
      return;
    }
    const id = getUniqueVfrCircuitId(airportData, getDefaultVfrCircuitId(runwayId, direction));
    if (!id) {
      return;
    }
    airportData.circuits[id] = createVfrCircuitEntry(id, runwayId, direction, airportData);
    existingRunways.add(runwayId);
    created.push(id);
  });
  if (created.length) {
    selectedVfrCircuit = created[0];
    selectedVfrRunwayTemplate = "";
    refs.vfrCircuitIdInput.value = created[0];
    refs.vfrCircuitRunwayInput.value = airportData.circuits[created[0]].runway;
    saveLocalState();
    setStatus("Added " + created.length + " VFR circuits from " + runways.length + " runways: " + created.join(", ") + ".", "ok");
  } else {
    setStatus("All " + runways.length + " ground-data runways already have VFR circuits.", "ok");
  }
  vfrCircuitDrawing = false;
  vfrPatternPickRole = "";
  vfrThresholdPickActive = false;
  vfrTouchdownPickActive = false;
  render();
}

function startVfrCircuitDrawing() {
  saveVfrCircuit();
  if (!selectedVfrCircuit) {
    return;
  }
  vfrCircuitDrawing = true;
  vfrPatternPickRole = "";
  vfrThresholdPickActive = false;
  vfrTouchdownPickActive = false;
  selectedVfrIntersection = "";
  setStatus("Drawing VFR circuit " + selectedVfrCircuit + ". Click line crossings/intersections, thresholds or touchdown points in order.", "ok");
  renderVfrEditor();
  renderExport();
}

function stopVfrCircuitDrawing() {
  vfrCircuitDrawing = false;
  setStatus("Stopped VFR circuit drawing.", "ok");
  renderVfrEditor();
}

function addVfrCircuitPointAtPoint(point) {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const circuit = getVfrCircuit(airportData, selectedVfrCircuit);
  if (!selectedVfrCircuit || !circuit) {
    setStatus("Create or select a VFR circuit before adding points.", "warn");
    return;
  }
  const points = getVfrCircuitPoints(airportData, selectedVfrCircuit).slice();
  const nextPoint = normalizeChartPoint(point, airportData);
  if (points.length >= 3 && areSameVfrCircuitPoint(points[0], nextPoint)) {
    circuit.closed = true;
    vfrCircuitDrawing = false;
    saveLocalState();
    setStatus("Closed VFR circuit " + selectedVfrCircuit + ".", "ok");
    render();
    return;
  }
  if (points.length && areSameVfrCircuitPoint(points[points.length - 1], nextPoint)) {
    setStatus("This point is already the last point in the circuit.", "warn");
    return;
  }
  circuit.closed = false;
  points.push(nextPoint);
  setVfrCircuitPoints(airportData, selectedVfrCircuit, points);
  saveLocalState();
  setStatus("Added VFR circuit point " + points.length + ".", "ok");
  render();
}

function addVfrCircuitPointAtIntersection(intersectionId) {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const intersection = getVfrIntersectionById(airportData, intersectionId);
  if (!intersection) {
    setStatus("That intersection no longer exists.", "warn");
    return;
  }
  selectedVfrIntersection = intersection.id;
  addVfrCircuitPointAtPoint({ x: intersection.x, y: intersection.y, intersectionId: intersection.id });
}

function addVfrCircuitPointAtLineCrossing(crossingMarker) {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const crossing = crossingMarker
    ? getVfrLineCrossings(airportData).find((candidate) => candidate.id === crossingMarker.dataset.vfrLineCrossing)
    : null;
  if (!crossing) {
    setStatus("Click a line crossing/intersection, threshold or touchdown point to add a circuit point.", "warn");
    return;
  }
  addVfrCircuitPointAtPoint({
    x: crossing.x,
    y: crossing.y,
    label: "Line crossing"
  });
}

function addVfrCircuitPointAtThreshold(thresholdMarker) {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const runwayId = normalizeRunwayId(thresholdMarker && thresholdMarker.dataset.vfrThresholdPoint);
  const threshold = runwayId && airportData.thresholdPoints && airportData.thresholdPoints[runwayId]
    ? normalizeChartPoint(airportData.thresholdPoints[runwayId], airportData)
    : null;
  if (!threshold) {
    setStatus("Threshold point is not available.", "warn");
    return;
  }
  addVfrCircuitPointAtPoint(Object.assign({}, threshold, {
    role: "THRESHOLD",
    label: "THR " + runwayId
  }));
}

function addVfrCircuitPointAtTouchdown(touchdownMarker) {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const circuitId = normalizeVfrCircuitId(touchdownMarker && touchdownMarker.dataset.vfrTouchdownPoint);
  const circuit = getVfrCircuit(airportData, circuitId);
  const touchdown = circuit && circuit.touchdownPoint ? normalizeTouchdownPoint(circuit.touchdownPoint, airportData) : null;
  if (!touchdown || !Number.isFinite(touchdown.x) || !Number.isFinite(touchdown.y)) {
    setStatus("Touchdown point is not available.", "warn");
    return;
  }
  addVfrCircuitPointAtPoint(Object.assign({}, touchdown, {
    role: "TOUCHDOWN",
    label: "Touchdown"
  }));
}

function setVfrTrafficPatternPointAtPoint(point, intersectionId = "") {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const circuit = getVfrCircuit(airportData, selectedVfrCircuit);
  const role = normalizeTrafficPatternRole(vfrPatternPickRole || refs.vfrPatternPointSelect.value);
  if (!circuit) {
    setStatus("Create or select a VFR circuit before setting traffic pattern points.", "warn");
    return;
  }
  if (!["TURN1", "TURN2", "TURN3", "TURN4"].includes(role)) {
    setStatus("Choose traffic pattern turn 1-4 first.", "warn");
    return;
  }
  circuit.trafficPattern = circuit.trafficPattern || normalizeTrafficPattern({}, airportData);
  circuit.trafficPattern.turns = circuit.trafficPattern.turns || {};
  const nextPoint = normalizeChartPoint({
    x: point.x,
    y: point.y,
    intersectionId,
    role,
    label: getTrafficPatternRoleLabel(role)
  }, airportData);
  circuit.trafficPattern.turns[role] = nextPoint;
  vfrPatternPickRole = "";
  const generated = applyTrafficPatternToCircuit(airportData, circuit);
  saveLocalState();
  setStatus(
    "Set " + getTrafficPatternRoleLabel(role) + " for " + selectedVfrCircuit + (generated ? " and generated traffic pattern points." : "."),
    "ok"
  );
  render();
}

function clearVfrTrafficPattern() {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const circuit = getVfrCircuit(airportData, selectedVfrCircuit);
  if (!circuit) {
    setStatus("Choose a VFR circuit first.", "warn");
    return;
  }
  circuit.trafficPattern = normalizeTrafficPattern({}, airportData);
  circuit.points = [];
  circuit.closed = false;
  vfrPatternPickRole = "";
  saveLocalState();
  setStatus("Cleared traffic pattern points for " + selectedVfrCircuit + ".", "warn");
  render();
}

function setManualVfrTouchdownAtIntersection(intersectionId) {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const circuit = getVfrCircuit(airportData, selectedVfrCircuit);
  const intersection = getVfrIntersectionById(airportData, intersectionId);
  if (!circuit) {
    setStatus("Create or select a VFR circuit before setting touchdown.", "warn");
    return;
  }
  if (!intersection) {
    setStatus("Manual touchdown must be selected from an existing intersection.", "warn");
    return;
  }
  circuit.touchdownPoint = normalizeTouchdownPoint({
    mode: "MANUAL",
    label: "Touchdown",
    runway: circuit.runway || refs.vfrCircuitRunwayInput.value,
    intersectionId: intersection.id,
    x: intersection.x,
    y: intersection.y
  }, airportData);
  vfrTouchdownPickActive = false;
  saveLocalState();
  setStatus("Set manual touchdown at " + intersection.id + ". Auto touchdown disabled for this circuit.", "ok");
  render();
}

function setAutoVfrTouchdown() {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const circuit = getVfrCircuit(airportData, selectedVfrCircuit);
  if (!circuit) {
    setStatus("Choose a VFR circuit first.", "warn");
    return;
  }
  if (circuit.touchdownPoint && circuit.touchdownPoint.mode === "MANUAL") {
    setStatus("Manual touchdown exists. Clear it before using auto touchdown.", "warn");
    return;
  }
  const touchdown = createAutoTouchdownPoint(airportData, circuit);
  if (!touchdown) {
    setStatus("Could not create auto touchdown: missing runway data for " + (circuit.runway || refs.vfrCircuitRunwayInput.value || "runway") + ".", "warn");
    return;
  }
  circuit.touchdownPoint = normalizeTouchdownPoint(touchdown, airportData);
  saveLocalState();
  setStatus("Set auto touchdown: " + circuit.touchdownPoint.rule + (Number.isFinite(circuit.touchdownPoint.x) ? "." : ". No chart overlay point found, metadata saved."), "ok");
  render();
}

function clearVfrTouchdown() {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const circuit = getVfrCircuit(airportData, selectedVfrCircuit);
  if (!circuit || !circuit.touchdownPoint) {
    setStatus("No touchdown point to clear.", "warn");
    return;
  }
  circuit.touchdownPoint = null;
  vfrTouchdownPickActive = false;
  saveLocalState();
  setStatus("Cleared touchdown point for " + selectedVfrCircuit + ".", "warn");
  render();
}

function setVfrThresholdPointAtPoint(point, intersectionId = "") {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const circuit = getVfrCircuit(airportData, selectedVfrCircuit);
  const runwayId = normalizeRunwayId((circuit && circuit.runway) || refs.vfrCircuitRunwayInput.value);
  if (!runwayId) {
    setStatus("Enter circuit runway before setting threshold.", "warn");
    return;
  }
  airportData.thresholdPoints = airportData.thresholdPoints || {};
  airportData.thresholdPoints[runwayId] = normalizeChartPoint({
    x: point.x,
    y: point.y,
    intersectionId,
    role: "THRESHOLD",
    label: "THR " + runwayId
  }, airportData);
  vfrThresholdPickActive = false;
  saveLocalState();
  setStatus("Set threshold point for RWY " + runwayId + ".", "ok");
  render();
}

function clearVfrThresholdPoint() {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const circuit = getVfrCircuit(airportData, selectedVfrCircuit);
  const runwayId = normalizeRunwayId((circuit && circuit.runway) || refs.vfrCircuitRunwayInput.value);
  if (!runwayId || !airportData.thresholdPoints || !airportData.thresholdPoints[runwayId]) {
    setStatus("No threshold point to clear for selected runway.", "warn");
    return;
  }
  delete airportData.thresholdPoints[runwayId];
  vfrThresholdPickActive = false;
  saveLocalState();
  setStatus("Cleared threshold point for RWY " + runwayId + ".", "warn");
  render();
}

function createVfrIntersectionAtPoint(point) {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const id = getUniqueVfrIntersectionId(airportData, point);
  airportData.intersections.push({
    id,
    label: id,
    x: point.x,
    y: point.y
  });
  selectedVfrIntersection = id;
  saveLocalState();
  setStatus("Added VFR chart intersection " + id + ".", "ok");
  render();
}

function createVfrIntersectionAtLineCrossing(crossing) {
  if (!crossing) {
    setStatus("Click closer to a line crossing.", "warn");
    return;
  }
  createVfrIntersectionAtPoint({ x: crossing.x, y: crossing.y });
}

function startVfrLineMode() {
  vfrLineDrawingMode = true;
  vfrCircuitDrawing = false;
  vfrLineDraft = null;
  vfrPendingLineStart = null;
  vfrPatternPickRole = "";
  vfrThresholdPickActive = false;
  vfrTouchdownPickActive = false;
  setStatus("Line mode enabled. Click first point, then click second point to create a construction line.", "ok");
  renderVfrEditor();
}

function stopVfrLineMode() {
  vfrLineDrawingMode = false;
  vfrLineDraft = null;
  vfrPendingLineStart = null;
  setStatus("Stopped VFR line drawing.", "ok");
  renderVfrEditor();
}

function addVfrConstructionLine(line) {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const normalized = {
    id: getUniqueVfrLineId(airportData),
    x1: toOverlayCoordinate(line.x1),
    y1: toOverlayCoordinate(line.y1),
    x2: toOverlayCoordinate(line.x2),
    y2: toOverlayCoordinate(line.y2)
  };
  if (Math.hypot(normalized.x2 - normalized.x1, normalized.y2 - normalized.y1) < 4) {
    setStatus("Line is too short.", "warn");
    return;
  }
  airportData.constructionLines.push(normalized);
  saveLocalState();
  setStatus("Added construction line " + normalized.id + ".", "ok");
  render();
}

function handleVfrLineModeClick(event, crossingMarker) {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const point = getVfrChartPointFromEvent(event);
  const crossing = crossingMarker
    ? getVfrLineCrossings(airportData).find((candidate) => candidate.id === crossingMarker.dataset.vfrLineCrossing)
    : findNearestVfrLineCrossing(airportData, point);
  if (crossing) {
    createVfrIntersectionAtLineCrossing(crossing);
    return;
  }
  if (!vfrPendingLineStart) {
    vfrPendingLineStart = point;
    vfrLineDraft = { x1: point.x, y1: point.y, x2: point.x, y2: point.y };
    setStatus("Line start set at " + point.x + "," + point.y + ". Click the second point.", "ok");
    renderVfrEditor();
    return;
  }
  addVfrConstructionLine({
    x1: vfrPendingLineStart.x,
    y1: vfrPendingLineStart.y,
    x2: point.x,
    y2: point.y
  });
  vfrPendingLineStart = null;
  vfrLineDraft = null;
}

function clearVfrConstructionLines() {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  if (!getVfrConstructionLines(airportData).length) {
    setStatus("No VFR construction lines to clear.", "warn");
    return;
  }
  airportData.constructionLines = [];
  vfrLineDraft = null;
  vfrPendingLineStart = null;
  saveLocalState();
  setStatus("Cleared VFR construction lines for " + selectedVfrAirport + ".", "warn");
  render();
}

function moveSelectedVfrIntersectionToPoint(point) {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const intersection = getVfrIntersectionById(airportData, selectedVfrIntersection);
  if (!intersection) {
    return;
  }
  intersection.x = point.x;
  intersection.y = point.y;
  Object.values(airportData.circuits || {}).forEach((circuit) => {
    circuit.points = (Array.isArray(circuit.points) ? circuit.points : []).map((circuitPoint) => {
      if (normalizeIntersectionId(circuitPoint.intersectionId) === intersection.id) {
        return { x: intersection.x, y: intersection.y, intersectionId: intersection.id };
      }
      return circuitPoint;
    });
  });
  renderVfrChartOverlay();
  renderExport();
}

function moveVfrLineEndpointToPoint(lineId, endpoint, point) {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const line = getVfrConstructionLineById(airportData, lineId);
  if (!line) {
    return;
  }
  if (endpoint === "start") {
    line.x1 = point.x;
    line.y1 = point.y;
  } else {
    line.x2 = point.x;
    line.y2 = point.y;
  }
  renderVfrChartOverlay();
  renderExport();
}

function undoVfrCircuitPoint() {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  const circuit = getVfrCircuit(airportData, selectedVfrCircuit);
  const points = getVfrCircuitPoints(airportData, selectedVfrCircuit).slice();
  if (!selectedVfrCircuit || !points.length) {
    setStatus("No VFR circuit point to remove.", "warn");
    return;
  }
  points.pop();
  if (circuit) {
    circuit.closed = false;
  }
  setVfrCircuitPoints(airportData, selectedVfrCircuit, points);
  saveLocalState();
  setStatus("Removed last VFR circuit point.", "ok");
  render();
}

function clearVfrCircuit() {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  if (!selectedVfrCircuit || !getVfrCircuit(airportData, selectedVfrCircuit)) {
    setStatus("Choose a VFR circuit first.", "warn");
    return;
  }
  airportData.circuits[selectedVfrCircuit].closed = false;
  setVfrCircuitPoints(airportData, selectedVfrCircuit, []);
  saveLocalState();
  setStatus("Cleared VFR circuit " + selectedVfrCircuit + ".", "warn");
  render();
}

function deleteVfrCircuit() {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  if (!selectedVfrCircuit || !airportData.circuits[selectedVfrCircuit]) {
    setStatus("Choose a VFR circuit first.", "warn");
    return;
  }
  const deleted = selectedVfrCircuit;
  delete airportData.circuits[selectedVfrCircuit];
  selectedVfrCircuit = "";
  vfrCircuitDrawing = false;
  saveLocalState();
  setStatus("Deleted VFR circuit " + deleted + ".", "warn");
  render();
}

function deleteVfrIntersection() {
  const airportData = ensureVfrAirportData(selectedVfrAirport);
  if (!selectedVfrIntersection) {
    setStatus("Choose an intersection first.", "warn");
    return;
  }
  const deleted = selectedVfrIntersection;
  airportData.intersections = getVfrIntersections(airportData).filter((intersection) => intersection.id !== deleted);
  Object.values(airportData.circuits || {}).forEach((circuit) => {
    circuit.points = (Array.isArray(circuit.points) ? circuit.points : []).filter((point) => normalizeIntersectionId(point.intersectionId) !== deleted);
  });
  selectedVfrIntersection = "";
  saveLocalState();
  setStatus("Deleted VFR intersection " + deleted + ".", "warn");
  render();
}

function switchVfrAirport(airport) {
  const nextAirport = normalizeAirportIcao(airport);
  if (!nextAirport) {
    setStatus("Enter airport ICAO first.", "warn");
    return;
  }
  selectedVfrAirport = nextAirport;
  selectedVfrCircuit = "";
  selectedVfrRunwayTemplate = "";
  selectedVfrIntersection = "";
  vfrCircuitDrawing = false;
  vfrLineDrawingMode = false;
  vfrLineDraft = null;
  vfrPendingLineStart = null;
  vfrPatternPickRole = "";
  vfrThresholdPickActive = false;
  vfrTouchdownPickActive = false;
  setStatus("Selected VFR airport " + selectedVfrAirport + ".", "ok");
  render();
}

function loadVfrChartPdfFromInput() {
  const file = refs.vfrChartPdfInput.files && refs.vfrChartPdfInput.files[0];
  if (!file) {
    return;
  }
  const oldUrl = vfrChartPdfUrl ? vfrChartPdfUrl.split("#")[0] : "";
  if (oldUrl.startsWith("blob:")) {
    URL.revokeObjectURL(oldUrl);
  }
  vfrChartPdfUrl = URL.createObjectURL(file) + CHART_PDF_VIEW;
  vfrChartPdfLabel = file.name || "VFR chart";
  refs.vfrChartSourceInput.value = getVfrChartFileSource(file.name, selectedVfrAirport);
  refs.vfrChartTitleInput.value = file.name || "";
  saveVfrChartFields();
  saveLocalState();
  setStatus("Loaded VFR chart " + vfrChartPdfLabel + " for " + selectedVfrAirport + ".", "ok");
  render();
}

function handleVfrChartZoom(action, clientX, clientY) {
  if (action === "reset") {
    setVfrChartTransform({ panX: 0, panY: 0, scale: 1 });
    return;
  }
  const rect = refs.vfrChartMap.getBoundingClientRect();
  const current = getVfrChartTransform();
  const scaleFactor = action === "out" ? 1 / CHART_ZOOM_STEP : CHART_ZOOM_STEP;
  const nextScale = Math.max(1, Math.min(CHART_MAX_SCALE, current.scale * scaleFactor));
  const anchorX = Number.isFinite(clientX) ? clientX - rect.left : rect.width / 2;
  const anchorY = Number.isFinite(clientY) ? clientY - rect.top : rect.height / 2;
  const worldX = (anchorX - current.panX) / current.scale;
  const worldY = (anchorY - current.panY) / current.scale;
  setVfrChartTransform({
    panX: anchorX - worldX * nextScale,
    panY: anchorY - worldY * nextScale,
    scale: nextScale
  });
}

function getGeneratedData() {
  const waypoints = {};
  Object.values(state.waypoints)
    .filter((waypoint) => !waypoint.imported)
    .sort((left, right) => getWaypointDisplayId(left).localeCompare(getWaypointDisplayId(right)))
    .forEach((waypoint) => {
      const key = getWaypointDisplayId(waypoint);
      waypoints[key] = {
        id: waypoint.id,
        group: waypoint.group || "",
        key,
        name: key,
        rules: waypoint.rules,
        ruleSet: getRulesArray(waypoint.rules),
        lat: waypoint.lat,
        lon: waypoint.lon,
        coord: waypoint.coord,
        source: waypoint.source,
        note: waypoint.note,
        routes: waypoint.routes || [],
        origin: waypoint.origin === BUILTIN_WAYPOINT_ORIGIN ? BUILTIN_WAYPOINT_ORIGIN : PRIVATE_WAYPOINT_ORIGIN,
        navaid: waypoint.navaid || null,
        cup: waypoint.cup || null,
        dmeArcPoint: waypoint.dmeArcPoint || null,
        runwayThreshold: waypoint.runwayThreshold || null
      };
    });

  const procedures = {};
  state.procedures
    .filter((procedure) => procedure.origin !== BUILTIN_PROCEDURE_ORIGIN)
    .forEach((procedure) => {
    const airport = procedure.airport || "UNKNOWN";
    if (!procedures[airport]) {
      procedures[airport] = { sids: [], stars: [], approaches: [], dmeArcs: [] };
    }
    const generated = generateProcedureRecord(procedure);
    if (procedure.category === "STAR") {
      procedures[airport].stars.push(generated);
    } else if (procedure.category === DME_ARC_CATEGORY) {
      procedures[airport].dmeArcs.push(generated);
    } else if (procedure.category === "APPROACH") {
      procedures[airport].approaches.push(generated);
    } else {
      procedures[airport].sids.push(generated);
    }
  });

  Object.keys(procedures).forEach((airport) => {
    procedures[airport].sids.sort(sortById);
    procedures[airport].stars.sort(sortById);
    procedures[airport].approaches.sort(sortById);
    procedures[airport].dmeArcs.sort(sortById);
  });

  const vfrCircuits = {};
  Object.keys(state.vfrCircuits || {}).sort().forEach((airport) => {
    const data = normalizeVfrAirportData(state.vfrCircuits[airport]);
    const circuitCount = Object.keys(data.circuits || {}).length;
    const thresholdCount = Object.keys(data.thresholdPoints || {}).length;
    const hasChart = data.chart && (data.chart.src || data.chart.title);
    if (!circuitCount && !thresholdCount && !data.intersections.length && !hasChart) {
      return;
    }
    vfrCircuits[data.airport] = {
      airport: data.airport,
      chart: data.chart,
      intersections: data.intersections,
      thresholdPoints: data.thresholdPoints,
      constructionLines: data.constructionLines,
      circuits: data.circuits
    };
  });

  return {
    metadata: {
      name: "Nordsweet " + state.country + " Private Waypoints",
      country: state.country,
      generatedAt: new Date().toISOString(),
      waypointCount: Object.keys(waypoints).length,
      importedWaypointCount: getImportedWaypointCount(),
      availableWaypointCount: Object.keys(state.waypoints).length,
      runwayThresholdWaypointCount: Object.values(waypoints).filter((waypoint) => waypoint.runwayThreshold).length,
      procedureCount: Object.values(procedures).reduce((sum, airport) => {
        return sum + airport.sids.length + airport.stars.length + airport.approaches.length + airport.dmeArcs.length;
      }, 0),
      vfrCircuitCount: Object.values(vfrCircuits).reduce((sum, airport) => sum + Object.keys(airport.circuits || {}).length, 0),
      importedProcedureCount: getImportedProcedureCount(),
      availableProcedureCount: state.procedures.length,
      imports: ["navdata.js", "ground-data.js"],
      notForNavigation: true,
      note: "Private local planning data. Verify current AIP, AIRAC, NOTAM and ATC clearance before flight."
    },
    waypoints,
    procedures,
    vfrCircuits
  };
}

function sortById(left, right) {
  return String(left.id || "").localeCompare(String(right.id || ""));
}

function generateProcedureRecord(procedure) {
  const record = {
    id: procedure.id,
    designator: procedure.designator,
    type: procedure.category === "APPROACH" ? "APPROACH" : procedure.category,
    category: procedure.category,
    airport: procedure.airport,
    runway: procedure.runway,
    runways: procedure.runway ? [procedure.runway] : [],
    direction: normalizeProcedureDirection(procedure.direction),
    bidirectional: normalizeProcedureDirection(procedure.direction) === "BIDIRECTIONAL",
    title: procedure.title,
    source: procedure.source,
    legs: procedure.legs.map((leg, index) => generateLegRecord(leg, index))
  };
  if (procedure.category === DME_ARC_CATEGORY) {
    record.dmeArc = clone(procedure.dmeArc || createEmptyDmeArc());
  }
  if (procedure.category === "APPROACH") {
    record.approachType = procedure.approachType;
    record.finalGlideSlopeDeg = Number.isFinite(procedure.finalGlideSlopeDeg) ? procedure.finalGlideSlopeDeg : null;
    record.finalGlideSlopeStartWaypoint = getFinalGlideSlopeStartWaypoint(procedure);
    record.finalGlideSlope = {
      angleDeg: record.finalGlideSlopeDeg,
      startRole: "FAF",
      startWaypoint: record.finalGlideSlopeStartWaypoint,
      tacticalVectoringAfterFafAllowed: true
    };
    record.missedApproach = procedure.missedApproach.map((leg, index) => generateLegRecord(leg, index));
  }
  return record;
}

function generateLegRecord(leg, index) {
  const waypoint = getWaypointByRef(leg.waypoint) || {};
  const lat = Number.isFinite(waypoint.lat) ? waypoint.lat : leg.lat;
  const lon = Number.isFinite(waypoint.lon) ? waypoint.lon : leg.lon;
  const record = {
    sequence: index + 1,
    pathTerminator: leg.pathTerminator || "TF",
    waypoint: leg.waypoint,
    rules: waypoint.rules || "",
    sourceOrigin: waypoint.origin || "",
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    coord: waypoint.coord || leg.coord || formatCoord(lat, lon) || "",
    note: leg.note || "",
    role: leg.role || ""
  };
  if (Number.isFinite(leg.trackMag)) {
    record.trackMag = leg.trackMag;
  }
  if (Number.isFinite(leg.trackTrue)) {
    record.trackTrue = leg.trackTrue;
  }
  if (Number.isFinite(leg.distanceNm)) {
    record.distanceNm = leg.distanceNm;
  }
  if (leg.altitude) {
    record.altitude = clone(leg.altitude);
  }
  if (leg.speedRestriction) {
    record.speedRestriction = clone(leg.speedRestriction);
  }
  if (Number.isFinite(leg.speedKt)) {
    record.speedKt = leg.speedKt;
  }
  if (leg.navSpec) {
    record.navSpec = leg.navSpec;
  }
  return record;
}

function generateCountryFileText() {
  const countryKey = normalizeCountryKey(state.country);
  const data = getGeneratedData();
  return [
    "window.NORDSWEET_PRIVATE_WAYPOINTS = window.NORDSWEET_PRIVATE_WAYPOINTS || {};",
    "window.NORDSWEET_PRIVATE_WAYPOINTS." + countryKey + " = " + JSON.stringify(data, null, 2) + ";",
    ""
  ].join("\n");
}

function downloadCountryFile() {
  const blob = new Blob([generateCountryFileText()], { type: "text/javascript;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = getCountryFileName();
  link.click();
  URL.revokeObjectURL(link.href);
}

async function chooseDirectory() {
  if (!window.showDirectoryPicker) {
    setStatus("Direct folder save is not supported here. Use Download JS.", "warn");
    return;
  }
  try {
    directoryHandle = await window.showDirectoryPicker({ id: "nordsweet-waypoints", mode: "readwrite" });
    const name = directoryHandle && directoryHandle.name ? directoryHandle.name : "selected folder";
    setStatus("Using " + name + " for country files.", name === "Waypoints" ? "ok" : "warn");
  } catch (error) {
    if (error && error.name === "AbortError") {
      setStatus("Folder selection cancelled.", "warn");
    } else {
      setStatus("Could not open folder. Use Download JS.", "danger");
    }
  }
}

async function saveCountryFile() {
  saveLocalState();
  renderExport();
  if (!window.showDirectoryPicker) {
    downloadCountryFile();
    setStatus("Downloaded " + getCountryFileName() + " because direct folder save is unavailable.", "warn");
    return;
  }
  try {
    if (!directoryHandle) {
      await chooseDirectory();
    }
    if (!directoryHandle) {
      return;
    }
    const fileHandle = await directoryHandle.getFileHandle(getCountryFileName(), { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(generateCountryFileText());
    await writable.close();
    setStatus("Saved " + getCountryFileName() + " in " + (directoryHandle.name || "selected folder") + ".", "ok");
  } catch (error) {
    if (error && error.name === "AbortError") {
      setStatus("Save cancelled.", "warn");
      return;
    }
    downloadCountryFile();
    setStatus("Direct save failed. Downloaded " + getCountryFileName() + " instead.", "warn");
  }
}

function parseCountryFile(text) {
  const sandbox = {};
  const script = String(text || "");
  const directJson = tryParseJson(script);
  if (directJson) {
    return normalizeCountryData(directJson);
  }
  try {
    const fn = new Function("window", script + "\nreturn window.NORDSWEET_PRIVATE_WAYPOINTS;");
    const result = fn(sandbox);
    const keys = Object.keys(result || {});
    if (!keys.length) {
      return null;
    }
    return normalizeCountryData(result[keys[0]]);
  } catch (error) {
    return null;
  }
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function openCountryFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseCountryFile(reader.result);
    if (!parsed) {
      setStatus("Could not read selected country file.", "danger");
      return;
    }
    state = mergeCountryData(getLoadedCountryData(parsed.country) || createCountryState(parsed.country), parsed);
    selectedWaypoint = "";
    selectedProcedureId = "";
    draftProcedure = createEmptyProcedure();
    saveLocalState();
    setStatus("Opened " + file.name + ".", "ok");
    render();
  };
  reader.readAsText(file);
}

function changeCountryFromInput() {
  const country = normalizeCountryName(refs.countryInput.value);
  if (country === state.country) {
    return;
  }
  const loaded = getLoadedCountryData(country);
  state = loaded || createCountryState(country);
  selectedWaypoint = "";
  selectedProcedureId = "";
  draftProcedure = createEmptyProcedure();
  saveLocalState();
  setStatus("Switched to " + country + ".", loaded ? "ok" : "warn");
  render();
}

function initPrivateGate() {
  const allowed = isLocalEditorAllowed();
  refs.privateGate.hidden = allowed;
  refs.editorShell.hidden = !allowed;
  if (!allowed) {
    setStatus("Editor disabled outside local mode.", "warn");
  }
}

refs.countryInput.addEventListener("change", changeCountryFromInput);
refs.countryInput.addEventListener("input", () => {
  refs.countryInput.value = normalizeCountryName(refs.countryInput.value);
  renderExport();
});
refs.waypointsTabBtn.addEventListener("click", () => setActiveTab("waypoints"));
refs.proceduresTabBtn.addEventListener("click", () => setActiveTab("procedures"));
refs.vfrTabBtn.addEventListener("click", () => setActiveTab("vfr"));
refs.openFileBtn.addEventListener("click", () => refs.openFileInput.click());
refs.openFileInput.addEventListener("change", () => {
  const file = refs.openFileInput.files && refs.openFileInput.files[0];
  if (file) {
    openCountryFile(file);
  }
  refs.openFileInput.value = "";
});
refs.chooseDirBtn.addEventListener("click", () => {
  void chooseDirectory();
});
refs.saveFileBtn.addEventListener("click", () => {
  void saveCountryFile();
});
refs.downloadBtn.addEventListener("click", () => {
  saveLocalState();
  renderExport();
  downloadCountryFile();
  setStatus("Downloaded " + getCountryFileName() + ".", "ok");
});
refs.copyBtn.addEventListener("click", async () => {
  saveLocalState();
  renderExport();
  try {
    await navigator.clipboard.writeText(refs.exportText.value);
    setStatus("Export copied.", "ok");
  } catch (error) {
    setStatus("Clipboard is unavailable here. Select the export text manually.", "warn");
  }
});

refs.waypointNameInput.addEventListener("input", () => {
  refs.waypointNameInput.value = normalizeWaypointName(refs.waypointNameInput.value);
});
refs.waypointGroupInput.addEventListener("input", () => {
  refs.waypointGroupInput.value = normalizeWaypointGroup(refs.waypointGroupInput.value);
});
refs.waypointCoordInput.addEventListener("input", () => {
  refs.waypointCoordInput.value = refs.waypointCoordInput.value.toUpperCase();
});
refs.waypointCoordInput.addEventListener("change", () => {
  applyWaypointCoordinateInput();
});
refs.waypointCoordInput.addEventListener("blur", () => {
  applyWaypointCoordinateInput({ silent: true });
});
refs.waypointSearchInput.addEventListener("input", () => {
  refs.waypointSearchInput.value = normalizeWaypointSearch(refs.waypointSearchInput.value);
  renderWaypointList();
});
refs.waypointFilterSelect.addEventListener("change", renderWaypointList);
refs.saveWaypointBtn.addEventListener("click", saveWaypoint);
refs.newWaypointBtn.addEventListener("click", clearWaypointForm);
refs.deleteWaypointBtn.addEventListener("click", deleteWaypoint);
refs.waypointList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-waypoint-id]");
  if (button) {
    populateWaypointForm(button.dataset.waypointId);
  }
});
refs.waypointList.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }
  const card = event.target.closest("[data-waypoint-id]");
  if (card) {
    event.preventDefault();
    populateWaypointForm(card.dataset.waypointId);
  }
});

refs.vfrAirportSelect.addEventListener("change", () => switchVfrAirport(refs.vfrAirportSelect.value));
refs.vfrAirportInput.addEventListener("input", () => {
  refs.vfrAirportInput.value = normalizeAirportIcao(refs.vfrAirportInput.value);
});
refs.vfrAirportInput.addEventListener("change", () => switchVfrAirport(refs.vfrAirportInput.value));
refs.vfrChartPdfInput.addEventListener("change", () => loadVfrChartPdfFromInput());
refs.vfrChartSourceInput.addEventListener("change", () => {
  saveVfrChartFields();
  saveLocalState();
  render();
});
refs.vfrChartTitleInput.addEventListener("change", () => {
  saveVfrChartFields();
  saveLocalState();
  render();
});
refs.vfrCircuitSelect.addEventListener("change", () => {
  const value = refs.vfrCircuitSelect.value;
  if (value.startsWith("RUNWAY:")) {
    const airportData = ensureVfrAirportData(selectedVfrAirport);
    const runwayId = normalizeRunwayId(value.slice("RUNWAY:".length));
    selectedVfrCircuit = "";
    selectedVfrRunwayTemplate = runwayId;
    refs.vfrCircuitRunwayInput.value = runwayId;
    refs.vfrCircuitIdInput.value = getUniqueVfrCircuitId(
      airportData,
      getDefaultVfrCircuitId(runwayId, refs.vfrCircuitDirectionSelect.value)
    );
  } else {
    selectedVfrCircuit = value;
    selectedVfrRunwayTemplate = "";
  }
  vfrCircuitDrawing = false;
  vfrPatternPickRole = "";
  vfrThresholdPickActive = false;
  vfrTouchdownPickActive = false;
  renderVfrEditor();
});
refs.vfrCircuitIdInput.addEventListener("input", () => {
  refs.vfrCircuitIdInput.value = normalizeVfrCircuitId(refs.vfrCircuitIdInput.value);
});
refs.vfrIntersectionSelect.addEventListener("change", () => {
  selectedVfrIntersection = refs.vfrIntersectionSelect.value;
  renderVfrEditor();
});
refs.addNewVfrCircuitBtn.addEventListener("click", () => addNewVfrCircuit());
refs.addRunwayVfrCircuitsBtn.addEventListener("click", () => addVfrCircuitsForGroundRunways());
refs.saveVfrCircuitBtn.addEventListener("click", () => saveVfrCircuit());
refs.startVfrCircuitBtn.addEventListener("click", () => startVfrCircuitDrawing());
refs.stopVfrCircuitBtn.addEventListener("click", () => stopVfrCircuitDrawing());
refs.undoVfrCircuitPointBtn.addEventListener("click", () => undoVfrCircuitPoint());
refs.clearVfrCircuitBtn.addEventListener("click", () => clearVfrCircuit());
refs.deleteVfrCircuitBtn.addEventListener("click", () => deleteVfrCircuit());
refs.deleteVfrIntersectionBtn.addEventListener("click", () => deleteVfrIntersection());
refs.pickVfrPatternPointBtn.addEventListener("click", () => {
  const role = normalizeTrafficPatternRole(refs.vfrPatternPointSelect.value);
  if (!getVfrCircuit(ensureVfrAirportData(selectedVfrAirport), selectedVfrCircuit)) {
    setStatus("Create or select a VFR circuit before picking traffic pattern turns.", "warn");
    return;
  }
  vfrPatternPickRole = role;
  vfrCircuitDrawing = false;
  vfrLineDrawingMode = false;
  setStatus("Click chart to set " + getTrafficPatternRoleLabel(role) + ".", "ok");
  renderVfrEditor();
});
refs.clearVfrPatternBtn.addEventListener("click", () => clearVfrTrafficPattern());
refs.pickVfrThresholdBtn.addEventListener("click", () => {
  if (!normalizeRunwayId(refs.vfrCircuitRunwayInput.value) && !getVfrCircuit(ensureVfrAirportData(selectedVfrAirport), selectedVfrCircuit)) {
    setStatus("Enter circuit runway before picking threshold.", "warn");
    return;
  }
  vfrThresholdPickActive = true;
  vfrTouchdownPickActive = false;
  vfrPatternPickRole = "";
  vfrCircuitDrawing = false;
  vfrLineDrawingMode = false;
  setStatus("Click chart point or intersection to set threshold for selected runway.", "ok");
  renderVfrEditor();
});
refs.clearVfrThresholdBtn.addEventListener("click", () => clearVfrThresholdPoint());
refs.pickVfrTouchdownBtn.addEventListener("click", () => {
  if (!getVfrCircuit(ensureVfrAirportData(selectedVfrAirport), selectedVfrCircuit)) {
    setStatus("Create or select a VFR circuit before picking touchdown.", "warn");
    return;
  }
  vfrTouchdownPickActive = true;
  vfrPatternPickRole = "";
  vfrCircuitDrawing = false;
  vfrLineDrawingMode = false;
  setStatus("Click an existing intersection to set manual touchdown.", "ok");
  renderVfrEditor();
});
refs.autoVfrTouchdownBtn.addEventListener("click", () => setAutoVfrTouchdown());
refs.clearVfrTouchdownBtn.addEventListener("click", () => clearVfrTouchdown());
refs.startVfrLineModeBtn.addEventListener("click", () => startVfrLineMode());
refs.stopVfrLineModeBtn.addEventListener("click", () => stopVfrLineMode());
refs.clearVfrLinesBtn.addEventListener("click", () => clearVfrConstructionLines());
refs.vfrChartMap.querySelectorAll("[data-vfr-chart-zoom]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleVfrChartZoom(button.dataset.vfrChartZoom, event.clientX, event.clientY);
  });
  button.addEventListener("wheel", (event) => {
    event.preventDefault();
    event.stopPropagation();
  }, { passive: false });
});
refs.vfrChartMap.addEventListener("wheel", (event) => {
  event.preventDefault();
  event.stopPropagation();
  handleVfrChartZoom(event.deltaY < 0 ? "in" : "out", event.clientX, event.clientY);
}, { passive: false });
refs.vfrChartOverlaySvg.addEventListener("click", (event) => {
  if (suppressNextVfrChartClick) {
    suppressNextVfrChartClick = false;
    return;
  }
  const marker = event.target.closest("[data-vfr-intersection-marker]");
  const crossingMarker = event.target.closest("[data-vfr-line-crossing]");
  const thresholdMarker = event.target.closest("[data-vfr-threshold-point]");
  const touchdownMarker = event.target.closest("[data-vfr-touchdown-point]");
  if (vfrThresholdPickActive) {
    if (marker) {
      const airportData = ensureVfrAirportData(selectedVfrAirport);
      const intersection = getVfrIntersectionById(airportData, marker.dataset.vfrIntersectionMarker || "");
      if (intersection) {
        setVfrThresholdPointAtPoint(intersection, intersection.id);
      }
    } else {
      setVfrThresholdPointAtPoint(getVfrChartPointFromEvent(event));
    }
    return;
  }
  if (vfrTouchdownPickActive) {
    if (marker) {
      setManualVfrTouchdownAtIntersection(marker.dataset.vfrIntersectionMarker || "");
    } else {
      setStatus("Manual touchdown must be an existing intersection.", "warn");
    }
    return;
  }
  if (vfrPatternPickRole) {
    if (marker) {
      const airportData = ensureVfrAirportData(selectedVfrAirport);
      const intersection = getVfrIntersectionById(airportData, marker.dataset.vfrIntersectionMarker || "");
      if (intersection) {
        setVfrTrafficPatternPointAtPoint(intersection, intersection.id);
      }
    } else {
      setVfrTrafficPatternPointAtPoint(getVfrChartPointFromEvent(event));
    }
    return;
  }
  if (vfrLineDrawingMode) {
    handleVfrLineModeClick(event, crossingMarker);
    return;
  }
  if (vfrCircuitDrawing) {
    if (crossingMarker) {
      addVfrCircuitPointAtLineCrossing(crossingMarker);
    } else if (thresholdMarker) {
      addVfrCircuitPointAtThreshold(thresholdMarker);
    } else if (touchdownMarker) {
      addVfrCircuitPointAtTouchdown(touchdownMarker);
    } else if (marker) {
      addVfrCircuitPointAtIntersection(marker.dataset.vfrIntersectionMarker || "");
    } else {
      setStatus("Circuit points can only use line crossings/intersections, thresholds or touchdown points.", "warn");
    }
    return;
  }
  if (marker) {
    selectedVfrIntersection = marker.dataset.vfrIntersectionMarker || "";
    setStatus("Selected VFR intersection " + selectedVfrIntersection + ".", "ok");
    renderVfrEditor();
    return;
  }
  createVfrIntersectionAtPoint(getVfrChartPointFromEvent(event));
});
refs.vfrChartOverlaySvg.addEventListener("pointerdown", (event) => {
  if (event.button && event.button !== 0) {
    return;
  }
  if (vfrCircuitDrawing) {
    return;
  }
  if (vfrPatternPickRole || vfrThresholdPickActive || vfrTouchdownPickActive) {
    return;
  }
  const lineEndpoint = event.target.closest("[data-vfr-line-endpoint]");
  if (lineEndpoint) {
    vfrLineEndpointDragState = {
      lineId: lineEndpoint.dataset.vfrLineEndpoint || "",
      endpoint: lineEndpoint.dataset.vfrLineEndpointPosition === "start" ? "start" : "end",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
    vfrLineDraft = null;
    vfrPendingLineStart = null;
    refs.vfrChartOverlaySvg.setPointerCapture(event.pointerId);
    renderVfrChartOverlay();
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const marker = event.target.closest("[data-vfr-intersection-marker]");
  if (vfrLineDrawingMode) {
    return;
  }
  if (!marker) {
    const transform = getVfrChartTransform();
    vfrChartPanState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: transform.panX,
      startPanY: transform.panY,
      moved: false
    };
    refs.vfrChartMap.classList.add("panning");
    refs.vfrChartOverlaySvg.setPointerCapture(event.pointerId);
    return;
  }
  selectedVfrIntersection = marker.dataset.vfrIntersectionMarker || "";
  vfrChartDragState = {
    id: selectedVfrIntersection,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false
  };
  refs.vfrChartOverlaySvg.setPointerCapture(event.pointerId);
  renderVfrChartOverlay();
  event.preventDefault();
});
refs.vfrChartOverlaySvg.addEventListener("pointermove", (event) => {
  if (vfrLineEndpointDragState && vfrLineEndpointDragState.pointerId === event.pointerId) {
    if (Math.abs(event.clientX - vfrLineEndpointDragState.startX) > 2 || Math.abs(event.clientY - vfrLineEndpointDragState.startY) > 2) {
      vfrLineEndpointDragState.moved = true;
    }
    moveVfrLineEndpointToPoint(
      vfrLineEndpointDragState.lineId,
      vfrLineEndpointDragState.endpoint,
      getVfrChartPointFromEvent(event)
    );
    event.preventDefault();
    return;
  }
  if (vfrChartPanState && vfrChartPanState.pointerId === event.pointerId) {
    const deltaX = event.clientX - vfrChartPanState.startX;
    const deltaY = event.clientY - vfrChartPanState.startY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      vfrChartPanState.moved = true;
    }
    setVfrChartTransform({
      panX: vfrChartPanState.startPanX + deltaX,
      panY: vfrChartPanState.startPanY + deltaY,
      scale: getVfrChartTransform().scale
    }, { refresh: false });
    event.preventDefault();
    return;
  }
  if (!vfrChartDragState || vfrChartDragState.pointerId !== event.pointerId) {
    return;
  }
  if (Math.abs(event.clientX - vfrChartDragState.startX) > 2 || Math.abs(event.clientY - vfrChartDragState.startY) > 2) {
    vfrChartDragState.moved = true;
  }
  moveSelectedVfrIntersectionToPoint(getVfrChartPointFromEvent(event));
  event.preventDefault();
});
refs.vfrChartOverlaySvg.addEventListener("pointerup", (event) => {
  if (vfrLineEndpointDragState && vfrLineEndpointDragState.pointerId === event.pointerId) {
    const moved = vfrLineEndpointDragState.moved;
    const lineId = vfrLineEndpointDragState.lineId;
    if (refs.vfrChartOverlaySvg.hasPointerCapture(event.pointerId)) {
      refs.vfrChartOverlaySvg.releasePointerCapture(event.pointerId);
    }
    vfrLineEndpointDragState = null;
    suppressNextVfrChartClick = true;
    saveLocalState();
    setStatus(moved ? "Moved endpoint for " + lineId + "." : "Selected endpoint for " + lineId + ".", "ok");
    render();
    event.preventDefault();
    return;
  }
  if (vfrChartPanState && vfrChartPanState.pointerId === event.pointerId) {
    const wasMoved = vfrChartPanState.moved;
    if (refs.vfrChartOverlaySvg.hasPointerCapture(event.pointerId)) {
      refs.vfrChartOverlaySvg.releasePointerCapture(event.pointerId);
    }
    refs.vfrChartMap.classList.remove("panning");
    vfrChartPanState = null;
    if (wasMoved) {
      suppressNextVfrChartClick = true;
      event.preventDefault();
    }
    return;
  }
  if (!vfrChartDragState || vfrChartDragState.pointerId !== event.pointerId) {
    return;
  }
  const moved = vfrChartDragState.moved;
  const movedId = vfrChartDragState.id;
  if (refs.vfrChartOverlaySvg.hasPointerCapture(event.pointerId)) {
    refs.vfrChartOverlaySvg.releasePointerCapture(event.pointerId);
  }
  vfrChartDragState = null;
  suppressNextVfrChartClick = true;
  saveLocalState();
  setStatus(moved ? "Moved VFR intersection " + movedId + "." : "Selected VFR intersection " + movedId + ".", "ok");
  render();
  event.preventDefault();
});
refs.vfrChartOverlaySvg.addEventListener("pointercancel", (event) => {
  if (refs.vfrChartOverlaySvg.hasPointerCapture(event.pointerId)) {
    refs.vfrChartOverlaySvg.releasePointerCapture(event.pointerId);
  }
  refs.vfrChartMap.classList.remove("panning");
  vfrChartPanState = null;
  vfrChartDragState = null;
  vfrLineEndpointDragState = null;
  vfrLineDraft = null;
  vfrPendingLineStart = null;
  renderVfrChartOverlay();
});

[
  refs.procedureAirportInput,
  refs.procedureDesignatorInput,
  refs.procedureRunwayInput
].forEach((input) => {
  input.addEventListener("input", () => {
    if (input === refs.procedureAirportInput) {
      input.value = normalizeProcedureToken(input.value, 4);
    } else if (input === refs.procedureDesignatorInput) {
      input.value = normalizeDesignator(input.value);
    } else {
      input.value = normalizeProcedureToken(input.value, 4);
    }
    syncDraftFromInputs();
    renderAirportProcedureList();
    renderExport();
  });
});
[
  refs.procedureCategorySelect,
  refs.procedureDirectionSelect,
  refs.approachTypeSelect,
  refs.approachOtherInput,
  refs.finalGlideSlopeInput,
  refs.procedureTitleInput,
  refs.procedureSourceInput
].forEach((input) => {
  input.addEventListener("input", () => {
    syncDraftFromInputs();
    renderProcedureDraft();
    renderExport();
  });
  input.addEventListener("change", () => {
    syncDraftFromInputs();
    renderProcedureDraft();
    renderExport();
  });
});
refs.procedureSelect.addEventListener("change", () => loadProcedure(refs.procedureSelect.value));
refs.airportProcedureList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-airport-procedure-id]");
  if (card) {
    loadProcedure(card.dataset.airportProcedureId);
  }
});
refs.airportProcedureList.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }
  const card = event.target.closest("[data-airport-procedure-id]");
  if (card) {
    event.preventDefault();
    loadProcedure(card.dataset.airportProcedureId);
  }
});
refs.newProcedureBtn.addEventListener("click", () => {
  selectedProcedureId = "";
  draftProcedure = createEmptyProcedure();
  renderProcedureSelect();
  renderProcedureDraft();
  setStatus("New procedure draft.", "ok");
});
refs.saveProcedureBtn.addEventListener("click", saveProcedure);
refs.deleteProcedureBtn.addEventListener("click", deleteProcedure);
refs.addLegBtn.addEventListener("click", () => addLeg("route"));
refs.addMissedLegBtn.addEventListener("click", () => addLeg("missed"));
refs.addDmeArcPointsBtn.addEventListener("click", () => {
  syncDraftFromInputs();
  if (ensureDmeArcProcedurePoints(draftProcedure, { addLegs: true })) {
    saveLocalState();
    setStatus("Added DME arc points " + draftProcedure.dmeArc.entryPoint + " and " + draftProcedure.dmeArc.exitPoint + ".", "ok");
    render();
  }
});
[
  refs.dmeSourceSelect,
  refs.dmeDistanceInput,
  refs.dmeEntryRadialInput,
  refs.dmeExitRadialInput
].forEach((input) => {
  input.addEventListener("change", () => {
    syncDraftFromInputs();
    renderProcedureDraft();
    renderExport();
  });
  input.addEventListener("input", () => {
    syncDraftFromInputs();
    renderExport();
  });
});
[refs.procedureLegList, refs.missedLegList].forEach((list) => {
  list.addEventListener("click", (event) => {
    const moveButton = event.target.closest("[data-move-leg]");
    if (moveButton) {
      const parts = moveButton.dataset.moveLeg.split("|");
      moveLeg(parts[0], Number(parts[1]), parts[2]);
      return;
    }
    const deleteButton = event.target.closest("[data-delete-leg]");
    if (deleteButton) {
      const parts = deleteButton.dataset.deleteLeg.split("|");
      deleteLeg(parts[0], Number(parts[1]));
    }
  });
});

initPrivateGate();
render();

}
