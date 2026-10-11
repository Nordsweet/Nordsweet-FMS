// Standalone airport frequency panel. Include after airports.js:
// <script src="./airport-frequencies-data.js"></script>
// <script src="./airport-frequencies.js"></script>
(function (global) {
  "use strict";

  const documentRef = global.document;
  const STORAGE_KEY = "nordsweet.airportFrequencies.local.v1";
  const MODULE_VERSION = 1;

  const DEFAULT_CONFIG = {
    mountId: "airportFrequencyPanel",
    airportSelectId: "airport",
    autoMount: true,
    readUrl: "",
    writeUrl: "",
    token: "",
    sourceTag: "LOCAL",
    requestTimeoutMs: 4500
  };

  const SERVICES = [
    { id: "radio", label: "Radio", shortLabel: "RDO", order: 10 },
    { id: "informacja", label: "Informacja", shortLabel: "INFO", order: 20 },
    { id: "radar", label: "Radar", shortLabel: "RAD", order: 30 },
    { id: "zblizanie", label: "Zblizanie", shortLabel: "APP", order: 40 },
    { id: "tower", label: "Tower", shortLabel: "TWR", order: 50 },
    { id: "atis", label: "ATIS", shortLabel: "ATIS", order: 60 },
    { id: "ground", label: "Ground", shortLabel: "GND", order: 70 },
    { id: "delivery", label: "Delivery", shortLabel: "DEL", order: 80 },
    { id: "director", label: "Director", shortLabel: "DIR", order: 90 },
    { id: "fiss", label: "FIS / Flight Information", shortLabel: "FIS", order: 100 },
    { id: "meteo", label: "Meteo", shortLabel: "MET", order: 110 },
    { id: "ops", label: "Operations", shortLabel: "OPS", order: 120 },
    { id: "emergency", label: "Emergency", shortLabel: "EMERG", order: 130 },
    { id: "other", label: "Inna sluzba", shortLabel: "OTHER", order: 900 }
  ];

  const SERVICE_BY_ID = SERVICES.reduce((map, service) => {
    map[service.id] = service;
    return map;
  }, {});

  const SERVICE_ALIASES = {
    rdo: "radio",
    radio: "radio",
    info: "informacja",
    informacja: "informacja",
    information: "informacja",
    fis: "fiss",
    fiss: "fiss",
    radar: "radar",
    rad: "radar",
    approach: "zblizanie",
    app: "zblizanie",
    appr: "zblizanie",
    zblizanie: "zblizanie",
    tower: "tower",
    twr: "tower",
    wieza: "tower",
    atis: "atis",
    ground: "ground",
    gnd: "ground",
    delivery: "delivery",
    del: "delivery",
    director: "director",
    dir: "director",
    meteo: "meteo",
    met: "meteo",
    operations: "ops",
    operation: "ops",
    ops: "ops",
    emergency: "emergency",
    emerg: "emergency",
    emergencyfrequency: "emergency",
    other: "other",
    inna: "other"
  };

  const state = {
    config: Object.assign({}, DEFAULT_CONFIG, global.NORDSWEET_FREQUENCIES_CONFIG || {}),
    airports: [],
    entries: [],
    selectedAirportIcao: "",
    selectedServiceId: "all",
    query: "",
    remoteStatus: "idle",
    mount: null,
    refs: {}
  };

  function cleanValue(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalizeIcao(value) {
    return cleanValue(value)
      .toUpperCase()
      .replace(/\u0141/g, "L")
      .replace(/\u0143/g, "N")
      .replace(/\u015a/g, "S")
      .replace(/\u0179/g, "Z")
      .replace(/\u017b/g, "Z")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 16);
  }

  function normalizeServiceId(value) {
    const normalized = cleanValue(value).toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    const compact = normalized.replace(/[-_]/g, "");
    const alias = SERVICE_ALIASES[normalized] || SERVICE_ALIASES[compact];
    return SERVICE_BY_ID[alias || normalized] ? (alias || normalized) : "other";
  }

  function normalizePriority(value) {
    const normalized = cleanValue(value).toLowerCase();
    return normalized === "secondary" || normalized === "sec" || normalized === "alternate" ? "secondary" : "primary";
  }

  function comparePriority(a, b) {
    return (normalizePriority(a && a.priority) === "primary" ? 0 : 1) -
      (normalizePriority(b && b.priority) === "primary" ? 0 : 1);
  }

  function getService(serviceId) {
    return SERVICE_BY_ID[serviceId] || SERVICE_BY_ID.other;
  }

  function normalizeFrequencyMhz(value) {
    let raw = cleanValue(value).replace(/mhz/ig, "").replace(",", ".").replace(/\s+/g, "");
    if (/^\d{6}$/.test(raw)) {
      raw = raw.slice(0, 3) + "." + raw.slice(3);
    }
    if (/^\d{3}$/.test(raw)) {
      raw += ".000";
    }
    if (/^\d{3}\.\d{1,2}$/.test(raw)) {
      raw += "0".repeat(3 - raw.split(".")[1].length);
    }
    if (!/^\d{3}\.\d{3}$/.test(raw)) {
      return "";
    }
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric < 100 || numeric > 999.999) {
      return "";
    }
    return raw;
  }

  function parseFrequencyList(value) {
    const raw = cleanValue(value);
    const matches = raw.match(/\b\d{3}(?:[,.]\d{1,3})?\b|\b\d{6}\b/g) || [];
    return Array.from(new Set(matches.map(normalizeFrequencyMhz).filter(Boolean)));
  }

  function makeId(entry) {
    const parts = [
      entry.airportIcao,
      entry.serviceId,
      entry.frequencyMhz,
      entry.callsign,
      entry.sector,
      entry.createdAt || Date.now()
    ];
    return "freq-" + parts.join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function escapeHtml(value) {
    return cleanValue(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function uniqById(entries) {
    const merged = new Map();
    entries.forEach((entry) => {
      if (!entry || !entry.id) {
        return;
      }
      const previous = merged.get(entry.id);
      if (!previous || cleanValue(entry.updatedAt) >= cleanValue(previous.updatedAt)) {
        merged.set(entry.id, entry);
      }
    });
    return Array.from(merged.values());
  }

  function getAirportName(icao) {
    const airport = state.airports.find((item) => item.icao === icao);
    return airport ? airport.name : "";
  }

  function normalizeEntry(rawEntry, fallbackSource) {
    if (!rawEntry || typeof rawEntry !== "object") {
      return null;
    }
    const airportIcao = normalizeIcao(rawEntry.airportIcao || rawEntry.icao || rawEntry.airport);
    const frequencyMhz = normalizeFrequencyMhz(rawEntry.frequencyMhz || rawEntry.frequency || rawEntry.mhz);
    const serviceId = normalizeServiceId(rawEntry.serviceId || rawEntry.service || rawEntry.type);
    if (!airportIcao || !frequencyMhz) {
      return null;
    }
    const now = new Date().toISOString();
    const service = getService(serviceId);
    const entry = {
      id: cleanValue(rawEntry.id),
      airportIcao,
      airportName: cleanValue(rawEntry.airportName || rawEntry.name) || getAirportName(airportIcao),
      serviceId,
      serviceLabel: cleanValue(rawEntry.serviceLabel) || service.label,
      serviceShortLabel: cleanValue(rawEntry.serviceShortLabel) || service.shortLabel,
      frequencyMhz,
      callsign: cleanValue(rawEntry.callsign || rawEntry.station || rawEntry.name),
      sector: cleanValue(rawEntry.sector || rawEntry.area || rawEntry.usage),
      notes: cleanValue(rawEntry.notes || rawEntry.note || rawEntry.description),
      priority: normalizePriority(rawEntry.priority || rawEntry.priorityLevel || rawEntry.rank),
      source: cleanValue(rawEntry.source) || fallbackSource || state.config.sourceTag,
      isLocal: Boolean(rawEntry.isLocal),
      createdAt: cleanValue(rawEntry.createdAt) || now,
      updatedAt: cleanValue(rawEntry.updatedAt) || now
    };
    entry.id = entry.id || makeId(entry);
    return entry;
  }

  function compareEntries(a, b) {
    const airportCompare = a.airportIcao.localeCompare(b.airportIcao);
    if (airportCompare) {
      return airportCompare;
    }
    const orderCompare = getService(a.serviceId).order - getService(b.serviceId).order;
    if (orderCompare) {
      return orderCompare;
    }
    const priorityCompare = comparePriority(a, b);
    if (priorityCompare) {
      return priorityCompare;
    }
    const freqCompare = Number(a.frequencyMhz) - Number(b.frequencyMhz);
    if (freqCompare) {
      return freqCompare;
    }
    return cleanValue(a.callsign).localeCompare(cleanValue(b.callsign));
  }

  function getConfiguredAirports() {
    const tecnamAirports = global.TECNAM_DATA && Array.isArray(global.TECNAM_DATA.airports)
      ? global.TECNAM_DATA.airports
      : [];
    const nordsweetAirports = Array.isArray(global.NORDSWEET_AIRPORTS) ? global.NORDSWEET_AIRPORTS : [];
    return uniqByIcao(tecnamAirports.concat(nordsweetAirports, getStaticFrequencyDbAirports()));
  }

  function getStaticFrequencyDbAirports() {
    const source = global.NORDSWEET_FREQUENCIES;
    if (!source || typeof source !== "object") {
      return [];
    }
    const declaredAirports = Array.isArray(source.airports) ? source.airports : [];
    const entryAirports = (Array.isArray(source.entries) ? source.entries : [])
      .map((entry) => ({
        icao: entry && (entry.airportIcao || entry.icao || entry.airport),
        name: entry && (entry.airportName || entry.name)
      }));
    return declaredAirports.concat(entryAirports);
  }

  function uniqByIcao(airports) {
    const map = new Map();
    airports.forEach((airport) => {
      const icao = normalizeIcao(airport && airport.icao);
      if (!icao || map.has(icao)) {
        return;
      }
      map.set(icao, {
        icao,
        name: cleanValue(airport.name) || icao,
        atisFrequency: cleanValue(airport.atisFrequency),
        afterDepartureAppFrequency: cleanValue(airport.afterDepartureAppFrequency)
      });
    });
    return Array.from(map.values()).sort((a, b) => a.icao.localeCompare(b.icao));
  }

  function getStaticEntriesFromAirportData() {
    const result = [];
    state.airports.forEach((airport) => {
      if (airport.atisFrequency) {
        result.push(normalizeEntry({
          id: "seed-" + airport.icao.toLowerCase() + "-atis-" + airport.atisFrequency,
          airportIcao: airport.icao,
          airportName: airport.name,
          serviceId: "atis",
          frequencyMhz: airport.atisFrequency,
          callsign: airport.name + " ATIS",
          source: "AIRPORTS"
        }, "AIRPORTS"));
      }
      if (airport.afterDepartureAppFrequency) {
        result.push(normalizeEntry({
          id: "seed-" + airport.icao.toLowerCase() + "-app-" + airport.afterDepartureAppFrequency,
          airportIcao: airport.icao,
          airportName: airport.name,
          serviceId: "zblizanie",
          frequencyMhz: airport.afterDepartureAppFrequency,
          callsign: airport.name + " APP",
          source: "AIRPORTS"
        }, "AIRPORTS"));
      }
    });
    return result.filter(Boolean);
  }

  function getStaticFrequencyDbEntries() {
    const source = global.NORDSWEET_FREQUENCIES;
    if (!source) {
      return [];
    }
    const entries = Array.isArray(source)
      ? source
      : (Array.isArray(source.entries) ? source.entries : []);
    return entries.map((entry) => normalizeEntry(entry, "STATIC")).filter(Boolean);
  }

  function loadLocalEntries() {
    try {
      const payload = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || "[]");
      const entries = Array.isArray(payload) ? payload : (Array.isArray(payload.entries) ? payload.entries : []);
      return entries.map((entry) => normalizeEntry(Object.assign({}, entry, { isLocal: true }), "LOCAL")).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  function saveLocalEntries(entries) {
    try {
      const localEntries = entries
        .filter((entry) => entry && entry.isLocal)
        .map((entry) => Object.assign({}, entry, { source: "LOCAL" }));
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(localEntries));
      return true;
    } catch (error) {
      return false;
    }
  }

  function readRemoteEntries() {
    const readUrl = cleanValue(state.config.readUrl);
    if (!readUrl || typeof global.fetch !== "function") {
      return Promise.resolve([]);
    }
    state.remoteStatus = "loading";
    const controller = typeof global.AbortController === "function" ? new global.AbortController() : null;
    const timeout = controller
      ? global.setTimeout(() => controller.abort(), Number(state.config.requestTimeoutMs) || DEFAULT_CONFIG.requestTimeoutMs)
      : null;
    const headers = {};
    if (state.config.token) {
      headers.Authorization = "Bearer " + state.config.token;
    }
    return global.fetch(readUrl, {
      method: "GET",
      headers,
      signal: controller ? controller.signal : undefined
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Frequency database returned HTTP " + response.status + ".");
        }
        return response.json();
      })
      .then((payload) => {
        const entries = Array.isArray(payload)
          ? payload
          : (Array.isArray(payload.entries) ? payload.entries : []);
        state.remoteStatus = "ok";
        return entries.map((entry) => normalizeEntry(entry, "DB")).filter(Boolean);
      })
      .catch(() => {
        state.remoteStatus = "error";
        return [];
      })
      .finally(() => {
        if (timeout) {
          global.clearTimeout(timeout);
        }
      });
  }

  function writeRemoteEntries(entries) {
    const writeUrl = cleanValue(state.config.writeUrl);
    if (!writeUrl || typeof global.fetch !== "function") {
      return Promise.resolve(false);
    }
    const headers = {
      "Content-Type": "application/json"
    };
    if (state.config.token) {
      headers.Authorization = "Bearer " + state.config.token;
    }
    return global.fetch(writeUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        version: MODULE_VERSION,
        sourceTag: state.config.sourceTag,
        entries
      })
    }).then((response) => response.ok).catch(() => false);
  }

  function groupEntriesByService(entries) {
    const groups = new Map();
    entries.forEach((entry) => {
      const service = getService(entry.serviceId);
      if (!groups.has(service.id)) {
        groups.set(service.id, {
          service,
          entries: []
        });
      }
      groups.get(service.id).entries.push(entry);
    });
    return Array.from(groups.values())
      .sort((a, b) => a.service.order - b.service.order)
      .map((group) => {
        group.entries.sort(compareEntries);
        return group;
      });
  }

  function getVisibleEntries() {
    const query = state.query.toLowerCase();
    return state.entries.filter((entry) => {
      if (state.selectedAirportIcao && entry.airportIcao !== state.selectedAirportIcao) {
        return false;
      }
      if (state.selectedServiceId !== "all" && entry.serviceId !== state.selectedServiceId) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [
        entry.airportIcao,
        entry.airportName,
        entry.serviceLabel,
        entry.serviceShortLabel,
        entry.frequencyMhz,
        entry.callsign,
        entry.sector,
        entry.notes,
        entry.priority
      ].join(" ").toLowerCase().includes(query);
    });
  }

  function renderAirportOptions() {
    const airportSelect = state.refs.airportSelect;
    const formAirportSelect = state.refs.formAirportSelect;
    if (!airportSelect || !formAirportSelect) {
      return;
    }
    const options = state.airports.map((airport) => {
      const label = airport.icao + " - " + airport.name;
      return '<option value="' + escapeHtml(airport.icao) + '">' + escapeHtml(label) + "</option>";
    }).join("");
    airportSelect.innerHTML = options;
    formAirportSelect.innerHTML = options;
    airportSelect.value = state.selectedAirportIcao;
    formAirportSelect.value = state.selectedAirportIcao;
  }

  function renderServiceOptions() {
    const filterSelect = state.refs.serviceFilter;
    const formServiceSelect = state.refs.serviceSelect;
    if (!filterSelect || !formServiceSelect) {
      return;
    }
    filterSelect.innerHTML = '<option value="all">Wszystkie sluzby</option>' + SERVICES.map((service) => {
      return '<option value="' + escapeHtml(service.id) + '">' + escapeHtml(service.label) + "</option>";
    }).join("");
    formServiceSelect.innerHTML = SERVICES.map((service) => {
      return '<option value="' + escapeHtml(service.id) + '">' + escapeHtml(service.label) + "</option>";
    }).join("");
    filterSelect.value = state.selectedServiceId;
    formServiceSelect.value = "tower";
  }

  function renderStatus() {
    const status = state.refs.status;
    if (!status) {
      return;
    }
    const localCount = state.entries.filter((entry) => entry.isLocal).length;
    const remoteText = state.remoteStatus === "ok"
      ? "Baza online zaladowana."
      : (state.remoteStatus === "error" ? "Baza online niedostepna, uzywam danych lokalnych." : "Gotowe do podpiecia bazy online.");
    status.className = "nord-freq-status " + (state.remoteStatus === "error" ? "warn" : "info");
    status.textContent = remoteText + " Lokalnie zapisane wpisy: " + localCount + ".";
  }

  function renderSummary(entries) {
    const summary = state.refs.summary;
    if (!summary) {
      return;
    }
    const serviceCount = new Set(entries.map((entry) => entry.serviceId)).size;
    const airportCount = new Set(state.entries.map((entry) => entry.airportIcao)).size;
    const selectedAirport = state.airports.find((airport) => airport.icao === state.selectedAirportIcao);
    const airportLabel = selectedAirport ? selectedAirport.icao + " - " + selectedAirport.name : "brak lotniska";
    summary.innerHTML = [
      '<div><span>Lotnisko</span><strong>' + escapeHtml(airportLabel) + "</strong></div>",
      '<div><span>Widoczne</span><strong>' + entries.length + "</strong></div>",
      '<div><span>Sluzby</span><strong>' + serviceCount + "</strong></div>",
      '<div><span>Lotniska w bazie</span><strong>' + airportCount + "</strong></div>"
    ].join("");
  }

  function renderEntry(entry) {
    const localBadge = entry.isLocal ? '<span class="nord-freq-badge local">LOCAL</span>' : "";
    const priority = normalizePriority(entry.priority);
    const priorityBadge = '<span class="nord-freq-badge priority ' + priority + '">' + priority.toUpperCase() + "</span>";
    const sourceBadge = entry.source && !entry.isLocal
      ? '<span class="nord-freq-badge">' + escapeHtml(entry.source) + "</span>"
      : "";
    const meta = [entry.callsign, entry.sector, entry.notes].filter(Boolean).join(" / ");
    const deleteButton = entry.isLocal
      ? '<button type="button" class="nord-freq-icon-btn danger" data-freq-delete="' + escapeHtml(entry.id) + '" title="Usun lokalny wpis" aria-label="Usun lokalny wpis">x</button>'
      : "";
    return [
      '<div class="nord-freq-item">',
      '  <button type="button" class="nord-freq-copy" data-freq-copy="' + escapeHtml(entry.frequencyMhz) + '" title="Kopiuj czestotliwosc">',
      '    <span class="nord-freq-value">' + escapeHtml(entry.frequencyMhz) + '</span><span class="nord-freq-unit">MHz</span>',
      "  </button>",
      '  <div class="nord-freq-item-meta">',
      '    <strong>' + escapeHtml(entry.serviceShortLabel || entry.serviceLabel) + " " + escapeHtml(entry.airportIcao) + "</strong>",
      '    <span>' + escapeHtml(meta || entry.serviceLabel) + "</span>",
      '    <div class="nord-freq-badges">' + priorityBadge + localBadge + sourceBadge + "</div>",
      "  </div>",
      deleteButton,
      "</div>"
    ].join("");
  }

  function renderList() {
    const list = state.refs.list;
    if (!list) {
      return;
    }
    const visibleEntries = getVisibleEntries();
    renderSummary(visibleEntries);
    renderStatus();
    if (!visibleEntries.length) {
      list.innerHTML = [
        '<div class="nord-freq-empty">',
        "Brak czestotliwosci dla wybranego filtra. Dodaj pierwsza po prawej stronie albo podepnij endpoint bazy danych.",
        "</div>"
      ].join("");
      return;
    }
    list.innerHTML = groupEntriesByService(visibleEntries).map((group) => {
      return [
        '<section class="nord-freq-service">',
        '  <header class="nord-freq-service-head">',
        '    <div><span class="nord-freq-service-code">' + escapeHtml(group.service.shortLabel) + '</span><strong>' + escapeHtml(group.service.label) + "</strong></div>",
        '    <span>' + group.entries.length + " freq</span>",
        "  </header>",
        '  <div class="nord-freq-service-list">' + group.entries.map(renderEntry).join("") + "</div>",
        "</section>"
      ].join("");
    }).join("");
  }

  function setMessage(message, tone) {
    const messageBox = state.refs.formMessage;
    if (!messageBox) {
      return;
    }
    messageBox.className = "nord-freq-form-message " + (tone || "info");
    messageBox.textContent = message;
  }

  function selectAirport(icao) {
    const normalized = normalizeIcao(icao);
    const fallback = state.airports[0] ? state.airports[0].icao : "";
    state.selectedAirportIcao = state.airports.some((airport) => airport.icao === normalized) ? normalized : fallback;
    if (state.refs.airportSelect) {
      state.refs.airportSelect.value = state.selectedAirportIcao;
    }
    if (state.refs.formAirportSelect) {
      state.refs.formAirportSelect.value = state.selectedAirportIcao;
    }
    renderList();
  }

  function removeEntry(entryId) {
    state.entries = state.entries.filter((entry) => entry.id !== entryId);
    saveLocalEntries(state.entries);
    renderList();
    setMessage("Usunieto lokalna czestotliwosc.", "ok");
  }

  function copyFrequency(value) {
    const frequency = cleanValue(value);
    if (!frequency) {
      return;
    }
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      global.navigator.clipboard.writeText(frequency).then(() => {
        setMessage("Skopiowano " + frequency + " MHz.", "ok");
      }).catch(() => {
        setMessage("Czestotliwosc: " + frequency + " MHz.", "info");
      });
      return;
    }
    setMessage("Czestotliwosc: " + frequency + " MHz.", "info");
  }

  function addEntriesFromForm(event) {
    event.preventDefault();
    const airportIcao = normalizeIcao(state.refs.formAirportSelect.value);
    const serviceId = normalizeServiceId(state.refs.serviceSelect.value);
    const frequencies = parseFrequencyList(state.refs.frequencyInput.value);
    const callsign = cleanValue(state.refs.callsignInput.value);
    const sector = cleanValue(state.refs.sectorInput.value);
    const notes = cleanValue(state.refs.notesInput.value);
    if (!airportIcao) {
      setMessage("Wybierz lotnisko.", "warn");
      return;
    }
    if (!frequencies.length) {
      setMessage("Wpisz jedna lub kilka czestotliwosci, np. 121.075, 126.130.", "warn");
      return;
    }
    const now = new Date().toISOString();
    const service = getService(serviceId);
    const airportName = getAirportName(airportIcao);
    const newEntries = frequencies.map((frequencyMhz) => normalizeEntry({
      airportIcao,
      airportName,
      serviceId,
      serviceLabel: service.label,
      serviceShortLabel: service.shortLabel,
      frequencyMhz,
      callsign,
      sector,
      notes,
      source: "LOCAL",
      isLocal: true,
      createdAt: now,
      updatedAt: now
    }, "LOCAL")).filter(Boolean);
    state.entries = uniqById(state.entries.concat(newEntries)).sort(compareEntries);
    if (!saveLocalEntries(state.entries)) {
      setMessage("Przegladarka nie pozwolila zapisac lokalnej bazy.", "warn");
    } else {
      setMessage("Dodano " + newEntries.length + " czestotliwosc(i) dla " + airportIcao + ".", "ok");
    }
    writeRemoteEntries(newEntries).then((savedRemote) => {
      if (savedRemote) {
        setMessage("Dodano lokalnie i wyslano do bazy online.", "ok");
      }
    });
    state.refs.frequencyInput.value = "";
    state.refs.callsignInput.value = "";
    state.refs.sectorInput.value = "";
    state.refs.notesInput.value = "";
    selectAirport(airportIcao);
  }

  function addFrequency(rawEntry) {
    const now = new Date().toISOString();
    const entry = normalizeEntry(Object.assign({
      source: "LOCAL",
      isLocal: true,
      createdAt: now,
      updatedAt: now
    }, rawEntry), "LOCAL");
    if (!entry) {
      return null;
    }
    entry.isLocal = true;
    state.entries = uniqById(state.entries.concat(entry)).sort(compareEntries);
    saveLocalEntries(state.entries);
    writeRemoteEntries([entry]);
    renderList();
    return entry;
  }

  function createPanelMarkup() {
    return [
      '<div class="nord-freq-card">',
      '  <div class="nord-freq-head">',
      "    <div>",
      '      <p class="nord-freq-eyebrow">Airport frequencies</p>',
      "      <h2>Czestotliwosci lotniskowe</h2>",
      "    </div>",
      '    <button type="button" class="nord-freq-refresh" data-freq-refresh>Odswiez</button>',
      "  </div>",
      '  <div class="nord-freq-status info" data-freq-status>Gotowe do podpiecia bazy online.</div>',
      '  <div class="nord-freq-layout">',
      '    <div class="nord-freq-browser">',
      '      <div class="nord-freq-controls">',
      '        <label><span>Lotnisko</span><select data-freq-airport></select></label>',
      '        <label><span>Sluzba</span><select data-freq-service-filter></select></label>',
      '        <label><span>Szukaj</span><input data-freq-search type="search" placeholder="EPKK, Tower, 121.075"></label>',
      "      </div>",
      '      <div class="nord-freq-summary" data-freq-summary></div>',
      '      <div class="nord-freq-list" data-freq-list></div>',
      "    </div>",
      '    <form class="nord-freq-form" data-freq-form>',
      "      <h3>Dodaj czestotliwosc</h3>",
      '      <label><span>Lotnisko</span><select data-freq-form-airport></select></label>',
      '      <label><span>Sluzba</span><select data-freq-service></select></label>',
      '      <label><span>Czestotliwosc / wiele naraz</span><input data-freq-input inputmode="decimal" placeholder="np. 121.075, 126.130"></label>',
      '      <label><span>Callsign / nazwa</span><input data-freq-callsign placeholder="np. Krakow Tower"></label>',
      '      <label><span>Sektor / uzycie</span><input data-freq-sector placeholder="np. ARR, DEP, RWY 25"></label>',
      '      <label><span>Notatka</span><textarea data-freq-notes rows="3" placeholder="Opcjonalnie"></textarea></label>',
      '      <button type="submit">Dodaj do bazy</button>',
      '      <div class="nord-freq-form-message info" data-freq-form-message>Jedna sluzba moze miec kilka czestotliwosci.</div>',
      "    </form>",
      "  </div>",
      "</div>"
    ].join("");
  }

  function createPanelElement() {
    const section = documentRef.createElement("section");
    section.id = state.config.mountId;
    section.className = "nord-freq-panel";
    section.setAttribute("aria-label", "Airport frequencies");
    section.innerHTML = createPanelMarkup();
    return section;
  }

  function ensureStyle() {
    if (!documentRef || documentRef.getElementById("nordFreqStyle")) {
      return;
    }
    const style = documentRef.createElement("style");
    style.id = "nordFreqStyle";
    style.textContent = [
      ".nord-freq-panel{margin:1rem auto;max-width:1180px;color:var(--text,#eaf4ff);font-family:inherit}",
      ".nord-freq-card{border:1px solid rgba(141,190,255,.16);border-radius:8px;background:rgba(10,20,36,.82);box-shadow:0 18px 55px rgba(0,0,0,.25);padding:1rem}",
      ".nord-freq-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:.75rem}",
      ".nord-freq-head h2{margin:.1rem 0 0;font-size:1.35rem;letter-spacing:0}",
      ".nord-freq-eyebrow{margin:0;color:var(--muted,#9fb4d0);font-size:.78rem;text-transform:uppercase;letter-spacing:.08em}",
      ".nord-freq-refresh,.nord-freq-form button{width:auto;min-width:8rem;margin-top:0;border-radius:8px}",
      ".nord-freq-status,.nord-freq-form-message{min-height:2.25rem;padding:.65rem .75rem;border-radius:8px;border:1px solid rgba(93,193,255,.22);background:rgba(93,193,255,.08);color:var(--accent,#5dc1ff);font-size:.88rem}",
      ".nord-freq-status.warn,.nord-freq-form-message.warn{border-color:rgba(255,209,102,.26);background:rgba(255,209,102,.09);color:var(--warn,#ffd166)}",
      ".nord-freq-form-message.ok{border-color:rgba(118,242,164,.24);background:rgba(118,242,164,.09);color:var(--ok,#76f2a4)}",
      ".nord-freq-layout{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(18rem,.75fr);gap:1rem;margin-top:1rem}",
      ".nord-freq-controls{display:grid;grid-template-columns:minmax(10rem,.8fr) minmax(10rem,.7fr) minmax(12rem,1fr);gap:.75rem;align-items:end}",
      ".nord-freq-panel label{display:grid;gap:.35rem;color:var(--muted,#9fb4d0);font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em}",
      ".nord-freq-panel input,.nord-freq-panel select,.nord-freq-panel textarea{width:100%;box-sizing:border-box;border-radius:8px;border:1px solid rgba(141,190,255,.16);background:rgba(7,17,31,.72);color:inherit;padding:.72rem .76rem;font:inherit;letter-spacing:0}",
      ".nord-freq-panel textarea{resize:vertical}",
      ".nord-freq-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.6rem;margin:.85rem 0}",
      ".nord-freq-summary div{border:1px solid rgba(141,190,255,.12);border-radius:8px;background:rgba(255,255,255,.035);padding:.65rem}",
      ".nord-freq-summary span{display:block;color:var(--muted,#9fb4d0);font-size:.72rem;text-transform:uppercase;letter-spacing:.05em}",
      ".nord-freq-summary strong{display:block;margin-top:.15rem;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".nord-freq-list{display:grid;gap:.75rem}",
      ".nord-freq-service{border:1px solid rgba(141,190,255,.14);border-radius:8px;background:rgba(255,255,255,.03);overflow:hidden}",
      ".nord-freq-service-head{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.7rem .8rem;border-bottom:1px solid rgba(141,190,255,.1);background:rgba(255,255,255,.035)}",
      ".nord-freq-service-head div{display:flex;align-items:center;gap:.55rem;min-width:0}",
      ".nord-freq-service-head strong{font-size:.98rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".nord-freq-service-head span:last-child{color:var(--muted,#9fb4d0);font-size:.8rem}",
      ".nord-freq-service-code{display:inline-grid;place-items:center;min-width:3.1rem;height:1.8rem;border-radius:6px;background:rgba(93,193,255,.13);color:var(--accent,#5dc1ff);font-size:.74rem;font-weight:800}",
      ".nord-freq-service-list{display:grid;gap:.55rem;padding:.7rem}",
      ".nord-freq-item{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:.65rem;align-items:center;border-radius:8px;background:rgba(7,17,31,.5);padding:.55rem}",
      ".nord-freq-copy{width:auto;min-width:7rem;margin:0;padding:.55rem .65rem;border-radius:8px;text-align:left;line-height:1;background:rgba(93,193,255,.1);box-shadow:none}",
      ".nord-freq-value{display:block;font-size:1.06rem;font-weight:800;font-variant-numeric:tabular-nums}",
      ".nord-freq-unit{display:block;margin-top:.18rem;color:var(--muted,#9fb4d0);font-size:.68rem}",
      ".nord-freq-item-meta{min-width:0}",
      ".nord-freq-item-meta strong,.nord-freq-item-meta span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".nord-freq-item-meta strong{font-size:.88rem}",
      ".nord-freq-item-meta span{margin-top:.12rem;color:var(--muted,#9fb4d0);font-size:.8rem}",
      ".nord-freq-badges{display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.3rem}",
      ".nord-freq-badge{display:inline-flex;align-items:center;min-height:1.15rem;border-radius:6px;border:1px solid rgba(141,190,255,.14);padding:0 .36rem;color:var(--muted,#9fb4d0);font-size:.62rem;font-weight:800}",
      ".nord-freq-badge.local{color:var(--ok,#76f2a4);border-color:rgba(118,242,164,.2);background:rgba(118,242,164,.08)}",
      ".nord-freq-badge.priority.primary{color:var(--accent,#5dc1ff);border-color:rgba(93,193,255,.22);background:rgba(93,193,255,.08)}",
      ".nord-freq-badge.priority.secondary{color:var(--warn,#ffd166);border-color:rgba(255,209,102,.24);background:rgba(255,209,102,.08)}",
      ".nord-freq-icon-btn{width:2rem;min-width:2rem;height:2rem;min-height:2rem;margin:0;padding:0;border-radius:8px;box-shadow:none}",
      ".nord-freq-icon-btn.danger{color:var(--danger,#ff758f);background:rgba(255,117,143,.08);border-color:rgba(255,117,143,.22)}",
      ".nord-freq-form{display:grid;gap:.7rem;align-content:start;border:1px solid rgba(141,190,255,.14);border-radius:8px;background:rgba(255,255,255,.035);padding:.85rem}",
      ".nord-freq-form h3{margin:0;font-size:1rem;letter-spacing:0}",
      ".nord-freq-empty{border:1px dashed rgba(141,190,255,.2);border-radius:8px;padding:1rem;color:var(--muted,#9fb4d0);background:rgba(255,255,255,.025)}",
      "@media (max-width:920px){.nord-freq-layout,.nord-freq-controls,.nord-freq-summary{grid-template-columns:1fr}.nord-freq-head{flex-direction:column}.nord-freq-refresh{width:100%}.nord-freq-item{grid-template-columns:1fr}.nord-freq-copy,.nord-freq-icon-btn{width:100%}}"
    ].join("\n");
    documentRef.head.appendChild(style);
  }

  function bindEvents() {
    state.refs.airportSelect.addEventListener("change", () => {
      selectAirport(state.refs.airportSelect.value);
    });
    state.refs.serviceFilter.addEventListener("change", () => {
      state.selectedServiceId = state.refs.serviceFilter.value || "all";
      renderList();
    });
    state.refs.searchInput.addEventListener("input", () => {
      state.query = cleanValue(state.refs.searchInput.value);
      renderList();
    });
    state.refs.form.addEventListener("submit", addEntriesFromForm);
    state.refs.refreshButton.addEventListener("click", () => {
      reload().then(() => setMessage("Odswiezono czestotliwosci.", "ok"));
    });
    state.refs.list.addEventListener("click", (event) => {
      const copyButton = event.target.closest("[data-freq-copy]");
      if (copyButton) {
        copyFrequency(copyButton.getAttribute("data-freq-copy"));
        return;
      }
      const deleteButton = event.target.closest("[data-freq-delete]");
      if (deleteButton) {
        removeEntry(deleteButton.getAttribute("data-freq-delete"));
      }
    });
    const appAirportSelect = documentRef.getElementById(state.config.airportSelectId);
    if (appAirportSelect) {
      appAirportSelect.addEventListener("change", () => selectAirport(appAirportSelect.value));
    }
  }

  function wireRefs(mount) {
    state.refs = {
      airportSelect: mount.querySelector("[data-freq-airport]"),
      serviceFilter: mount.querySelector("[data-freq-service-filter]"),
      searchInput: mount.querySelector("[data-freq-search]"),
      summary: mount.querySelector("[data-freq-summary]"),
      list: mount.querySelector("[data-freq-list]"),
      status: mount.querySelector("[data-freq-status]"),
      form: mount.querySelector("[data-freq-form]"),
      formAirportSelect: mount.querySelector("[data-freq-form-airport]"),
      serviceSelect: mount.querySelector("[data-freq-service]"),
      frequencyInput: mount.querySelector("[data-freq-input]"),
      callsignInput: mount.querySelector("[data-freq-callsign]"),
      sectorInput: mount.querySelector("[data-freq-sector]"),
      notesInput: mount.querySelector("[data-freq-notes]"),
      formMessage: mount.querySelector("[data-freq-form-message]"),
      refreshButton: mount.querySelector("[data-freq-refresh]")
    };
  }

  function mount(target) {
    if (!documentRef) {
      return null;
    }
    ensureStyle();
    let mountElement = target || documentRef.getElementById(state.config.mountId);
    if (!mountElement) {
      mountElement = createPanelElement();
      const wxPanel = documentRef.getElementById("wxPanel");
      const plannerPanel = documentRef.querySelector(".planner-panel");
      if (wxPanel && wxPanel.parentNode) {
        wxPanel.parentNode.insertBefore(mountElement, wxPanel.nextSibling);
      } else if (plannerPanel && plannerPanel.parentNode) {
        plannerPanel.parentNode.insertBefore(mountElement, plannerPanel.nextSibling);
      } else {
        documentRef.body.appendChild(mountElement);
      }
    } else if (!mountElement.innerHTML.trim()) {
      mountElement.innerHTML = createPanelMarkup();
    }
    state.mount = mountElement;
    state.airports = getConfiguredAirports();
    const appAirportSelect = documentRef.getElementById(state.config.airportSelectId);
    state.selectedAirportIcao = normalizeIcao(appAirportSelect && appAirportSelect.value) || (state.airports[0] ? state.airports[0].icao : "");
    wireRefs(mountElement);
    renderAirportOptions();
    renderServiceOptions();
    bindEvents();
    return reload();
  }

  function reload() {
    state.airports = getConfiguredAirports();
    const seedEntries = getStaticEntriesFromAirportData();
    const staticEntries = getStaticFrequencyDbEntries();
    const localEntries = loadLocalEntries();
    return readRemoteEntries().then((remoteEntries) => {
      state.entries = uniqById(seedEntries.concat(staticEntries, remoteEntries, localEntries)).sort(compareEntries);
      renderAirportOptions();
      if (!state.selectedAirportIcao && state.airports[0]) {
        state.selectedAirportIcao = state.airports[0].icao;
      }
      selectAirport(state.selectedAirportIcao);
      return state.entries;
    });
  }

  function getFrequenciesForAirport(icao) {
    const airportIcao = normalizeIcao(icao);
    return state.entries.filter((entry) => entry.airportIcao === airportIcao).sort(compareEntries);
  }

  function exportLocal() {
    return {
      version: MODULE_VERSION,
      exportedAt: new Date().toISOString(),
      entries: loadLocalEntries()
    };
  }

  global.NordsweetFrequencies = {
    version: MODULE_VERSION,
    services: SERVICES.slice(),
    init: mount,
    mount,
    reload,
    addFrequency,
    getFrequencies: () => state.entries.slice(),
    getFrequenciesForAirport,
    exportLocal,
    parseFrequencyList
  };

  if (documentRef && state.config.autoMount) {
    if (documentRef.readyState === "loading") {
      documentRef.addEventListener("DOMContentLoaded", () => mount());
    } else {
      mount();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
