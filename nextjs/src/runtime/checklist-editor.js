// @ts-nocheck -- legacy DOM engine; type it when this screen is migrated to React.
export async function start(loadScript) {
await loadScript("./aircraft-data.js");
await loadScript("./aircraft-data/p2006t-performance.js");
await loadScript("./aircraft-data/husk-performance.js");
await loadScript("./aircraft-data/fr172h-performance.js");
await loadScript("./aircraft-data/r172k-performance.js");
await loadScript("./aircraft-data/P2006T%20data.js");
await loadScript("./aircraft-data/P2008JC%20data.js");
await loadScript("./aircraft-data/P2002JR%20data.js");
await loadScript("./aircraft-data/C172%20data.js");
await loadScript("./aircraft-data/C152%20data.js");
await loadScript("./aircraft-data/HUSK%20data.js");
await loadScript("./aircraft-data/FR172H%20data.js");
await loadScript("./aircraft-data/R172K%20data.js");

const DEFAULT_AIRCRAFT_PROFILES = [
  { dataFileBaseName: "P2006T data", displayName: "Tecnam P2006T", engineCount: 2, icaoType: "P06T", order: 1, powerplant: "reciprocating", type: "P2006T" },
  { dataFileBaseName: "P2008JC data", displayName: "Tecnam P2008JC", engineCount: 1, icaoType: "P208", order: 2, powerplant: "reciprocating", type: "P2008JC" },
  { dataFileBaseName: "P2002JR data", displayName: "Tecnam P2002JR", engineCount: 1, icaoType: "SIRA", order: 3, powerplant: "reciprocating", type: "P2002JR" },
  { dataFileBaseName: "C172 data", displayName: "Cessna 172", engineCount: 1, icaoType: "C172", order: 4, powerplant: "reciprocating", type: "C172" },
  { dataFileBaseName: "C152 data", displayName: "Cessna 152", engineCount: 1, icaoType: "C152", order: 5, powerplant: "reciprocating", type: "C152" },
  { dataFileBaseName: "HUSK data", displayName: "Aviat A-1A Husky", engineCount: 1, icaoType: "HUSK", order: 6, powerplant: "reciprocating", type: "A-1A Husky" },
  { dataFileBaseName: "FR172H data", displayName: "Reims-Cessna FR172H Reims Rocket", engineCount: 1, icaoType: "C172", order: 7, powerplant: "reciprocating", type: "FR172H" },
  { dataFileBaseName: "R172K data", displayName: "Cessna R172K", engineCount: 1, icaoType: "C172", order: 8, powerplant: "reciprocating", type: "R172K" }
];
const AIRCRAFT_TYPES = DEFAULT_AIRCRAFT_PROFILES.map((profile) => profile.type);
const STORAGE_KEY = "nordsweet-aircraft-data-editor-v2";
const LEGACY_STORAGE_KEY = "nordsweet-checklist-editor-v1";
const CHECKLIST_PHASES = [
  { key: "taxiout", label: "Taxi-Out" },
  { key: "takeoff", label: "Take-off" },
  { key: "climb", label: "Climb" },
  { key: "cruise", label: "Cruise" },
  { key: "descent", label: "Descent" },
  { key: "landing", label: "Landing" },
  { key: "taxiin", label: "Taxi-In" }
];

const DEFAULT_CHECKLIST_NAMES = [
  "Before Engine Start",
  "Engine Start",
  "Before Taxi",
  "Run-up",
  "Taxi",
  "Before Take-off",
  "Line-up",
  "Take-off",
  "After takeoff",
  "Cruise",
  "Descent/approach",
  "Before Landing",
  "Final Check",
  "Go Around",
  "After Landing",
  "After vacating",
  "Shutdown"
];
const DEFAULT_CHECKLIST_PHASE_BY_NAME = {
  "Before Engine Start": "taxiout",
  "Engine Start": "taxiout",
  "Before Taxi": "taxiout",
  "Run-up": "taxiout",
  "Taxi": "taxiout",
  "Before Take-off": "taxiout",
  "Line-up": "takeoff",
  "Take-off": "takeoff",
  "After takeoff": "takeoff",
  "Cruise": "cruise",
  "Descent/approach": "descent",
  "Before Landing": "landing",
  "Final Check": "landing",
  "Go Around": "landing",
  "After Landing": "landing",
  "After vacating": "taxiin",
  "Shutdown": "taxiin"
};
const CHECKLIST_NAME_RENAMES = {
  "Before Starting Engine": "Before Engine Start",
  "RUN UP (ON STAND OR HOLDING POINT)": "Run-up",
  "Run Up (On Stand Or Holding Point)": "Run-up",
  "Run Up": "Run-up"
};

const refs = {
  addAircraftBtn: document.getElementById("addAircraftBtn"),
  addChecklistBtn: document.getElementById("addChecklistBtn"),
  addSectionBtn: document.getElementById("addSectionBtn"),
  aircraftRegistrationInput: document.getElementById("aircraftRegistrationInput"),
  aircraftSelect: document.getElementById("aircraftSelect"),
  aircraftTypeInput: document.getElementById("aircraftTypeInput"),
  basicFuelFlowSlLphInput: document.getElementById("basicFuelFlowSlLphInput"),
  checklistNameInput: document.getElementById("checklistNameInput"),
  checklistPhaseSelect: document.getElementById("checklistPhaseSelect"),
  checklistSelect: document.getElementById("checklistSelect"),
  copyBtn: document.getElementById("copyBtn"),
  deleteChecklistBtn: document.getElementById("deleteChecklistBtn"),
  displayNameInput: document.getElementById("displayNameInput"),
  duplicateChecklistBtn: document.getElementById("duplicateChecklistBtn"),
  engineCountSelect: document.getElementById("engineCountSelect"),
  exportBox: document.getElementById("exportBox"),
  headwindLimitKtInput: document.getElementById("headwindLimitKtInput"),
  icaoTypeInput: document.getElementById("icaoTypeInput"),
  powerplantSelect: document.getElementById("powerplantSelect"),
  profileScopeSelect: document.getElementById("profileScopeSelect"),
  renameChecklistBtn: document.getElementById("renameChecklistBtn"),
  resetBtn: document.getElementById("resetBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  saveProfileBtn: document.getElementById("saveProfileBtn"),
  saveFileBtn: document.getElementById("saveFileBtn"),
  sectionList: document.getElementById("sectionList"),
  statusBox: document.getElementById("statusBox"),
  tailwindLimitKtInput: document.getElementById("tailwindLimitKtInput"),
  crosswindLimitKtInput: document.getElementById("crosswindLimitKtInput")
};

const WIND_LIMIT_FIELDS = [
  {
    key: "maxHeadwindKt",
    inputRef: "headwindLimitKtInput",
    aliases: ["maxHeadwindKt", "headwindLimitKt", "headwindKt", "headwind"]
  },
  {
    key: "maxTailwindKt",
    inputRef: "tailwindLimitKtInput",
    aliases: ["maxTailwindKt", "tailwindLimitKt", "tailwindKt", "tailwind"]
  },
  {
    key: "maxCrosswindKt",
    inputRef: "crosswindLimitKtInput",
    aliases: ["maxCrosswindKt", "crosswindLimitKt", "crosswindKt", "crosswind"]
  }
];

let state = loadState();

function createId(prefix) {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function normalizeChecklistPhase(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const aliases = {
    taxiout: "taxiout",
    taxi: "taxiout",
    takeoff: "takeoff",
    climb: "climb",
    cruise: "cruise",
    descent: "descent",
    descend: "descent",
    approach: "descent",
    landing: "landing",
    taxiin: "taxiin"
  };
  return aliases[normalized] || "";
}

function getDefaultChecklistPhase(name) {
  return DEFAULT_CHECKLIST_PHASE_BY_NAME[name] || "taxiout";
}

function getChecklistPhaseLabel(phaseValue) {
  const phaseKey = normalizeChecklistPhase(phaseValue) || "taxiout";
  const phase = CHECKLIST_PHASES.find((entry) => entry.key === phaseKey);
  return phase ? phase.label : "Taxi-Out";
}

function createChecklist(name) {
  return {
    id: createId("cl"),
    name,
    phase: getDefaultChecklistPhase(name),
    sections: [
      {
        id: createId("sec"),
        title: "Main",
        items: [
          { id: createId("item"), action: "", expected: "" }
        ]
      }
    ]
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanValue(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getPositiveNumber(value) {
  const parsed = Number(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getNonNegativeNumber(value) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getWindLimitField(fieldKey) {
  return WIND_LIMIT_FIELDS.find((field) => field.key === fieldKey) || null;
}

function getWindLimitValue(limitations, fieldKey) {
  const field = getWindLimitField(fieldKey);
  if (!field || !isPlainObject(limitations)) {
    return null;
  }

  const sources = [];
  if (isPlainObject(limitations.wind)) {
    sources.push(limitations.wind);
  }
  sources.push(limitations);

  for (const source of sources) {
    for (const alias of field.aliases) {
      const value = getNonNegativeNumber(source[alias]);
      if (value !== null) {
        return value;
      }
    }
  }
  return null;
}

function normalizeLimitations(limitations) {
  if (!isPlainObject(limitations)) {
    return null;
  }

  const normalized = clone(limitations);
  WIND_LIMIT_FIELDS.forEach((field) => {
    field.aliases.forEach((alias) => {
      delete normalized[alias];
    });
  });

  const wind = isPlainObject(normalized.wind) ? Object.assign({}, normalized.wind) : {};
  WIND_LIMIT_FIELDS.forEach((field) => {
    field.aliases.forEach((alias) => {
      if (alias !== field.key) {
        delete wind[alias];
      }
    });
    const value = getWindLimitValue(limitations, field.key);
    if (value === null) {
      delete wind[field.key];
    } else {
      wind[field.key] = value;
    }
  });

  if (Object.keys(wind).length) {
    normalized.wind = wind;
  } else {
    delete normalized.wind;
  }

  return Object.keys(normalized).length ? normalized : null;
}

function getLimitationsFromProfileFields(baseLimitations) {
  const limitations = normalizeLimitations(baseLimitations) || {};
  const wind = isPlainObject(limitations.wind) ? Object.assign({}, limitations.wind) : {};

  WIND_LIMIT_FIELDS.forEach((field) => {
    const input = refs[field.inputRef];
    const value = getNonNegativeNumber(input && input.value);
    if (value === null) {
      delete wind[field.key];
    } else {
      wind[field.key] = value;
    }
  });

  if (Object.keys(wind).length) {
    limitations.wind = wind;
  } else {
    delete limitations.wind;
  }

  return Object.keys(limitations).length ? limitations : null;
}

function getProfileBasicFuelFlowLph(profile) {
  const directValue = getPositiveNumber(profile && profile.basicFuelFlowLphAtSeaLevel);
  if (directValue) {
    return directValue;
  }

  const performance = profile && profile.performance && typeof profile.performance === "object"
    ? profile.performance
    : null;
  const basic = performance && performance.basic && typeof performance.basic === "object"
    ? performance.basic
    : null;
  return getPositiveNumber(basic && basic.fuelFlowLphAtSeaLevel);
}

function normalizeAircraftType(value) {
  return cleanValue(value).toUpperCase();
}

function normalizeIcaoType(value) {
  return cleanValue(value).toUpperCase().replace(/[^A-Z0-9]+/g, "") || "AIRCRAFT";
}

function normalizeRegistration(value) {
  return cleanValue(value).toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function formatRegistrationForDataFile(value) {
  const normalized = normalizeRegistration(value);
  if (!normalized) {
    return "";
  }
  if (/^[A-Z]{2}[A-Z0-9]{3,}$/.test(normalized)) {
    return normalized.slice(0, 2) + "-" + normalized.slice(2);
  }
  return normalized;
}

function normalizePowerplant(value) {
  const normalized = cleanValue(value).toLowerCase().replace(/[^a-z]+/g, "");
  if (normalized === "turbine") {
    return "turbine";
  }
  if (normalized === "jet") {
    return "jet";
  }
  return "reciprocating";
}

function normalizeEngineCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 4 ? Math.round(parsed) : null;
}

function getDefaultEngineCountForType(type) {
  const normalizedType = normalizeAircraftType(type);
  const defaultProfile = DEFAULT_AIRCRAFT_PROFILES.find((profile) => normalizeAircraftType(profile.type) === normalizedType);
  return normalizeEngineCount(defaultProfile && defaultProfile.engineCount) || 1;
}

function getProfileEngineCount(profile) {
  return normalizeEngineCount(profile && profile.engineCount) || getDefaultEngineCountForType(profile && profile.type);
}

function getProfileKeyFromParts(type, registration) {
  const normalizedType = normalizeAircraftType(type);
  const normalizedRegistration = normalizeRegistration(registration);
  return normalizedRegistration ? normalizedType + "|" + normalizedRegistration : normalizedType;
}

function getProfileKey(profile) {
  return getProfileKeyFromParts(profile && profile.type, profile && profile.registration);
}

function createProfile(profile) {
  const type = normalizeAircraftType(profile && profile.type) || "AIRCRAFT";
  const registration = normalizeRegistration(profile && profile.registration);
  return {
    basicFuelFlowLphAtSeaLevel: getProfileBasicFuelFlowLph(profile),
    dataFileBaseName: cleanValue(profile && profile.dataFileBaseName) || getAircraftDataFileBaseName({ type, registration }),
    displayName: cleanValue(profile && profile.displayName) || type,
    engineCount: getProfileEngineCount(profile),
    icaoType: cleanValue(profile && profile.icaoType || type).toUpperCase(),
    limitations: normalizeLimitations(profile && profile.limitations),
    order: Number.isFinite(Number(profile && profile.order)) ? Number(profile.order) : 999,
    powerplant: normalizePowerplant(profile && profile.powerplant),
    registration,
    source: cleanValue(profile && profile.source) || "Airplane Data Editor",
    type
  };
}

function createDefaultProfiles() {
  return DEFAULT_AIRCRAFT_PROFILES.reduce((profiles, profile) => {
    const normalizedProfile = createProfile(profile);
    profiles[getProfileKey(normalizedProfile)] = normalizedProfile;
    return profiles;
  }, {});
}

function getRegisteredAircraftProfile(type) {
  if (!window.NORDSWEET_AIRCRAFT_DATA || typeof window.NORDSWEET_AIRCRAFT_DATA.getProfile !== "function") {
    return null;
  }
  return window.NORDSWEET_AIRCRAFT_DATA.getProfile(type, "") || null;
}

function getRegisteredAircraftChecklists(type) {
  const profile = getRegisteredAircraftProfile(type);
  return profile && Array.isArray(profile.checklists) && profile.checklists.length
    ? clone(profile.checklists)
    : null;
}

function createDefaultChecklistData() {
  return AIRCRAFT_TYPES.reduce((data, aircraftType) => {
    const normalizedType = normalizeAircraftType(aircraftType);
    const profileChecklists = getRegisteredAircraftChecklists(normalizedType) || getRegisteredAircraftChecklists(aircraftType);
    data[normalizedType] = profileChecklists
      ? profileChecklists
      : DEFAULT_CHECKLIST_NAMES.map(createChecklist);
    return data;
  }, {});
}

function migrateChecklistNames(data) {
  Object.keys(data || {}).forEach((type) => {
    const checklists = Array.isArray(data[type]) ? data[type] : [];
    checklists.forEach((checklist) => {
      if (checklist && CHECKLIST_NAME_RENAMES[checklist.name]) {
        checklist.name = CHECKLIST_NAME_RENAMES[checklist.name];
      }
      if (checklist && !normalizeChecklistPhase(checklist.phase)) {
        checklist.phase = getDefaultChecklistPhase(checklist.name);
      }
    });
  });
  return data;
}

function getInitialState() {
  return {
    aircraft: "P2006T",
    checklistId: "",
    data: migrateChecklistNames(createDefaultChecklistData()),
    profiles: createDefaultProfiles()
  };
}

function normalizeStoredProfiles(profiles) {
  const normalizedProfiles = createDefaultProfiles();
  if (!profiles || typeof profiles !== "object") {
    return normalizedProfiles;
  }

  Object.keys(profiles).forEach((key) => {
    const profile = createProfile(profiles[key]);
    normalizedProfiles[getProfileKey(profile) || key] = profile;
  });
  return normalizedProfiles;
}

function normalizeStoredData(data) {
  const normalizedData = createDefaultChecklistData();
  if (!data || typeof data !== "object") {
    return migrateChecklistNames(normalizedData);
  }

  Object.keys(data).forEach((key) => {
    if (Array.isArray(data[key])) {
      normalizedData[key] = data[key];
    }
  });
  return migrateChecklistNames(normalizedData);
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (stored && stored.profiles && stored.data) {
      const profiles = normalizeStoredProfiles(stored.profiles);
      const data = normalizeStoredData(stored.data);
      const aircraft = profiles[stored.aircraft] ? stored.aircraft : "P2006T";
      return {
        aircraft,
        checklistId: cleanValue(stored.checklistId),
        data,
        profiles
      };
    }
  } catch (_error) {
    // Fall through to legacy/defaults.
  }

  try {
    const legacyData = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "null");
    if (legacyData && typeof legacyData === "object") {
      const initialState = getInitialState();
      initialState.data = normalizeStoredData(legacyData);
      return initialState;
    }
  } catch (_error) {
    // Fall through to defaults.
  }
  return getInitialState();
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    aircraft: state.aircraft,
    checklistId: state.checklistId,
    data: state.data,
    profiles: state.profiles
  }));
}

function getProfileList() {
  return Object.keys(state.profiles)
    .map((key) => state.profiles[key])
    .filter(Boolean)
    .sort((left, right) => (left.order - right.order) || left.type.localeCompare(right.type) || left.registration.localeCompare(right.registration));
}

function getCurrentProfile() {
  if (!state.profiles[state.aircraft]) {
    state.aircraft = "P2006T";
  }
  return state.profiles[state.aircraft] || getProfileList()[0] || createProfile({ type: "P2006T" });
}

function getChecklists() {
  const key = getProfileKey(getCurrentProfile());
  if (!Array.isArray(state.data[key])) {
    state.data[key] = DEFAULT_CHECKLIST_NAMES.map(createChecklist);
  }
  return state.data[key];
}

function getCurrentChecklist() {
  const checklists = getChecklists();
  return checklists.find((checklist) => checklist.id === state.checklistId) || checklists[0] || null;
}

function setStatus(message, tone = "") {
  refs.statusBox.textContent = message;
  refs.statusBox.className = "status" + (tone ? " " + tone : "");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getAircraftDataFileBaseName(profile) {
  const explicitBaseName = cleanValue(profile && profile.dataFileBaseName);
  const normalizedRegistration = normalizeRegistration(profile && profile.registration);
  if (!normalizedRegistration && explicitBaseName) {
    return explicitBaseName;
  }
  const icaoType = normalizeIcaoType(profile && (profile.icaoType || profile.type));
  const registration = formatRegistrationForDataFile(normalizedRegistration);
  return icaoType + (registration ? "." + registration : "") + "-data";
}

function getAircraftDataFileName(profile) {
  return getAircraftDataFileBaseName(profile) + ".js";
}

function getProfileOptionLabel(profile) {
  const registration = normalizeRegistration(profile && profile.registration);
  return (profile.displayName || profile.type) + " (" + (profile.icaoType || profile.type) + ")" + (registration ? " / " + registration : "");
}

function renderAircraftSelect() {
  const profiles = getProfileList();
  refs.aircraftSelect.innerHTML = profiles.map((profile) => {
    const key = getProfileKey(profile);
    return '<option value="' + escapeHtml(key) + '"' + (key === state.aircraft ? " selected" : "") + ">" + escapeHtml(getProfileOptionLabel(profile)) + "</option>";
  }).join("");
}

function renderProfileFields() {
  const profile = getCurrentProfile();
  const isSpecific = Boolean(normalizeRegistration(profile.registration));
  refs.profileScopeSelect.value = isSpecific ? "specific" : "basic";
  refs.aircraftTypeInput.value = profile.type || "";
  refs.aircraftRegistrationInput.value = profile.registration || "";
  refs.aircraftRegistrationInput.disabled = !isSpecific;
  refs.displayNameInput.value = profile.displayName || "";
  refs.engineCountSelect.value = String(getProfileEngineCount(profile));
  refs.icaoTypeInput.value = profile.icaoType || "";
  refs.powerplantSelect.value = normalizePowerplant(profile.powerplant);
  refs.basicFuelFlowSlLphInput.value = Number.isFinite(Number(profile.basicFuelFlowLphAtSeaLevel))
    ? String(profile.basicFuelFlowLphAtSeaLevel)
    : "";
  WIND_LIMIT_FIELDS.forEach((field) => {
    const value = getWindLimitValue(profile.limitations, field.key);
    refs[field.inputRef].value = value === null ? "" : String(value);
  });
}

function renderPowerplantSelect() {
  const options = [
    { key: "reciprocating", label: "Reciprocating" },
    { key: "turbine", label: "Turbine" },
    { key: "jet", label: "Jet" }
  ];
  refs.powerplantSelect.innerHTML = options.map((option) =>
    '<option value="' + option.key + '">' + option.label + "</option>"
  ).join("");
}

function renderEngineCountSelect() {
  const options = [
    { key: "1", label: "1 engine" },
    { key: "2", label: "2 engines" },
    { key: "3", label: "3 engines" },
    { key: "4", label: "4 engines" }
  ];
  refs.engineCountSelect.innerHTML = options.map((option) =>
    '<option value="' + option.key + '">' + option.label + "</option>"
  ).join("");
}

function renderChecklistPhaseSelect() {
  const checklist = getCurrentChecklist();
  const selectedPhase = normalizeChecklistPhase(checklist && checklist.phase)
    || getDefaultChecklistPhase(checklist && checklist.name);
  refs.checklistPhaseSelect.innerHTML = CHECKLIST_PHASES.map((phase) =>
    '<option value="' + phase.key + '"' + (phase.key === selectedPhase ? " selected" : "") + ">" + escapeHtml(phase.label) + "</option>"
  ).join("");
  refs.checklistPhaseSelect.disabled = !checklist;
}

function renderChecklistSelect() {
  const checklists = getChecklists();
  if (!state.checklistId && checklists[0]) {
    state.checklistId = checklists[0].id;
  }
  refs.checklistSelect.innerHTML = checklists.length
    ? checklists.map((checklist) =>
        '<option value="' + checklist.id + '"' + (checklist.id === state.checklistId ? " selected" : "") + ">" + escapeHtml(checklist.name + " / " + getChecklistPhaseLabel(checklist.phase)) + "</option>"
      ).join("")
    : '<option value="">No checklist yet</option>';
}

function renderSections() {
  const checklist = getCurrentChecklist();
  refs.checklistNameInput.value = checklist ? checklist.name : "";
  renderChecklistPhaseSelect();
  if (!checklist) {
    refs.sectionList.innerHTML = '<div class="status warn">Add a new checklist to start editing.</div>';
    return;
  }

  refs.sectionList.innerHTML = checklist.sections.map((section, sectionIndex) => (
    '<div class="section-card" data-section-id="' + section.id + '">' +
      '<div class="section-head">' +
        '<strong>Section ' + (sectionIndex + 1) + '</strong>' +
        '<button type="button" class="danger" data-delete-section="' + section.id + '">Delete</button>' +
      "</div>" +
      '<div>' +
        '<label>Section title</label>' +
        '<input type="text" value="' + escapeHtml(section.title) + '" data-section-title="' + section.id + '">' +
      "</div>" +
      '<div class="stack">' +
        section.items.map((item) => (
          '<div class="item-card" data-item-id="' + item.id + '">' +
            '<div>' +
              '<label>Action</label>' +
              '<input type="text" value="' + escapeHtml(item.action) + '" data-item-action="' + section.id + "|" + item.id + '" placeholder="Fuel selector">' +
            "</div>" +
            '<div>' +
              '<label>Expected</label>' +
              '<input type="text" value="' + escapeHtml(item.expected) + '" data-item-expected="' + section.id + "|" + item.id + '" placeholder="ON">' +
            "</div>" +
            '<button type="button" class="danger" data-delete-item="' + section.id + "|" + item.id + '">X</button>' +
          "</div>"
        )).join("") +
      "</div>" +
      '<button type="button" class="secondary" data-add-item="' + section.id + '">Add item</button>' +
    "</div>"
  )).join("");
}

function renderExport() {
  refs.exportBox.value = getExportContent();
}

function getExportChecklists(checklists = getChecklists()) {
  return (Array.isArray(checklists) ? checklists : []).map((checklist) => ({
    id: checklist.id,
    name: checklist.name,
    phase: normalizeChecklistPhase(checklist.phase) || getDefaultChecklistPhase(checklist.name),
    sections: checklist.sections.map((section) => ({
      id: section.id,
      title: section.title,
      items: section.items.map((item) => ({
        action: item.action,
        expected: item.expected
      }))
    }))
  }));
}

function getExportContent() {
  const profile = getCurrentProfile();
  const performanceExpression = getPerformanceExpression(profile);
  const performanceStatusExpression = getPerformanceStatusExpression(profile);
  const exportProfile = {
    checklists: getExportChecklists(),
    dataFileBaseName: getAircraftDataFileBaseName(profile),
    displayName: profile.displayName,
    engineCount: getProfileEngineCount(profile),
    icaoType: profile.icaoType,
    order: profile.order,
    performance: "__PERFORMANCE__",
    performanceStatus: "__PERFORMANCE_STATUS__",
    powerplant: normalizePowerplant(profile.powerplant),
    registration: profile.registration,
    source: profile.source || "Airplane Data Editor",
    type: profile.type
  };
  const limitations = normalizeLimitations(profile.limitations);
  if (limitations) {
    exportProfile.limitations = limitations;
  }
  const json = JSON.stringify(exportProfile, null, 2)
    .replace('"__PERFORMANCE__"', performanceExpression)
    .replace('"__PERFORMANCE_STATUS__"', performanceStatusExpression);

  return "window.NORDSWEET_AIRCRAFT_DATA.register(" + json + ");\n";
}

function getBasePerformanceExpression(profile) {
  const normalizedType = normalizeAircraftType(profile && profile.type);
  if (normalizedType === "P2006T" && !profile.registration) {
    return "window.P2006T_PERFORMANCE || null";
  }
  if (normalizedType === "A-1A HUSKY" || normalizedType === "HUSK") {
    return "window.HUSK_PERFORMANCE || null";
  }
  if (normalizedType === "FR172H") {
    return "window.FR172H_PERFORMANCE || null";
  }
  if (normalizedType === "R172K") {
    return "window.R172K_PERFORMANCE || null";
  }
  return "null";
}

function getBasicPerformancePatch(profile) {
  const fuelFlowLph = getPositiveNumber(profile && profile.basicFuelFlowLphAtSeaLevel);
  if (!fuelFlowLph) {
    return null;
  }
  return {
    fuelFlowLphAtSeaLevel: fuelFlowLph
  };
}

function getPerformanceExpression(profile) {
  const baseExpression = getBasePerformanceExpression(profile);
  const basicPatch = getBasicPerformancePatch(profile);
  if (!basicPatch) {
    return baseExpression;
  }

  return "(function (base) { " +
    "const performance = base ? Object.assign({}, base) : {}; " +
    "performance.basic = Object.assign({}, performance.basic || {}, " + JSON.stringify(basicPatch) + "); " +
    "return performance; " +
    "})(" + baseExpression + ")";
}

function getPerformanceStatusExpression(profile) {
  const normalizedType = normalizeAircraftType(profile && profile.type);
  const hasBasicPerformance = Boolean(getBasicPerformancePatch(profile));
  if (normalizedType === "P2006T" && !profile.registration) {
    return "window.P2006T_PERFORMANCE ? \"available\" : " + JSON.stringify(hasBasicPerformance ? "partial" : "pending");
  }
  if (normalizedType === "A-1A HUSKY" || normalizedType === "HUSK") {
    return "(window.HUSK_PERFORMANCE || " + (hasBasicPerformance ? "true" : "false") + ") ? \"partial\" : \"pending\"";
  }
  if (normalizedType === "FR172H") {
    return "(window.FR172H_PERFORMANCE || " + (hasBasicPerformance ? "true" : "false") + ") ? \"partial\" : \"pending\"";
  }
  if (normalizedType === "R172K") {
    return "(window.R172K_PERFORMANCE || " + (hasBasicPerformance ? "true" : "false") + ") ? \"partial\" : \"pending\"";
  }
  return JSON.stringify(hasBasicPerformance ? "partial" : "pending");
}

function downloadExportFile() {
  const blob = new Blob([getExportContent()], { type: "text/javascript;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getAircraftDataFileName(getCurrentProfile());
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function saveExportFile() {
  saveData();
  renderExport();

  if (!window.showSaveFilePicker) {
    downloadExportFile();
    setStatus("Browser does not support direct file save. Downloaded aircraft data file instead.", "warn");
    return;
  }

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: getAircraftDataFileName(getCurrentProfile()),
      types: [
        {
          description: "JavaScript data file",
          accept: { "text/javascript": [".js"] }
        }
      ]
    });
    const writable = await handle.createWritable();
    await writable.write(getExportContent());
    await writable.close();
    setStatus("Saved " + getAircraftDataFileName(getCurrentProfile()) + ".", "ok");
  } catch (error) {
    if (error && error.name === "AbortError") {
      setStatus("File save cancelled.", "warn");
      return;
    }
    setStatus("File save failed. Use Download JS as fallback.", "warn");
  }
}

function render() {
  renderPowerplantSelect();
  renderEngineCountSelect();
  renderProfileFields();
  renderAircraftSelect();
  renderChecklistSelect();
  renderSections();
  renderExport();
}

function getNextNewAircraftType() {
  let counter = 1;
  while (state.profiles["NEW" + counter]) {
    counter += 1;
  }
  return "NEW" + counter;
}

function addAircraftProfile() {
  const type = getNextNewAircraftType();
  const profile = createProfile({
    displayName: type,
    engineCount: 1,
    icaoType: type,
    order: 900 + getProfileList().length,
    powerplant: "reciprocating",
    type
  });
  const key = getProfileKey(profile);
  state.profiles[key] = profile;
  state.data[key] = DEFAULT_CHECKLIST_NAMES.map(createChecklist);
  state.aircraft = key;
  state.checklistId = "";
  saveData();
  setStatus("Added aircraft profile. Update type, registration, powerplant and engine count, then save the data file.", "ok");
  render();
}

function applyProfileFields(options = {}) {
  const currentProfile = getCurrentProfile();
  const oldKey = getProfileKey(currentProfile);
  const shouldKeepOldProfile = !currentProfile.registration
    && DEFAULT_AIRCRAFT_PROFILES.some((profile) => normalizeAircraftType(profile.type) === currentProfile.type);
  const scope = refs.profileScopeSelect.value === "specific" ? "specific" : "basic";
  const nextType = normalizeAircraftType(refs.aircraftTypeInput.value);
  if (!nextType) {
    setStatus("Aircraft type cannot be empty.", "warn");
    return false;
  }

  const nextRegistration = scope === "specific" ? normalizeRegistration(refs.aircraftRegistrationInput.value) : "";
  if (scope === "specific" && !nextRegistration) {
    setStatus("Specific registration profile needs a registration.", "warn");
    return false;
  }
  const builtInBaseProfile = !nextRegistration
    ? DEFAULT_AIRCRAFT_PROFILES.find((profile) => normalizeAircraftType(profile.type) === nextType)
    : null;

  const nextProfile = createProfile({
    dataFileBaseName: nextRegistration
      ? ""
      : cleanValue(builtInBaseProfile && builtInBaseProfile.dataFileBaseName || currentProfile.dataFileBaseName),
    displayName: cleanValue(refs.displayNameInput.value) || nextType,
    engineCount: getProfileEngineCount({ engineCount: refs.engineCountSelect.value, type: nextType }),
    icaoType: cleanValue(refs.icaoTypeInput.value) || nextType,
    basicFuelFlowLphAtSeaLevel: getPositiveNumber(refs.basicFuelFlowSlLphInput.value),
    limitations: getLimitationsFromProfileFields(currentProfile.limitations),
    order: currentProfile.order,
    powerplant: refs.powerplantSelect.value,
    registration: nextRegistration,
    source: currentProfile.source || "Airplane Data Editor",
    type: nextType
  });
  const nextKey = getProfileKey(nextProfile);

  if (nextKey !== oldKey && state.profiles[nextKey]) {
    setStatus("That aircraft profile already exists. Select it from the list instead of overwriting it.", "warn");
    return false;
  }

  if (!shouldKeepOldProfile || nextKey === oldKey) {
    delete state.profiles[oldKey];
  }
  state.profiles[nextKey] = nextProfile;
  if (nextKey !== oldKey) {
    state.data[nextKey] = clone(state.data[oldKey] || DEFAULT_CHECKLIST_NAMES.map(createChecklist));
    if (!shouldKeepOldProfile) {
      delete state.data[oldKey];
    }
    state.aircraft = nextKey;
    state.checklistId = "";
  }

  saveData();
  if (!options.silent) {
    setStatus("Aircraft profile updated. Export file name: " + getAircraftDataFileName(nextProfile) + ".", "ok");
  }
  render();
  return true;
}

function addChecklist() {
  const checklists = getChecklists();
  const next = createChecklist("New checklist");
  checklists.push(next);
  state.checklistId = next.id;
  saveData();
  setStatus("Added new checklist.", "ok");
  render();
}

function duplicateChecklist() {
  const current = getCurrentChecklist();
  if (!current) {
    return;
  }
  const copy = clone(current);
  copy.id = createId("cl");
  copy.name = current.name + " copy";
  copy.sections.forEach((section) => {
    section.id = createId("sec");
    section.items.forEach((item) => {
      item.id = createId("item");
    });
  });
  getChecklists().push(copy);
  state.checklistId = copy.id;
  saveData();
  setStatus("Duplicated checklist.", "ok");
  render();
}

function deleteChecklist() {
  const checklists = getChecklists();
  if (!checklists.length) {
    return;
  }
  const currentIndex = checklists.findIndex((checklist) => checklist.id === state.checklistId);
  if (currentIndex >= 0) {
    checklists.splice(currentIndex, 1);
  }
  state.checklistId = checklists[0] ? checklists[0].id : "";
  saveData();
  setStatus("Deleted checklist.", "warn");
  render();
}

function renameChecklist() {
  const current = getCurrentChecklist();
  const name = refs.checklistNameInput.value.trim();
  if (!current || !name) {
    setStatus("Checklist name cannot be empty.", "warn");
    return;
  }
  current.name = name;
  saveData();
  setStatus("Renamed checklist.", "ok");
  render();
}

function updateChecklistPhase() {
  const current = getCurrentChecklist();
  if (!current) {
    return;
  }

  current.phase = normalizeChecklistPhase(refs.checklistPhaseSelect.value) || getDefaultChecklistPhase(current.name);
  saveData();
  setStatus("Checklist category set to " + getChecklistPhaseLabel(current.phase) + ".", "ok");
  render();
}

function addSection() {
  const current = getCurrentChecklist();
  if (!current) {
    addChecklist();
    return;
  }
  current.sections.push({
    id: createId("sec"),
    title: "New section",
    items: [{ id: createId("item"), action: "", expected: "" }]
  });
  saveData();
  setStatus("Added section.", "ok");
  render();
}

function findSection(sectionId) {
  const current = getCurrentChecklist();
  return current ? current.sections.find((section) => section.id === sectionId) || null : null;
}

function handleSectionTitle(input) {
  const section = findSection(input.dataset.sectionTitle);
  if (!section) {
    return;
  }
  section.title = input.value;
  saveData();
  renderExport();
}

function handleItemInput(input, field) {
  const parts = String(input.dataset[field === "action" ? "itemAction" : "itemExpected"] || "").split("|");
  const section = findSection(parts[0]);
  const item = section ? section.items.find((candidate) => candidate.id === parts[1]) : null;
  if (!item) {
    return;
  }
  item[field] = input.value;
  saveData();
  renderExport();
}

refs.aircraftSelect.addEventListener("change", () => {
  state.aircraft = refs.aircraftSelect.value;
  state.checklistId = "";
  render();
});

refs.addAircraftBtn.addEventListener("click", addAircraftProfile);
refs.saveProfileBtn.addEventListener("click", applyProfileFields);
refs.profileScopeSelect.addEventListener("change", () => {
  refs.aircraftRegistrationInput.disabled = refs.profileScopeSelect.value !== "specific";
  if (refs.profileScopeSelect.value !== "specific") {
    refs.aircraftRegistrationInput.value = "";
  }
  renderExport();
});
[
  refs.aircraftTypeInput,
  refs.aircraftRegistrationInput,
  refs.basicFuelFlowSlLphInput,
  refs.displayNameInput,
  refs.engineCountSelect,
  refs.headwindLimitKtInput,
  refs.icaoTypeInput,
  refs.powerplantSelect,
  refs.tailwindLimitKtInput,
  refs.crosswindLimitKtInput
].forEach((input) => {
  input.addEventListener("input", renderExport);
  input.addEventListener("change", renderExport);
});

refs.checklistSelect.addEventListener("change", () => {
  state.checklistId = refs.checklistSelect.value;
  render();
});

refs.addChecklistBtn.addEventListener("click", addChecklist);
refs.addSectionBtn.addEventListener("click", addSection);
refs.duplicateChecklistBtn.addEventListener("click", duplicateChecklist);
refs.deleteChecklistBtn.addEventListener("click", deleteChecklist);
refs.renameChecklistBtn.addEventListener("click", renameChecklist);
refs.saveFileBtn.addEventListener("click", () => {
  if (!applyProfileFields({ silent: true })) {
    return;
  }
  void saveExportFile();
});
refs.downloadBtn.addEventListener("click", () => {
  if (!applyProfileFields({ silent: true })) {
    return;
  }
  saveData();
  renderExport();
  downloadExportFile();
  setStatus("Downloaded " + getAircraftDataFileName(getCurrentProfile()) + ".", "ok");
});
refs.copyBtn.addEventListener("click", async () => {
  if (!applyProfileFields({ silent: true })) {
    return;
  }
  await navigator.clipboard.writeText(refs.exportBox.value);
  setStatus("Export copied.", "ok");
});
refs.resetBtn.addEventListener("click", () => {
  state = getInitialState();
  saveData();
  setStatus("Local data reset.", "warn");
  render();
});

refs.checklistNameInput.addEventListener("change", renameChecklist);
refs.checklistPhaseSelect.addEventListener("change", updateChecklistPhase);
refs.sectionList.addEventListener("input", (event) => {
  const sectionTitle = event.target.closest("[data-section-title]");
  if (sectionTitle) {
    handleSectionTitle(sectionTitle);
    return;
  }
  const itemAction = event.target.closest("[data-item-action]");
  if (itemAction) {
    handleItemInput(itemAction, "action");
    return;
  }
  const itemExpected = event.target.closest("[data-item-expected]");
  if (itemExpected) {
    handleItemInput(itemExpected, "expected");
  }
});

refs.sectionList.addEventListener("click", (event) => {
  const addItem = event.target.closest("[data-add-item]");
  if (addItem) {
    const section = findSection(addItem.dataset.addItem);
    if (section) {
      section.items.push({ id: createId("item"), action: "", expected: "" });
      saveData();
      setStatus("Added item.", "ok");
      render();
    }
    return;
  }

  const deleteItem = event.target.closest("[data-delete-item]");
  if (deleteItem) {
    const parts = String(deleteItem.dataset.deleteItem || "").split("|");
    const section = findSection(parts[0]);
    if (section) {
      section.items = section.items.filter((item) => item.id !== parts[1]);
      saveData();
      setStatus("Deleted item.", "warn");
      render();
    }
    return;
  }

  const deleteSection = event.target.closest("[data-delete-section]");
  if (deleteSection) {
    const current = getCurrentChecklist();
    if (current) {
      current.sections = current.sections.filter((section) => section.id !== deleteSection.dataset.deleteSection);
      saveData();
      setStatus("Deleted section.", "warn");
      render();
    }
  }
});

render();

}
