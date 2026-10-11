// @ts-nocheck -- legacy DOM engine; type it when this screen is migrated to React.
export async function start(loadScript) {
await loadScript("./airports.js");
await loadScript("./airport-frequencies-data.js?v=20260617-2");

    (function () {
      "use strict";

      const STORAGE_KEY = "nordsweet.frequencyEditorDraft.v1";
      const DB_CONFIG = Object.assign({
        readUrl: "",
        writeUrl: "",
        token: ""
      }, window.NORDSWEET_FREQUENCY_EDITOR_CONFIG || {});

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

      const state = {
        baseSource: clonePayload(window.NORDSWEET_FREQUENCIES || {}),
        data: { version: 1, generatedAt: "", source: "editor", airports: [], entries: [] },
        selectedAirport: "",
        selectedService: "all",
        airportQuery: "",
        entryQuery: "",
        sortMode: "service",
        editId: "",
        dirty: false
      };

      const refs = {
        sourceStatus: document.getElementById("sourceStatus"),
        draftStatus: document.getElementById("draftStatus"),
        dbStatus: document.getElementById("dbStatus"),
        loadDbBtn: document.getElementById("loadDbBtn"),
        saveDbBtn: document.getElementById("saveDbBtn"),
        exportJsonBtn: document.getElementById("exportJsonBtn"),
        exportJsBtn: document.getElementById("exportJsBtn"),
        airportCount: document.getElementById("airportCount"),
        entryCount: document.getElementById("entryCount"),
        primaryCount: document.getElementById("primaryCount"),
        secondaryCount: document.getElementById("secondaryCount"),
        visibleCount: document.getElementById("visibleCount"),
        selectedAirport: document.getElementById("selectedAirport"),
        airportSearch: document.getElementById("airportSearch"),
        entrySearch: document.getElementById("entrySearch"),
        serviceFilter: document.getElementById("serviceFilter"),
        sortMode: document.getElementById("sortMode"),
        serviceStrip: document.getElementById("serviceStrip"),
        airportList: document.getElementById("airportList"),
        frequencyGroups: document.getElementById("frequencyGroups"),
        allAirportsBtn: document.getElementById("allAirportsBtn"),
        clearLocalBtn: document.getElementById("clearLocalBtn"),
        frequencyForm: document.getElementById("frequencyForm"),
        airportCodeInput: document.getElementById("airportCodeInput"),
        airportNameInput: document.getElementById("airportNameInput"),
        airportCodeList: document.getElementById("airportCodeList"),
        frequencyRows: document.getElementById("frequencyRows"),
        addServiceRowBtn: document.getElementById("addServiceRowBtn"),
        submitBtn: document.getElementById("submitBtn"),
        clearFormBtn: document.getElementById("clearFormBtn"),
        cancelEditBtn: document.getElementById("cancelEditBtn"),
        editorTitle: document.getElementById("editorTitle"),
        formMessage: document.getElementById("formMessage")
      };

      function clean(value) {
        return String(value == null ? "" : value).trim();
      }

      function stripMarks(value) {
        return clean(value)
          .replace(/\u0141/g, "L")
          .replace(/\u0142/g, "l")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
      }

      function normalizeAirportCode(value) {
        return stripMarks(value).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
      }

      function normalizeFrequency(value) {
        let raw = clean(value).replace(/mhz/ig, "").replace(",", ".").replace(/\s+/g, "");
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
        if (!Number.isFinite(numeric) || numeric < 108 || numeric > 137) {
          return "";
        }
        return raw;
      }

      function normalizePriority(value) {
        const normalized = clean(value).toLowerCase();
        return normalized === "secondary" || normalized === "sec" || normalized === "alternate" ? "secondary" : "primary";
      }

      function priorityOrder(value) {
        return normalizePriority(value) === "primary" ? 0 : 1;
      }

      function parseFrequencyList(value) {
        const matches = clean(value).match(/\b\d{3}(?:[,.]\d{1,3})?\b|\b\d{6}\b/g) || [];
        return Array.from(new Set(matches.map(normalizeFrequency).filter(Boolean)));
      }

      function getService(id) {
        return SERVICE_BY_ID[id] || SERVICE_BY_ID.other;
      }

      function escapeHtml(value) {
        return clean(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

      function clonePayload(payload) {
        return JSON.parse(JSON.stringify(payload || {}));
      }

      function makeId(entry) {
        return ("freq-" + [
          entry.airportIcao,
          entry.serviceId,
          entry.frequencyMhz,
          entry.callsign || entry.airportName,
          Date.now().toString(36),
          Math.random().toString(36).slice(2, 7)
        ].join("-")).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      }

      function getAirportName(code) {
        const airport = state.data.airports.find((item) => item.icao === code);
        return airport ? airport.name : "";
      }

      function normalizeEntry(raw) {
        const airportIcao = normalizeAirportCode(raw.airportIcao || raw.icao || raw.airport);
        const serviceId = getService(clean(raw.serviceId || raw.service || "radio")).id;
        const frequencyMhz = normalizeFrequency(raw.frequencyMhz || raw.frequency || raw.mhz);
        if (!airportIcao || !frequencyMhz) {
          return null;
        }
        const service = getService(serviceId);
        const now = new Date().toISOString();
        const entry = {
          id: clean(raw.id),
          airportIcao,
          airportName: clean(raw.airportName || raw.name) || getAirportName(airportIcao) || airportIcao,
          serviceId,
          serviceLabel: service.label,
          serviceShortLabel: service.shortLabel,
          frequencyMhz,
          callsign: clean(raw.callsign || raw.station) || airportIcao + " " + service.shortLabel,
          sector: clean(raw.sector || raw.area),
          notes: clean(raw.notes || raw.note || raw.description),
          priority: normalizePriority(raw.priority || raw.priorityLevel || raw.rank),
          source: clean(raw.source) || "EDITOR",
          createdAt: clean(raw.createdAt) || now,
          updatedAt: clean(raw.updatedAt) || now
        };
        entry.id = entry.id || makeId(entry);
        return entry;
      }

      function compareEntries(a, b) {
        if (state.sortMode === "frequency") {
          return priorityOrder(a.priority) - priorityOrder(b.priority) ||
            Number(a.frequencyMhz) - Number(b.frequencyMhz) ||
            a.airportIcao.localeCompare(b.airportIcao) ||
            getService(a.serviceId).order - getService(b.serviceId).order;
        }
        if (state.sortMode === "airport") {
          return a.airportIcao.localeCompare(b.airportIcao) ||
            getService(a.serviceId).order - getService(b.serviceId).order ||
            priorityOrder(a.priority) - priorityOrder(b.priority) ||
            Number(a.frequencyMhz) - Number(b.frequencyMhz);
        }
        return getService(a.serviceId).order - getService(b.serviceId).order ||
          priorityOrder(a.priority) - priorityOrder(b.priority) ||
          Number(a.frequencyMhz) - Number(b.frequencyMhz) ||
          a.callsign.localeCompare(b.callsign);
      }

      function buildInitialData() {
        const base = clonePayload(state.baseSource);
        const tecnamAirports = window.TECNAM_DATA && Array.isArray(window.TECNAM_DATA.airports)
          ? window.TECNAM_DATA.airports.map((airport) => ({ icao: airport.icao, name: airport.name }))
          : [];
        const airports = mergeAirports((base.airports || []).concat(tecnamAirports));
        const entries = Array.isArray(base.entries) ? base.entries.map(normalizeEntry).filter(Boolean) : [];
        return {
          version: 1,
          generatedAt: base.generatedAt || new Date().toISOString(),
          source: base.source || "editor",
          airports,
          entries: dedupeEntries(entries)
        };
      }

      function mergeAirports(airports) {
        const map = new Map();
        (airports || []).forEach((airport) => {
          const icao = normalizeAirportCode(airport && airport.icao);
          if (!icao) {
            return;
          }
          const name = clean(airport.name) || icao;
          if (!map.has(icao) || map.get(icao).name === icao) {
            map.set(icao, { icao, name });
          }
        });
        return Array.from(map.values()).sort((a, b) => a.icao.localeCompare(b.icao));
      }

      function dedupeEntries(entries) {
        const map = new Map();
        entries.forEach((entry) => {
          if (!entry) {
            return;
          }
          map.set(entry.id || makeId(entry), Object.assign({}, entry, { id: entry.id || makeId(entry) }));
        });
        return Array.from(map.values()).sort(compareEntries);
      }

      function loadDraft() {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (!raw) {
            return null;
          }
          const parsed = JSON.parse(raw);
          if (!parsed || !Array.isArray(parsed.entries)) {
            return null;
          }
          parsed.airports = mergeAirports(parsed.airports || []);
          parsed.entries = dedupeEntries(parsed.entries.map(normalizeEntry).filter(Boolean));
          return parsed;
        } catch (error) {
          return null;
        }
      }

      function saveDraft() {
        const payload = getExportPayload();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        state.dirty = false;
        updateStatuses("Saved local", "ok");
      }

      function clearDraft() {
        window.localStorage.removeItem(STORAGE_KEY);
        state.data = buildInitialData();
        state.selectedAirport = "";
        state.selectedService = "all";
        state.dirty = false;
        clearForm();
        render();
        updateStatuses("Local reset", "warn");
      }

      function markDirty() {
        state.dirty = true;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(getExportPayload()));
        updateStatuses("Local draft", "warn");
      }

      function getExportPayload() {
        return {
          version: 1,
          generatedAt: new Date().toISOString(),
          source: state.data.source || "frequency-editor",
          airports: mergeAirports(state.data.airports),
          entries: dedupeEntries(state.data.entries)
        };
      }

      function updateStatuses(message, tone) {
        refs.sourceStatus.textContent = state.data.source ? "Source: " + state.data.source : "Source: editor";
        refs.sourceStatus.className = "status-pill ok";
        refs.draftStatus.textContent = message || (state.dirty ? "Unsaved local" : "Local ready");
        refs.draftStatus.className = "status-pill " + (tone || (state.dirty ? "warn" : "ok"));
        refs.dbStatus.textContent = DB_CONFIG.readUrl || DB_CONFIG.writeUrl ? "DB configured" : "DB offline";
        refs.dbStatus.className = "status-pill " + (DB_CONFIG.readUrl || DB_CONFIG.writeUrl ? "ok" : "warn");
        refs.loadDbBtn.disabled = !DB_CONFIG.readUrl;
        refs.saveDbBtn.disabled = !DB_CONFIG.writeUrl;
      }

      function setFormMessage(message, tone) {
        refs.formMessage.textContent = message;
        refs.formMessage.className = "message " + (tone || "");
      }

      function getAirportCounts() {
        return state.data.entries.reduce((map, entry) => {
          map[entry.airportIcao] = (map[entry.airportIcao] || 0) + 1;
          return map;
        }, {});
      }

      function getVisibleAirports() {
        const counts = getAirportCounts();
        const query = stripMarks(state.airportQuery).toLowerCase();
        return state.data.airports
          .filter((airport) => counts[airport.icao] || !query)
          .filter((airport) => {
            if (!query) {
              return true;
            }
            return (airport.icao + " " + stripMarks(airport.name)).toLowerCase().includes(query);
          })
          .sort((a, b) => (counts[b.icao] || 0) - (counts[a.icao] || 0) || a.icao.localeCompare(b.icao));
      }

      function getVisibleEntries() {
        const query = stripMarks(state.entryQuery).toLowerCase();
        return state.data.entries
          .filter((entry) => !state.selectedAirport || entry.airportIcao === state.selectedAirport)
          .filter((entry) => state.selectedService === "all" || entry.serviceId === state.selectedService)
          .filter((entry) => {
            if (!query) {
              return true;
            }
            return stripMarks([
              entry.airportIcao,
              entry.airportName,
              entry.serviceLabel,
              entry.serviceShortLabel,
              entry.frequencyMhz,
              entry.callsign,
              entry.sector,
              entry.notes,
              entry.priority
            ].join(" ")).toLowerCase().includes(query);
          })
          .sort(compareEntries);
      }

      function groupEntries(entries) {
        const groups = new Map();
        entries.forEach((entry) => {
          const key = state.sortMode === "airport" ? entry.airportIcao : entry.serviceId;
          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key).push(entry);
        });
        return Array.from(groups.entries()).map(([key, items]) => ({ key, items }));
      }

      function render() {
        renderServiceControls();
        renderAirportList();
        renderStats();
        renderGroups();
        renderAirportDatalist();
        updateStatuses();
      }

      function renderStats() {
        const visible = getVisibleEntries();
        const primaryCount = state.data.entries.filter((entry) => normalizePriority(entry.priority) === "primary").length;
        refs.airportCount.textContent = state.data.airports.length;
        refs.entryCount.textContent = state.data.entries.length;
        refs.primaryCount.textContent = primaryCount;
        refs.secondaryCount.textContent = state.data.entries.length - primaryCount;
        refs.visibleCount.textContent = visible.length;
        refs.selectedAirport.textContent = state.selectedAirport || "All";
      }

      function renderServiceControls() {
        const counts = state.data.entries.reduce((map, entry) => {
          map[entry.serviceId] = (map[entry.serviceId] || 0) + 1;
          return map;
        }, {});
        refs.serviceFilter.innerHTML = '<option value="all">Wszystkie</option>' + SERVICES.map((service) => {
          return '<option value="' + service.id + '">' + escapeHtml(service.label) + " (" + (counts[service.id] || 0) + ")</option>";
        }).join("");
        refs.serviceFilter.value = state.selectedService;
        refs.serviceStrip.innerHTML = [
          '<button type="button" class="service-chip' + (state.selectedService === "all" ? " active" : "") + '" data-service="all">All <span>' + state.data.entries.length + '</span></button>'
        ].concat(SERVICES.map((service) => {
          return '<button type="button" class="service-chip' + (state.selectedService === service.id ? " active" : "") + '" data-service="' + service.id + '">' +
            escapeHtml(service.shortLabel) + ' <span>' + (counts[service.id] || 0) + '</span></button>';
        })).join("");
      }

      function renderAirportList() {
        const counts = getAirportCounts();
        const airports = getVisibleAirports();
        if (!airports.length) {
          refs.airportList.innerHTML = '<div class="empty">No airports</div>';
          return;
        }
        refs.airportList.innerHTML = airports.map((airport) => {
          const count = counts[airport.icao] || 0;
          return '<button type="button" class="airport-btn' + (state.selectedAirport === airport.icao ? " active" : "") + '" data-airport="' + escapeHtml(airport.icao) + '">' +
            '<span><span class="airport-title">' + escapeHtml(airport.icao) + '</span><span class="airport-name">' + escapeHtml(airport.name) + '</span></span>' +
            '<span class="count-badge">' + count + '</span></button>';
        }).join("");
      }

      function renderAirportDatalist() {
        refs.airportCodeList.innerHTML = state.data.airports.map((airport) => {
          return '<option value="' + escapeHtml(airport.icao) + '">' + escapeHtml(airport.name) + '</option>';
        }).join("");
      }

      function renderGroups() {
        const entries = getVisibleEntries();
        if (!entries.length) {
          refs.frequencyGroups.innerHTML = '<div class="empty">No frequencies</div>';
          return;
        }
        refs.frequencyGroups.innerHTML = groupEntries(entries).map((group) => {
          const first = group.items[0];
          const groupTitle = state.sortMode === "airport"
            ? first.airportIcao + " - " + first.airportName
            : getService(group.key).label;
          const code = state.sortMode === "airport" ? first.airportIcao.slice(0, 4) : getService(group.key).shortLabel;
          return '<section class="service-group">' +
            '<header class="service-head"><div class="service-head-title"><span class="service-code">' + escapeHtml(code) + '</span><strong>' + escapeHtml(groupTitle) + '</strong></div><span class="count-badge">' + group.items.length + '</span></header>' +
            '<div class="entry-list">' + group.items.map(renderEntry).join("") + '</div></section>';
        }).join("");
      }

      function renderEntry(entry) {
        const service = getService(entry.serviceId);
        const priority = normalizePriority(entry.priority);
        const meta = [entry.airportIcao + " " + service.shortLabel, entry.callsign, entry.sector, entry.notes].filter(Boolean).join(" / ");
        return '<article class="entry-row" data-entry-id="' + escapeHtml(entry.id) + '">' +
          '<button type="button" class="freq-button" data-copy="' + escapeHtml(entry.frequencyMhz) + '">' + escapeHtml(entry.frequencyMhz) + '</button>' +
          '<div class="entry-meta"><div class="entry-title"><strong>' + escapeHtml(entry.airportName || entry.airportIcao) + '</strong><span class="priority-badge ' + priority + '">' + priority.toUpperCase() + '</span></div><span>' + escapeHtml(meta) + '</span></div>' +
          '<div class="entry-actions"><button type="button" class="small" data-edit="' + escapeHtml(entry.id) + '" title="Edit">E</button><button type="button" class="small danger" data-delete="' + escapeHtml(entry.id) + '" title="Delete">X</button></div>' +
          '</article>';
      }

      function createServiceRow(values) {
        const row = document.createElement("div");
        row.className = "frequency-row";
        row.innerHTML = '<div class="row-head">' +
          '<label>Sluzba<select data-field="serviceId">' + SERVICES.map((service) => '<option value="' + service.id + '">' + escapeHtml(service.label) + '</option>').join("") + '</select></label>' +
          '<label>Priorytet<select data-field="priority"><option value="primary">Primary</option><option value="secondary">Secondary</option></select></label>' +
          '<label>Czestotliwosci<input data-field="frequencies" inputmode="decimal" placeholder="121.075, 126.130"></label>' +
          '<button type="button" class="small danger" data-remove-row>X</button>' +
          '</div>' +
          '<div class="two-cols">' +
          '<label>Callsign<input data-field="callsign" placeholder="Krakow Tower"></label>' +
          '<label>Sektor / uzycie<input data-field="sector" placeholder="APP, DEP, RWY 25"></label>' +
          '</div>' +
          '<label>Notatka<textarea data-field="notes" rows="2"></textarea></label>';
        const data = Object.assign({ serviceId: "radio", priority: "primary", frequencies: "", callsign: "", sector: "", notes: "" }, values || {});
        row.querySelector('[data-field="serviceId"]').value = data.serviceId;
        row.querySelector('[data-field="priority"]').value = normalizePriority(data.priority);
        row.querySelector('[data-field="frequencies"]').value = data.frequencies;
        row.querySelector('[data-field="callsign"]').value = data.callsign;
        row.querySelector('[data-field="sector"]').value = data.sector;
        row.querySelector('[data-field="notes"]').value = data.notes;
        refs.frequencyRows.appendChild(row);
        updateRowRemoveState();
      }

      function updateRowRemoveState() {
        const rows = refs.frequencyRows.querySelectorAll(".frequency-row");
        rows.forEach((row) => {
          row.querySelector("[data-remove-row]").disabled = rows.length <= 1 || Boolean(state.editId);
        });
      }

      function getFormRows() {
        return Array.from(refs.frequencyRows.querySelectorAll(".frequency-row")).map((row) => ({
          serviceId: row.querySelector('[data-field="serviceId"]').value,
          priority: row.querySelector('[data-field="priority"]').value,
          frequencies: row.querySelector('[data-field="frequencies"]').value,
          callsign: row.querySelector('[data-field="callsign"]').value,
          sector: row.querySelector('[data-field="sector"]').value,
          notes: row.querySelector('[data-field="notes"]').value
        }));
      }

      function ensureAirport(code, name) {
        const airportIcao = normalizeAirportCode(code);
        const airportName = clean(name) || airportIcao;
        if (!airportIcao) {
          return "";
        }
        const existing = state.data.airports.find((airport) => airport.icao === airportIcao);
        if (existing) {
          existing.name = airportName || existing.name;
        } else {
          state.data.airports.push({ icao: airportIcao, name: airportName });
        }
        state.data.airports = mergeAirports(state.data.airports);
        return airportIcao;
      }

      function submitForm(event) {
        event.preventDefault();
        const airportIcao = ensureAirport(refs.airportCodeInput.value, refs.airportNameInput.value);
        if (!airportIcao) {
          setFormMessage("Podaj kod lotniska.", "warn");
          return;
        }
        const airportName = getAirportName(airportIcao) || airportIcao;
        const rows = getFormRows();
        const newEntries = [];
        rows.forEach((row) => {
          const frequencies = parseFrequencyList(row.frequencies);
          frequencies.forEach((frequencyMhz) => {
            const service = getService(row.serviceId);
            const base = state.editId
              ? state.data.entries.find((entry) => entry.id === state.editId) || {}
              : {};
            const entry = normalizeEntry(Object.assign({}, base, {
              id: state.editId || "",
              airportIcao,
              airportName,
              serviceId: service.id,
              serviceLabel: service.label,
              serviceShortLabel: service.shortLabel,
              frequencyMhz,
              callsign: clean(row.callsign) || airportIcao + " " + service.shortLabel,
              sector: row.sector,
              notes: row.notes,
              priority: normalizePriority(row.priority),
              source: "EDITOR",
              updatedAt: new Date().toISOString()
            }));
            if (entry) {
              newEntries.push(entry);
            }
          });
        });
        if (!newEntries.length) {
          setFormMessage("Wpisz przynajmniej jedna poprawna czestotliwosc.", "warn");
          return;
        }
        if (state.editId) {
          state.data.entries = state.data.entries.map((entry) => entry.id === state.editId ? newEntries[0] : entry);
          setFormMessage("Zmieniono wpis.", "ok");
        } else {
          state.data.entries = upsertEntries(state.data.entries, newEntries);
          setFormMessage("Dodano " + newEntries.length + " wpisow.", "ok");
        }
        state.selectedAirport = airportIcao;
        state.data.entries = dedupeEntries(state.data.entries);
        markDirty();
        clearForm({ keepAirport: true });
        render();
      }

      function upsertEntries(existing, additions) {
        const list = existing.slice();
        additions.forEach((entry) => {
          const sameIndex = list.findIndex((item) =>
            item.airportIcao === entry.airportIcao &&
            item.serviceId === entry.serviceId &&
            item.frequencyMhz === entry.frequencyMhz &&
            clean(item.callsign).toLowerCase() === clean(entry.callsign).toLowerCase()
          );
          if (sameIndex >= 0) {
            list[sameIndex] = Object.assign({}, list[sameIndex], entry, { id: list[sameIndex].id, updatedAt: new Date().toISOString() });
          } else {
            list.push(entry);
          }
        });
        return list;
      }

      function clearForm(options) {
        const keepAirport = options && options.keepAirport;
        const currentCode = refs.airportCodeInput.value;
        const currentName = refs.airportNameInput.value;
        state.editId = "";
        refs.editorTitle.textContent = "Dodaj czestotliwosci";
        refs.submitBtn.textContent = "Zapisz wpisy";
        refs.cancelEditBtn.classList.add("hidden");
        refs.addServiceRowBtn.disabled = false;
        refs.frequencyRows.innerHTML = "";
        if (!keepAirport) {
          refs.airportCodeInput.value = state.selectedAirport || "";
          refs.airportNameInput.value = getAirportName(refs.airportCodeInput.value);
        } else {
          refs.airportCodeInput.value = currentCode;
          refs.airportNameInput.value = currentName;
        }
        createServiceRow();
        updateRowRemoveState();
      }

      function editEntry(id) {
        const entry = state.data.entries.find((item) => item.id === id);
        if (!entry) {
          return;
        }
        state.editId = id;
        refs.editorTitle.textContent = "Edytuj wpis";
        refs.submitBtn.textContent = "Zapisz zmiany";
        refs.cancelEditBtn.classList.remove("hidden");
        refs.addServiceRowBtn.disabled = true;
        refs.airportCodeInput.value = entry.airportIcao;
        refs.airportNameInput.value = entry.airportName;
        refs.frequencyRows.innerHTML = "";
        createServiceRow({
          serviceId: entry.serviceId,
          priority: entry.priority,
          frequencies: entry.frequencyMhz,
          callsign: entry.callsign,
          sector: entry.sector,
          notes: entry.notes
        });
        setFormMessage("Editing " + entry.frequencyMhz + " MHz.", "");
      }

      function deleteEntry(id) {
        const entry = state.data.entries.find((item) => item.id === id);
        if (!entry) {
          return;
        }
        if (!window.confirm("Usunac " + entry.frequencyMhz + " MHz dla " + entry.airportIcao + "?")) {
          return;
        }
        state.data.entries = state.data.entries.filter((item) => item.id !== id);
        markDirty();
        render();
        setFormMessage("Usunieto wpis.", "ok");
      }

      function copyFrequency(value) {
        const text = clean(value);
        if (!text) {
          return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => setFormMessage("Skopiowano " + text + " MHz.", "ok"));
        } else {
          setFormMessage(text + " MHz", "");
        }
      }

      async function loadDb() {
        if (!DB_CONFIG.readUrl) {
          return;
        }
        const headers = {};
        if (DB_CONFIG.token) {
          headers.Authorization = "Bearer " + DB_CONFIG.token;
        }
        refs.loadDbBtn.disabled = true;
        try {
          const response = await fetch(DB_CONFIG.readUrl, { headers });
          if (!response.ok) {
            throw new Error("HTTP " + response.status);
          }
          const payload = await response.json();
          const entries = Array.isArray(payload) ? payload : (payload.entries || []);
          const airports = Array.isArray(payload.airports) ? payload.airports : [];
          state.data.airports = mergeAirports(state.data.airports.concat(airports, entries.map((entry) => ({
            icao: entry.airportIcao || entry.icao || entry.airport,
            name: entry.airportName || entry.name
          }))));
          state.data.entries = dedupeEntries(entries.map(normalizeEntry).filter(Boolean));
          state.data.source = "database";
          state.dirty = true;
          markDirty();
          render();
          setFormMessage("Zaladowano baze.", "ok");
        } catch (error) {
          setFormMessage("Nie udalo sie zaladowac DB: " + error.message, "warn");
        } finally {
          refs.loadDbBtn.disabled = !DB_CONFIG.readUrl;
        }
      }

      async function saveDb() {
        if (!DB_CONFIG.writeUrl) {
          return;
        }
        const headers = { "Content-Type": "application/json" };
        if (DB_CONFIG.token) {
          headers.Authorization = "Bearer " + DB_CONFIG.token;
        }
        refs.saveDbBtn.disabled = true;
        try {
          const response = await fetch(DB_CONFIG.writeUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(getExportPayload())
          });
          if (!response.ok) {
            throw new Error("HTTP " + response.status);
          }
          state.dirty = false;
          updateStatuses("Saved DB", "ok");
          setFormMessage("Wyslano do bazy.", "ok");
        } catch (error) {
          setFormMessage("Nie udalo sie zapisac DB: " + error.message, "warn");
        } finally {
          refs.saveDbBtn.disabled = !DB_CONFIG.writeUrl;
        }
      }

      function download(filename, content, type) {
        const blob = new Blob([content], { type: type || "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }

      function exportJson() {
        download("airport-frequencies-data.json", JSON.stringify(getExportPayload(), null, 2), "application/json");
      }

      function exportJs() {
        const json = JSON.stringify(getExportPayload(), null, 2);
        download("airport-frequencies-data.js", "// Edited in airport-frequencies-editor.html\nwindow.NORDSWEET_FREQUENCIES = " + json + ";\n", "text/javascript");
      }

      function syncAirportNameFromCode() {
        const code = normalizeAirportCode(refs.airportCodeInput.value);
        const airport = state.data.airports.find((item) => item.icao === code);
        if (airport && !refs.airportNameInput.value) {
          refs.airportNameInput.value = airport.name;
        }
      }

      function bindEvents() {
        refs.airportSearch.addEventListener("input", () => {
          state.airportQuery = refs.airportSearch.value;
          renderAirportList();
        });
        refs.entrySearch.addEventListener("input", () => {
          state.entryQuery = refs.entrySearch.value;
          renderStats();
          renderGroups();
        });
        refs.serviceFilter.addEventListener("change", () => {
          state.selectedService = refs.serviceFilter.value;
          render();
        });
        refs.sortMode.addEventListener("change", () => {
          state.sortMode = refs.sortMode.value;
          renderGroups();
        });
        refs.serviceStrip.addEventListener("click", (event) => {
          const button = event.target.closest("[data-service]");
          if (!button) {
            return;
          }
          state.selectedService = button.getAttribute("data-service");
          render();
        });
        refs.airportList.addEventListener("click", (event) => {
          const button = event.target.closest("[data-airport]");
          if (!button) {
            return;
          }
          state.selectedAirport = button.getAttribute("data-airport");
          refs.airportCodeInput.value = state.selectedAirport;
          refs.airportNameInput.value = getAirportName(state.selectedAirport);
          render();
        });
        refs.allAirportsBtn.addEventListener("click", () => {
          state.selectedAirport = "";
          render();
        });
        refs.clearLocalBtn.addEventListener("click", () => {
          if (window.confirm("Wyczysc lokalny draft i wroc do danych z pliku?")) {
            clearDraft();
          }
        });
        refs.addServiceRowBtn.addEventListener("click", () => createServiceRow());
        refs.frequencyRows.addEventListener("click", (event) => {
          const button = event.target.closest("[data-remove-row]");
          if (!button) {
            return;
          }
          button.closest(".frequency-row").remove();
          updateRowRemoveState();
        });
        refs.frequencyForm.addEventListener("submit", submitForm);
        refs.clearFormBtn.addEventListener("click", () => {
          clearForm();
          setFormMessage("Form cleared.", "");
        });
        refs.cancelEditBtn.addEventListener("click", () => {
          clearForm({ keepAirport: true });
          setFormMessage("Edit cancelled.", "");
        });
        refs.airportCodeInput.addEventListener("change", syncAirportNameFromCode);
        refs.frequencyGroups.addEventListener("click", (event) => {
          const copyButton = event.target.closest("[data-copy]");
          if (copyButton) {
            copyFrequency(copyButton.getAttribute("data-copy"));
            return;
          }
          const editButton = event.target.closest("[data-edit]");
          if (editButton) {
            editEntry(editButton.getAttribute("data-edit"));
            return;
          }
          const deleteButton = event.target.closest("[data-delete]");
          if (deleteButton) {
            deleteEntry(deleteButton.getAttribute("data-delete"));
          }
        });
        refs.loadDbBtn.addEventListener("click", loadDb);
        refs.saveDbBtn.addEventListener("click", saveDb);
        refs.exportJsonBtn.addEventListener("click", exportJson);
        refs.exportJsBtn.addEventListener("click", exportJs);
      }

      function init() {
        const draft = loadDraft();
        state.data = draft || buildInitialData();
        refs.serviceFilter.innerHTML = "";
        refs.sortMode.value = state.sortMode;
        bindEvents();
        clearForm();
        render();
        updateStatuses(draft ? "Draft loaded" : "File loaded", draft ? "warn" : "ok");
      }

      init();
    })();
  
}
