// @ts-nocheck -- legacy DOM engine; type it when this screen is migrated to React.
export async function start(loadScript) {
await loadScript("./airport-frequencies-data.js?v=20260617-2");
await loadScript("./airspace-api-config.js");
await loadScript("./airspace-data/Poland_Airspaces.js");
await loadScript("./airspace-data/Poland_Airspaces_TODAY.js");
await loadScript("./airspace-data/Poland_Airspaces_TOMORROW.js");
await loadScript("./airspace-data/AUP_today.js");
await loadScript("./airspace-data/AUP_tomorrow.js");
await loadScript("./airspace-tools.js");

    (function () {
      "use strict";

      const T = window.AirspaceTools;
      const refs = {
        sourceStatus: document.getElementById("sourceStatus"),
        aupStatus: document.getElementById("aupStatus"),
        editorStatus: document.getElementById("editorStatus"),
        zoneList: document.getElementById("zoneList"),
        zoneSearch: document.getElementById("zoneSearch"),
        typeFilter: document.getElementById("typeFilter"),
        mapCanvas: document.getElementById("mapCanvas"),
        mapHint: document.getElementById("mapHint"),
        mapCount: document.getElementById("mapCount"),
        aupMode: document.getElementById("aupMode"),
        basemapSelect: document.getElementById("basemapSelect"),
        basemapTemplate: document.getElementById("basemapTemplate"),
        basemapApiKey: document.getElementById("basemapApiKey"),
        basemapStatus: document.getElementById("basemapStatus"),
        saveBasemapBtn: document.getElementById("saveBasemapBtn"),
        resetEditorViewBtn: document.getElementById("resetEditorViewBtn"),
        fitZonesBtn: document.getElementById("fitZonesBtn"),
        zoneName: document.getElementById("zoneName"),
        zoneKind: document.getElementById("zoneKind"),
        zoneClass: document.getElementById("zoneClass"),
        zoneLower: document.getElementById("zoneLower"),
        zoneUpper: document.getElementById("zoneUpper"),
        zoneShape: document.getElementById("zoneShape"),
        polygonSection: document.getElementById("polygonSection"),
        polygonPoints: document.getElementById("polygonPoints"),
        circleSection: document.getElementById("circleSection"),
        circleLat: document.getElementById("circleLat"),
        circleLon: document.getElementById("circleLon"),
        circleRadius: document.getElementById("circleRadius"),
        freqSearch: document.getElementById("freqSearch"),
        reloadFrequenciesBtn: document.getElementById("reloadFrequenciesBtn"),
        freqSourceStatus: document.getElementById("freqSourceStatus"),
        freqSelect: document.getElementById("freqSelect"),
        addSelectedFreqBtn: document.getElementById("addSelectedFreqBtn"),
        freqResults: document.getElementById("freqResults"),
        freqPicked: document.getElementById("freqPicked"),
        openAirFile: document.getElementById("openAirFile"),
        pasteArea: document.getElementById("pasteArea")
      };

      const BASEMAPS = {
        chart: {
          id: "chart",
          label: "Lotniczy szkic",
          type: "chart",
          attribution: ""
        },
        osm: {
          id: "osm",
          label: "OpenStreetMap",
          type: "xyz",
          template: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          fallbackTemplates: [
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
            "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
            "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
            "api/tile/osm/{z}/{x}/{y}.png"
          ],
          referrerPolicy: "origin-when-cross-origin",
          minZoom: 3,
          maxZoom: 18,
          attribution: "(c) OpenStreetMap contributors"
        },
        openaip: {
          id: "openaip",
          label: "OpenAIP",
          type: "custom",
          storageKey: "nordsweet-basemap-openaip-template",
          apiKeyStorageKey: "nordsweet-basemap-openaip-key",
          attribution: "OpenAIP"
        },
        skyvector: {
          id: "skyvector",
          label: "SkyVector",
          type: "custom",
          storageKey: "nordsweet-basemap-skyvector-template",
          attribution: "SkyVector"
        },
        google_roadmap: {
          id: "google_roadmap",
          label: "Google Maps",
          type: "google",
          mapType: "roadmap",
          minZoom: 0,
          maxZoom: 22,
          attribution: "(c) Google"
        },
        google_satellite: {
          id: "google_satellite",
          label: "Google Satellite",
          type: "google",
          mapType: "satellite",
          minZoom: 0,
          maxZoom: 22,
          attribution: "(c) Google"
        }
      };

      const state = {
        zones: [],
        selectedId: "",
        currentAup: null,
        nextAup: null,
        currentDayFilter: null,
        nextDayFilter: null,
        sourceLabel: "",
        frequencyAssignments: new Map(),
        bounds: Object.assign({}, T.DEFAULT_BOUNDS),
        viewport: null,
        tileCache: new Map(),
        googleSessions: {},
        renderQueued: false
      };

      function selectedZone() {
        return state.zones.find((zone) => zone.id === state.selectedId) || null;
      }

      function setStatus(text, tone) {
        refs.sourceStatus.textContent = text;
        refs.sourceStatus.style.color = tone === "bad" ? "#a81731" : "";
      }

      function setAupStatus(text, tone) {
        refs.aupStatus.textContent = text;
        refs.aupStatus.style.color = tone === "bad" ? "#a81731" : "";
      }

      function activeAup() {
        if (refs.aupMode.value === "next") return state.nextAup;
        if (refs.aupMode.value === "current") return state.currentAup;
        return null;
      }

      function activeAupLabel() {
        if (refs.aupMode.value === "next") return "AUP jutro";
        if (refs.aupMode.value === "current") return "AUP dzisiaj";
        return "Bez AUP";
      }

      function aupSummaryText() {
        const today = state.currentAup ? state.currentAup.rows.length + " wpisow" : "brak";
        const tomorrow = state.nextAup ? state.nextAup.rows.length + " wpisow" : "brak";
        const todayFilter = state.currentDayFilter ? state.currentDayFilter.count + " stref" : "brak";
        const tomorrowFilter = state.nextDayFilter ? state.nextDayFilter.count + " stref" : "brak";
        return "AUP dzisiaj: " + today + " / AUP jutro: " + tomorrow + " / filtr dzisiaj: " + todayFilter + " / filtr jutro: " + tomorrowFilter;
      }

      function renderAupSummary() {
        setAupStatus(aupSummaryText() + " / aktywny: " + activeAupLabel() + ".", "");
      }

      function fillSelects() {
        refs.zoneKind.innerHTML = T.AIRSPACE_TYPES.map((type) => "<option value=\"" + type + "\">" + type + "</option>").join("");
        refs.typeFilter.innerHTML = "<option value=\"\">Wszystkie</option>" +
          T.AIRSPACE_TYPES.map((type) => "<option value=\"" + type + "\">" + type + "</option>").join("");
      }

      function normalizeImportedFrequency(row, zoneIndex, freqIndex) {
        if (!row || typeof row !== "object") {
          return null;
        }
        const fallbackId = ["freq", zoneIndex, freqIndex, row.airportIcao, row.serviceId, row.frequencyMhz]
          .map((part) => T.searchKey(part))
          .filter(Boolean)
          .join("-") || ("freq-" + zoneIndex + "-" + freqIndex);
        return Object.assign({}, row, {
          id: row.id || fallbackId
        });
      }

      function hashText(text) {
        let hash = 2166136261;
        String(text || "").split("").forEach((char) => {
          hash ^= char.charCodeAt(0);
          hash = Math.imul(hash, 16777619);
        });
        return (hash >>> 0).toString(36);
      }

      function pointKey(point) {
        if (!point) return "";
        const lat = Number(point.lat);
        const lon = Number(point.lon);
        return Number.isFinite(lat) && Number.isFinite(lon)
          ? lat.toFixed(4) + "," + lon.toFixed(4)
          : "";
      }

      function zoneGeometryKey(zone) {
        if (!zone) return "";
        if (zone.shape === "circle" && zone.circle && zone.circle.center) {
          return ["C", pointKey(zone.circle.center), (Number(zone.circle.radiusNm) || 0).toFixed(2)].join("|");
        }
        const points = Array.isArray(zone.points) ? zone.points.map(pointKey).filter(Boolean) : [];
        return points.length ? "P|" + points.length + "|" + hashText(points.join(";")) : "";
      }

      function computedZoneAssignmentKey(zone) {
        return [
          T.searchKey(zone && zone.kind),
          T.searchKey(zone && zone.classType),
          T.searchKey(zone && (zone.name || zone.designator)),
          T.searchKey(zone && zone.lower),
          T.searchKey(zone && zone.upper),
          zoneGeometryKey(zone)
        ].filter(Boolean).join("|");
      }

      function zoneAssignmentKey(zone) {
        return String(zone && zone.assignmentKey || computedZoneAssignmentKey(zone) || T.searchKey(zone && zone.id) || "");
      }

      function syncFrequencyAssignmentForZone(zone) {
        if (!zone) return;
        const previousKey = zone.assignmentKey || "";
        const key = computedZoneAssignmentKey(zone);
        zone.assignmentKey = key;
        if (previousKey && previousKey !== key) {
          state.frequencyAssignments.delete(previousKey);
        }
        const rows = Array.isArray(zone.frequencies) ? zone.frequencies : [];
        if (key && rows.length) {
          state.frequencyAssignments.set(key, rows.map((row) => Object.assign({}, row)));
        } else if (key) {
          state.frequencyAssignments.delete(key);
        }
      }

      function setFrequencyAssignmentsFromZones(zones) {
        const assignments = new Map();
        let assigned = 0;
        (Array.isArray(zones) ? zones : []).forEach((zone, zoneIndex) => {
          const rows = Array.isArray(zone && zone.frequencies)
            ? zone.frequencies.map((row, freqIndex) => normalizeImportedFrequency(row, zoneIndex, freqIndex)).filter(Boolean)
            : [];
          if (!rows.length) {
            return;
          }
          assigned += rows.length;
          const key = zoneAssignmentKey(zone);
          if (key && !assignments.has(key)) {
            assignments.set(key, rows);
          }
        });
        state.frequencyAssignments = assignments;
        return assigned;
      }

      function assignedFrequenciesForZone(zone) {
        const rows = state.frequencyAssignments.get(zoneAssignmentKey(zone));
        if (rows && rows.length) {
          return rows.map((row) => Object.assign({}, row));
        }
        return null;
      }

      function applyFrequencyAssignments() {
        let matchedZones = 0;
        let assigned = 0;
        state.zones.forEach((zone) => {
          const rows = assignedFrequenciesForZone(zone);
          if (!rows) {
            return;
          }
          zone.frequencies = rows;
          matchedZones += 1;
          assigned += rows.length;
        });
        return { matchedZones, assigned };
      }

      function dayFilterFromZones(zones, label) {
        const assignmentKeys = new Set();
        const names = new Set();
        (Array.isArray(zones) ? zones : []).forEach((zone) => {
          const key = computedZoneAssignmentKey(zone);
          if (key) assignmentKeys.add(key);
          const name = T.searchKey(zone && zone.name);
          if (name) names.add(name);
        });
        return {
          label: label || "",
          count: Array.isArray(zones) ? zones.length : 0,
          assignmentKeys,
          names
        };
      }

      function activeDayFilter() {
        if (refs.aupMode.value === "next") return state.nextDayFilter;
        if (refs.aupMode.value === "current") return state.currentDayFilter;
        return null;
      }

      function zoneInDayFilter(zone, filter) {
        if (!filter) {
          return true;
        }
        const key = computedZoneAssignmentKey(zone);
        const name = T.searchKey(zone && zone.name);
        return (key && filter.assignmentKeys.has(key)) || (name && filter.names.has(name));
      }

      function loadZones(zones, label) {
        state.zones = zones.map((zone, index) => {
          const importedFrequencies = Array.isArray(zone.frequencies)
            ? zone.frequencies.map((row, freqIndex) => normalizeImportedFrequency(row, index, freqIndex)).filter(Boolean)
            : [];
          const normalizedZone = Object.assign({ frequencies: [] }, zone, {
            id: zone.id || "zone-" + Date.now() + "-" + index,
            frequencies: importedFrequencies
          });
          normalizedZone.assignmentKey = zone.assignmentKey || computedZoneAssignmentKey(normalizedZone);
          const assignedRows = assignedFrequenciesForZone(normalizedZone);
          if (assignedRows) {
            normalizedZone.frequencies = assignedRows;
          }
          return normalizedZone;
        });
        state.sourceLabel = label || "";
        state.selectedId = state.zones[0] ? state.zones[0].id : "";
        renderAll();
        const applied = state.zones.reduce((sum, zone) => sum + (zone.frequencies || []).length, 0);
        setStatus("Wczytano " + state.zones.length + " stref z " + label + (applied ? " / " + applied + " przypisanych czestotliwosci." : "."), "");
      }

      function zonesFromJsonPayload(payload) {
        if (Array.isArray(payload)) {
          return payload;
        }
        if (payload && Array.isArray(payload.zones)) {
          return payload.zones;
        }
        if (payload && Array.isArray(payload.airspaces)) {
          return payload.airspaces;
        }
        throw new Error("JSON nie zawiera tablicy zones.");
      }

      function importAirspacesJson(text, label) {
        const payload = JSON.parse(text);
        const zones = zonesFromJsonPayload(payload);
        const stored = setFrequencyAssignmentsFromZones(zones);
        const applied = applyFrequencyAssignments();
        renderAll();
        setStatus("Wczytano przypisania czestotliwosci z " + label + ": " + stored + " zapisanych / " + applied.assigned + " nalozonych na aktualne strefy.", "");
      }

      function importAirspaceText(text, label) {
        const raw = String(text || "");
        const trimmed = raw.trim();
        const jsonLike = /\.json$/i.test(label || "") || /^[\[{]/.test(trimmed);
        if (jsonLike) {
          try {
            importAirspacesJson(trimmed, label || "airspaces.json");
            return;
          } catch (error) {
            throw new Error("Nie udalo sie wczytac JSON: " + error.message);
          }
        }
        loadZones(T.parseOpenAir(raw, label), label);
      }

      async function tryLoadAirspacesJsonUrl(url, label) {
        try {
          const response = await fetch(url + "?v=" + Date.now(), { cache: "no-store" });
          if (!response.ok) {
            return false;
          }
          importAirspacesJson(await response.text(), label);
          return true;
        } catch (error) {
          return false;
        }
      }

      async function loadDayFilterApi(key, mode, label) {
        try {
          const result = await T.fetchConfiguredSource(key);
          const zones = T.parseOpenAir(result.text, label + " (" + result.source + ")");
          state[mode] = dayFilterFromZones(zones, label + " / " + result.source);
          renderAll();
          renderAupSummary();
          return state[mode];
        } catch (error) {
          setAupStatus("Nie udalo sie wczytac filtra " + label + ": " + error.message, "bad");
          return null;
        }
      }

      async function loadInitialZones() {
        setStatus("Wczytywanie airspaces.json jako przypisan czestotliwosci...", "");
        await tryLoadAirspacesJsonUrl("airspaces.json", "airspaces.json");
        await loadOpenAirApi("all", "Poland_Airspaces API");
        loadDayFilterApi("today", "currentDayFilter", "TODAY API");
        loadDayFilterApi("tomorrow", "nextDayFilter", "TOMORROW API");
      }

      async function loadOpenAirApi(key, label) {
        setStatus("Wczytywanie " + label + "...", "");
        try {
          const result = await T.fetchConfiguredSource(key);
          loadZones(T.parseOpenAir(result.text, label + " (" + result.source + ")"), label + " / " + result.source);
        } catch (error) {
          setStatus("Nie udalo sie wczytac " + label + ": " + error.message, "bad");
        }
      }

      async function loadAupApi(key, mode, label) {
        setAupStatus("Wczytywanie " + label + "...", "");
        try {
          const result = await T.fetchConfiguredSource(key);
          state[mode] = T.parsePansaAup(result.text, label + " (" + result.source + ")");
          renderAll();
          renderAupSummary();
          return state[mode];
        } catch (error) {
          setAupStatus("Nie udalo sie wczytac " + label + ": " + error.message, "bad");
          return null;
        }
      }

      function filteredZones() {
        const query = T.searchKey(refs.zoneSearch.value);
        const type = refs.typeFilter.value;
        const dayFilter = activeDayFilter();
        return state.zones.filter((zone) => {
          const haystack = T.searchKey([zone.name, zone.kind, zone.classType, zone.lower, zone.upper].join(" "));
          return zoneInDayFilter(zone, dayFilter) && (!query || haystack.includes(query)) && (!type || zone.kind === type);
        });
      }

      function renderList() {
        const activeSet = T.aupDesignatorSet(activeAup());
        refs.zoneList.innerHTML = filteredZones().map((zone) => {
          const active = T.zoneMatchesAup(zone, activeSet);
          const count = zone.shape === "circle"
            ? ((zone.circle && zone.circle.radiusNm) || 0) + " NM"
            : (zone.points || []).length + " pkt";
          return (
            "<button class=\"zone-item" + (zone.id === state.selectedId ? " active" : "") + "\" data-zone-id=\"" + zone.id + "\" type=\"button\">" +
              "<span class=\"zone-title\"><span>" + escapeHtml(zone.name || zone.designator || "Bez nazwy") + "</span><span class=\"badge" + (active ? " hot" : "") + "\">" + escapeHtml(zone.kind || "OTHER") + "</span></span>" +
              "<span class=\"zone-meta\">" + escapeHtml([zone.lower || "GND", zone.upper || "", zone.shape, count].filter(Boolean).join(" / ")) + "</span>" +
            "</button>"
          );
        }).join("");
      }

      function resizeCanvas() {
        const canvas = refs.mapCanvas;
        const rect = canvas.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        const width = Math.max(360, Math.floor(rect.width));
        const height = Math.max(360, Math.floor(rect.height));
        if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
          canvas.width = Math.floor(width * ratio);
          canvas.height = Math.floor(height * ratio);
        }
        const ctx = canvas.getContext("2d");
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        return { ctx, width, height };
      }

      function renderMap() {
        const canvasState = resizeCanvas();
        const ctx = canvasState.ctx;
        const viewport = T.createViewport(state.bounds, canvasState.width, canvasState.height, 26);
        state.viewport = viewport;
        const activeSet = T.aupDesignatorSet(activeAup());
        const basemap = selectedBasemap();
        T.drawBaseMap(ctx, viewport);
        drawBasemap(ctx, viewport);
        T.drawAirspaces(ctx, viewport, filteredZones(), {
          activeSet,
          labels: basemap.type === "chart",
          fill: basemap.type === "chart"
        });

        const zone = selectedZone();
        if (zone) {
          ctx.save();
          if (T.drawZonePath(ctx, viewport, zone)) {
            ctx.strokeStyle = "#111827";
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 5]);
            ctx.stroke();
          }
          const points = zone.shape === "circle" && zone.circle ? [zone.circle.center] : (zone.points || []);
          points.filter(Boolean).forEach((point) => {
            const p = viewport.project(point);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = "#111827";
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#fff";
            ctx.stroke();
          });
          ctx.restore();
        }
        const visibleCount = filteredZones().length;
        refs.mapCount.textContent = visibleCount === state.zones.length
          ? state.zones.length + " stref"
          : visibleCount + "/" + state.zones.length + " stref";
        drawBasemapAttribution(ctx, viewport);
      }

      function selectedBasemap() {
        return BASEMAPS[refs.basemapSelect.value] || BASEMAPS.chart;
      }

      function loadBasemapUi() {
        refs.basemapSelect.value = localStorage.getItem("nordsweet-basemap") || "chart";
        updateBasemapControls();
      }

      function updateBasemapControls() {
        const provider = selectedBasemap();
        const needsTemplate = provider.type === "custom";
        const needsApiKey = provider.type === "google" || Boolean(provider.apiKeyStorageKey);
        refs.basemapTemplate.hidden = !needsTemplate;
        refs.basemapApiKey.hidden = !needsApiKey;
        refs.saveBasemapBtn.hidden = !needsTemplate && !needsApiKey;
        refs.basemapTemplate.value = needsTemplate ? (localStorage.getItem(provider.storageKey) || "") : "";
        refs.basemapApiKey.value = needsApiKey ? getProviderApiKey(provider) : "";
        refs.basemapStatus.textContent = getBasemapStatus(provider);
      }

      function saveBasemapSettings() {
        const provider = selectedBasemap();
        localStorage.setItem("nordsweet-basemap", provider.id);
        if (provider.type === "custom") {
          localStorage.setItem(provider.storageKey, refs.basemapTemplate.value.trim());
        }
        if (provider.type === "google") {
          localStorage.setItem("nordsweet-basemap-google-key", refs.basemapApiKey.value.trim());
          state.googleSessions = {};
        } else if (provider.apiKeyStorageKey) {
          localStorage.setItem(provider.apiKeyStorageKey, refs.basemapApiKey.value.trim());
        }
        state.tileCache.clear();
        updateBasemapControls();
        renderMap();
      }

      function changeBasemap() {
        const provider = selectedBasemap();
        localStorage.setItem("nordsweet-basemap", provider.id);
        state.tileCache.clear();
        if (provider.type !== "google") {
          state.googleSessions = {};
        }
        updateBasemapControls();
        renderMap();
      }

      function resetEditorView() {
        state.bounds = Object.assign({}, T.DEFAULT_BOUNDS);
        renderMap();
      }

      function fitZonesView() {
        state.bounds = T.boundsFromZones(state.zones, T.DEFAULT_BOUNDS);
        renderMap();
      }

      function zoomAt(point, factor) {
        const b = state.bounds;
        state.bounds = {
          minLat: point.lat - (point.lat - b.minLat) / factor,
          maxLat: point.lat + (b.maxLat - point.lat) / factor,
          minLon: point.lon - (point.lon - b.minLon) / factor,
          maxLon: point.lon + (b.maxLon - point.lon) / factor
        };
        renderMap();
      }

      function getProviderApiKey(provider) {
        if (provider.type === "google") {
          return localStorage.getItem("nordsweet-basemap-google-key") || "";
        }
        return provider.apiKeyStorageKey ? (localStorage.getItem(provider.apiKeyStorageKey) || "") : "";
      }

      function getBasemapStatus(provider) {
        if (provider.type === "chart") return "offline";
        if (provider.id === "osm") return "XYZ";
        if (provider.type === "google") return getProviderApiKey(provider) ? "Map Tiles API" : "API key";
        if (provider.type === "custom") return localStorage.getItem(provider.storageKey) ? "XYZ" : "URL";
        return "";
      }

      function scheduleRender() {
        if (state.renderQueued) return;
        state.renderQueued = true;
        requestAnimationFrame(() => {
          state.renderQueued = false;
          renderMap();
        });
      }

      function lonToTileX(lon, zoom) {
        return ((Number(lon) + 180) / 360) * Math.pow(2, zoom);
      }

      function latToTileY(lat, zoom) {
        const clamped = Math.max(-85.05112878, Math.min(85.05112878, Number(lat) || 0));
        const rad = clamped * Math.PI / 180;
        return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * Math.pow(2, zoom);
      }

      function tileXToLon(x, zoom) {
        return x / Math.pow(2, zoom) * 360 - 180;
      }

      function tileYToLat(y, zoom) {
        const n = Math.PI - 2 * Math.PI * y / Math.pow(2, zoom);
        return Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))) * 180 / Math.PI;
      }

      function tileZoom(viewport, provider) {
        const spanLon = Math.max(0.01, viewport.bounds.maxLon - viewport.bounds.minLon);
        const raw = Math.log2((viewport.width - 56) * 360 / (256 * spanLon));
        const minZoom = Number.isFinite(provider.minZoom) ? provider.minZoom : 0;
        const maxZoom = Number.isFinite(provider.maxZoom) ? provider.maxZoom : 18;
        return Math.max(minZoom, Math.min(maxZoom, Math.round(raw)));
      }

      function drawBasemap(ctx, viewport) {
        const provider = selectedBasemap();
        if (provider.type === "chart") {
          return;
        }
        const zoom = tileZoom(viewport, provider);
        if (provider.type === "google" && !getProviderApiKey(provider)) {
          return;
        }
        if (provider.type === "custom" && !localStorage.getItem(provider.storageKey)) {
          return;
        }
        const n = Math.pow(2, zoom);
        const x0 = Math.floor(lonToTileX(viewport.bounds.minLon, zoom)) - 1;
        const x1 = Math.floor(lonToTileX(viewport.bounds.maxLon, zoom)) + 1;
        const y0 = Math.max(0, Math.floor(latToTileY(viewport.bounds.maxLat, zoom)) - 1);
        const y1 = Math.min(n - 1, Math.floor(latToTileY(viewport.bounds.minLat, zoom)) + 1);
        for (let x = x0; x <= x1; x += 1) {
          const wrappedX = ((x % n) + n) % n;
          for (let y = y0; y <= y1; y += 1) {
            drawTile(ctx, viewport, provider, zoom, wrappedX, y);
          }
        }
      }

      function drawTile(ctx, viewport, provider, zoom, x, y) {
        const urls = basemapTileUrls(provider, zoom, x, y);
        if (!urls.length) return;
        const cacheKey = provider.id + "|" + zoom + "|" + x + "|" + y;
        const signature = urls.join("|");
        let entry = state.tileCache.get(cacheKey);
        if (!entry || entry.signature !== signature) {
          entry = { image: null, urls, index: 0, failed: false, signature };
          state.tileCache.set(cacheKey, entry);
          trimTileCache();
          loadTileImage(entry, provider);
        }
        const image = entry.image;
        if (entry.failed || !image || !image.complete || !image.naturalWidth) {
          return;
        }
        const topLeft = viewport.project({ lat: tileYToLat(y, zoom), lon: tileXToLon(x, zoom) });
        const bottomRight = viewport.project({ lat: tileYToLat(y + 1, zoom), lon: tileXToLon(x + 1, zoom) });
        ctx.drawImage(image, topLeft.x, topLeft.y, bottomRight.x - topLeft.x + 1, bottomRight.y - topLeft.y + 1);
      }

      function loadTileImage(entry, provider) {
        const image = new Image();
        if (provider.crossOrigin) {
          image.crossOrigin = provider.crossOrigin;
        }
        if (provider.referrerPolicy) {
          image.referrerPolicy = provider.referrerPolicy;
        }
        image.onload = () => {
          refs.basemapStatus.textContent = getBasemapStatus(provider);
          scheduleRender();
        };
        image.onerror = () => {
          entry.index += 1;
          if (entry.index < entry.urls.length) {
            loadTileImage(entry, provider);
            return;
          }
          entry.failed = true;
          refs.basemapStatus.textContent = "tile error";
          scheduleRender();
        };
        entry.image = image;
        image.src = entry.urls[entry.index];
      }

      function trimTileCache() {
        if (state.tileCache.size <= 600) return;
        const keys = Array.from(state.tileCache.keys()).slice(0, state.tileCache.size - 520);
        keys.forEach((key) => state.tileCache.delete(key));
      }

      function basemapTileUrls(provider, zoom, x, y) {
        if (provider.type === "xyz") {
          return [provider.template].concat(provider.fallbackTemplates || [])
            .map((template) => fillTileTemplate(template, provider, zoom, x, y))
            .filter(Boolean);
        }
        if (provider.type === "custom") {
          const template = localStorage.getItem(provider.storageKey) || "";
          return [fillTileTemplate(template, provider, zoom, x, y)].filter(Boolean);
        }
        if (provider.type === "google") {
          return [googleTileUrl(provider, zoom, x, y)].filter(Boolean);
        }
        return [];
      }

      function fillTileTemplate(template, provider, zoom, x, y) {
        if (!template) return "";
        const apiKey = getProviderApiKey(provider);
        const subdomains = ["a", "b", "c"];
        const subdomain = subdomains[Math.abs(x + y) % subdomains.length];
        return template
          .replace(/\{z\}/g, zoom)
          .replace(/\{x\}/g, x)
          .replace(/\{y\}/g, y)
          .replace(/\{s\}/g, subdomain)
          .replace(/\{r\}/g, window.devicePixelRatio > 1 ? "@2x" : "")
          .replace(/\{apiKey\}/g, encodeURIComponent(apiKey));
      }

      function googleTileUrl(provider, zoom, x, y) {
        const apiKey = getProviderApiKey(provider);
        if (!apiKey) return "";
        const session = getGoogleSession(provider, apiKey);
        if (!session) return "";
        return "https://tile.googleapis.com/v1/2dtiles/" + zoom + "/" + x + "/" + y +
          "?session=" + encodeURIComponent(session) + "&key=" + encodeURIComponent(apiKey);
      }

      function getGoogleSession(provider, apiKey) {
        const cacheKey = provider.mapType + "|" + apiKey;
        const cached = state.googleSessions[cacheKey];
        if (cached && cached.session) {
          return cached.session;
        }
        if (!cached || !cached.pending) {
          state.googleSessions[cacheKey] = { pending: true, session: "" };
          fetch("https://tile.googleapis.com/v1/createSession?key=" + encodeURIComponent(apiKey), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mapType: provider.mapType,
              language: "pl-PL",
              region: "PL"
            })
          })
            .then((response) => response.ok ? response.json() : Promise.reject(new Error(response.status + " " + response.statusText)))
            .then((data) => {
              state.googleSessions[cacheKey] = { pending: false, session: data.session || "" };
              refs.basemapStatus.textContent = data.session ? "Map Tiles API" : "session error";
              scheduleRender();
            })
            .catch((error) => {
              state.googleSessions[cacheKey] = { pending: false, session: "" };
              refs.basemapStatus.textContent = error.message || "session error";
            });
        }
        return "";
      }

      function drawBasemapAttribution(ctx, viewport) {
        const provider = selectedBasemap();
        if (!provider.attribution || provider.type === "chart") {
          return;
        }
        ctx.save();
        ctx.font = "11px system-ui, sans-serif";
        const text = provider.attribution;
        const width = ctx.measureText(text).width + 12;
        const x = viewport.width - width - 10;
        const y = 12;
        ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
        ctx.fillRect(x, y, width, 20);
        ctx.strokeStyle = "rgba(24, 34, 48, 0.16)";
        ctx.strokeRect(x, y, width, 20);
        ctx.fillStyle = "#344154";
        ctx.fillText(text, x + 6, y + 14);
        ctx.restore();
      }

      function renderForm() {
        const zone = selectedZone();
        const disabled = !zone;
        [refs.zoneName, refs.zoneKind, refs.zoneClass, refs.zoneLower, refs.zoneUpper, refs.zoneShape, refs.polygonPoints, refs.circleLat, refs.circleLon, refs.circleRadius, refs.freqSearch, refs.freqSelect, refs.addSelectedFreqBtn].forEach((input) => {
          input.disabled = disabled;
        });
        document.getElementById("duplicateBtn").disabled = disabled;
        document.getElementById("deleteBtn").disabled = disabled;
        document.getElementById("reversePointsBtn").disabled = disabled || zone.shape !== "polygon";
        if (!zone) {
          refs.editorStatus.textContent = "Wybierz strefe z listy albo dodaj nowa.";
          renderFrequencyPicker();
          return;
        }
        refs.zoneName.value = zone.name || "";
        refs.zoneKind.value = zone.kind || "OTHER";
        refs.zoneClass.value = zone.classType || "G";
        refs.zoneLower.value = zone.lower || "GND";
        refs.zoneUpper.value = zone.upper || "FL95";
        refs.zoneShape.value = zone.shape || "polygon";
        refs.polygonSection.hidden = refs.zoneShape.value !== "polygon";
        refs.circleSection.hidden = refs.zoneShape.value !== "circle";
        refs.polygonPoints.value = (zone.points || []).map(T.formatOpenAirCoord).join("\n");
        const center = zone.circle && zone.circle.center ? zone.circle.center : { lat: "", lon: "" };
        refs.circleLat.value = center.lat === "" ? "" : Number(center.lat).toFixed(6);
        refs.circleLon.value = center.lon === "" ? "" : Number(center.lon).toFixed(6);
        refs.circleRadius.value = zone.circle && Number.isFinite(Number(zone.circle.radiusNm)) ? zone.circle.radiusNm : "";
        refs.editorStatus.textContent = (zone.designator || "Strefa") + " / " + zone.kind + " / " + zone.shape;
        renderFrequencyPicker();
      }

      function updateFrequencySourceStatus() {
        const info = T.getFrequencySourceInfo ? T.getFrequencySourceInfo() : {
          source: "airport-frequencies-data.js",
          count: T.getFrequencyRows().length,
          isDraft: false
        };
        refs.freqSourceStatus.textContent = info.source + " / " + info.count + " wpisow" + (info.isDraft ? " / lokalny draft" : "");
      }

      function renderFrequencyPicker() {
        updateFrequencySourceStatus();
        const zone = selectedZone();
        if (!zone) {
          refs.freqSelect.innerHTML = "<option value=\"\">Wybierz strefe</option>";
          refs.addSelectedFreqBtn.disabled = true;
          refs.freqResults.innerHTML = "";
          refs.freqPicked.innerHTML = "";
          return;
        }
        const pickedIds = new Set((zone.frequencies || []).map((row) => row.id));
        refs.freqPicked.innerHTML = (zone.frequencies || []).map((row) => (
          "<div class=\"freq-chip\"><span>" + escapeHtml(formatFreq(row)) + "</span><button type=\"button\" data-remove-freq=\"" + escapeHtml(row.id) + "\">x</button></div>"
        )).join("") || "<div class=\"status\">Brak przypisanych czestotliwosci.</div>";

        const query = T.searchKey(refs.freqSearch.value);
        const rows = T.getFrequencyRows().filter((row) => {
          const text = frequencySearchText(row);
          return (!query || text.includes(query)) && !pickedIds.has(row.id);
        });
        renderFrequencySelect(rows);
        refs.freqResults.innerHTML = rows.slice(0, 70).map((row) => (
          "<div class=\"freq-row\"><span>" + escapeHtml(formatFreq(row)) + "</span><button type=\"button\" data-add-freq=\"" + escapeHtml(row.id) + "\">Dodaj</button></div>"
        )).join("") || "<div class=\"status\">Brak wynikow.</div>";
      }

      function renderFrequencySelect(rows) {
        const options = rows.slice(0, 500);
        refs.freqSelect.disabled = !selectedZone() || !options.length;
        refs.addSelectedFreqBtn.disabled = !selectedZone() || !options.length;
        refs.freqSelect.innerHTML = options.length
          ? "<option value=\"\">Wybierz czestotliwosc (" + rows.length + ")</option>" + options.map((row) => (
            "<option value=\"" + escapeHtml(row.id) + "\">" + escapeHtml(formatFreq(row)) + "</option>"
          )).join("")
          : "<option value=\"\">Brak pasujacych czestotliwosci</option>";
      }

      function frequencySearchText(row) {
        return T.searchKey([
          row.airportIcao,
          row.airportName,
          row.serviceId,
          row.serviceLabel,
          row.serviceShortLabel,
          row.callsign,
          row.frequencyMhz,
          row.sector,
          row.notes
        ].join(" "));
      }

      function formatFreq(row) {
        return [row.airportIcao, row.serviceShortLabel || row.serviceLabel, row.callsign, row.frequencyMhz, row.sector].filter(Boolean).join(" / ");
      }

      function addFrequencyById(rowId) {
        const zone = selectedZone();
        if (!zone || !rowId) return;
        const row = T.getFrequencyRows().find((candidate) => candidate.id === rowId);
        if (row && !(zone.frequencies || []).some((candidate) => candidate.id === row.id)) {
          zone.frequencies = (zone.frequencies || []).concat(row);
          syncFrequencyAssignmentForZone(zone);
          renderAll();
        }
      }

      function exportZones() {
        return state.zones.map((zone) => Object.assign({}, zone, {
          assignmentKey: computedZoneAssignmentKey(zone),
          frequencies: Array.isArray(zone.frequencies) ? zone.frequencies : []
        }));
      }

      function renderAll() {
        renderList();
        renderForm();
        renderMap();
      }

      function updateZoneFromForm() {
        const zone = selectedZone();
        if (!zone) return;
        zone.name = refs.zoneName.value.trim();
        zone.designator = T.getDesignator(zone.name);
        zone.kind = refs.zoneKind.value;
        zone.classType = refs.zoneClass.value.trim() || zone.kind || "G";
        zone.lower = refs.zoneLower.value.trim();
        zone.upper = refs.zoneUpper.value.trim();
        zone.shape = refs.zoneShape.value;
        if (zone.shape === "polygon") {
          zone.points = refs.polygonPoints.value.split(/\r?\n/)
            .map(T.parseCoordPair)
            .filter(Boolean);
        } else {
          zone.circle = {
            center: {
              lat: Number(refs.circleLat.value),
              lon: Number(refs.circleLon.value)
            },
            radiusNm: Number(refs.circleRadius.value)
          };
        }
        if ((zone.frequencies || []).length) {
          syncFrequencyAssignmentForZone(zone);
        }
        renderAll();
      }

      function addZone(shape) {
        const center = { lat: 52.0, lon: 19.0 };
        const zone = {
          id: "custom-" + Date.now(),
          name: shape === "circle" ? "NOWA STREFA CIRCLE" : "NOWA STREFA POLYGON",
          designator: "NOWA",
          classType: "G",
          kind: "ATZ",
          lower: "GND",
          upper: "FL95",
          shape,
          points: shape === "polygon" ? [
            { lat: 52.00, lon: 19.00 },
            { lat: 52.12, lon: 19.10 },
            { lat: 51.98, lon: 19.22 }
          ] : [],
          circle: shape === "circle" ? { center, radiusNm: 5 } : null,
          frequencies: [],
          source: "editor"
        };
        state.zones.unshift(zone);
        state.selectedId = zone.id;
        renderAll();
      }

      function duplicateZone() {
        const zone = selectedZone();
        if (!zone) return;
        const copy = JSON.parse(JSON.stringify(zone));
        copy.id = "copy-" + Date.now();
        copy.name = copy.name + " COPY";
        state.zones.unshift(copy);
        state.selectedId = copy.id;
        renderAll();
      }

      function deleteZone() {
        const zone = selectedZone();
        if (!zone) return;
        state.zones = state.zones.filter((candidate) => candidate.id !== zone.id);
        state.selectedId = state.zones[0] ? state.zones[0].id : "";
        renderAll();
      }

      function escapeHtml(value) {
        return String(value == null ? "" : value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }

      function readFile(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }

      document.querySelectorAll("[data-api-source]").forEach((button) => {
        button.addEventListener("click", () => loadOpenAirApi(button.dataset.apiSource, button.dataset.label || button.dataset.apiSource));
      });
      document.querySelectorAll("[data-day-filter]").forEach((button) => {
        button.addEventListener("click", () => {
          refs.aupMode.value = button.dataset.dayFilter || "";
          renderAll();
          renderAupSummary();
        });
      });
      document.querySelectorAll("[data-api-aup]").forEach((button) => {
        button.addEventListener("click", () => loadAupApi(
          button.dataset.apiAup,
          button.dataset.apiAupMode || (button.dataset.apiAup === "aup_tomorrow" ? "nextAup" : "currentAup"),
          button.dataset.label || button.dataset.apiAup
        ));
      });
      refs.aupMode.addEventListener("change", () => {
        renderAll();
        renderAupSummary();
      });
      refs.basemapSelect.addEventListener("change", changeBasemap);
      refs.saveBasemapBtn.addEventListener("click", saveBasemapSettings);
      refs.basemapTemplate.addEventListener("keydown", (event) => {
        if (event.key === "Enter") saveBasemapSettings();
      });
      refs.basemapApiKey.addEventListener("keydown", (event) => {
        if (event.key === "Enter") saveBasemapSettings();
      });
      refs.resetEditorViewBtn.addEventListener("click", resetEditorView);
      refs.fitZonesBtn.addEventListener("click", fitZonesView);

      refs.openAirFile.addEventListener("change", async () => {
        const file = refs.openAirFile.files && refs.openAirFile.files[0];
        if (!file) return;
        try {
          const text = await readFile(file);
          importAirspaceText(text, file.name);
        } catch (error) {
          setStatus(error.message, "bad");
        }
      });

      document.getElementById("importPasteOpenAirBtn").addEventListener("click", () => {
        try {
          importAirspaceText(refs.pasteArea.value, "paste");
        } catch (error) {
          setStatus(error.message, "bad");
        }
      });
      document.getElementById("importPasteAupBtn").addEventListener("click", () => {
        const mode = refs.aupMode.value === "next" ? "nextAup" : "currentAup";
        state[mode] = T.parsePansaAup(refs.pasteArea.value, "paste AUP");
        renderAll();
        renderAupSummary();
      });

      refs.zoneList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-zone-id]");
        if (!button) return;
        state.selectedId = button.dataset.zoneId;
        renderAll();
      });

      [refs.zoneSearch, refs.typeFilter].forEach((input) => input.addEventListener("input", renderList));
      [refs.zoneName, refs.zoneKind, refs.zoneClass, refs.zoneLower, refs.zoneUpper, refs.zoneShape].forEach((input) => {
        input.addEventListener("input", updateZoneFromForm);
        input.addEventListener("change", updateZoneFromForm);
      });
      [refs.polygonPoints, refs.circleLat, refs.circleLon, refs.circleRadius].forEach((input) => {
        input.addEventListener("change", updateZoneFromForm);
      });

      refs.freqSearch.addEventListener("input", renderFrequencyPicker);
      refs.reloadFrequenciesBtn.addEventListener("click", () => {
        if (T.reloadFrequencyEditorDraft) {
          T.reloadFrequencyEditorDraft();
        }
        renderFrequencyPicker();
      });
      refs.addSelectedFreqBtn.addEventListener("click", () => {
        addFrequencyById(refs.freqSelect.value);
      });
      refs.freqSelect.addEventListener("keydown", (event) => {
        if (event.key === "Enter") addFrequencyById(refs.freqSelect.value);
      });
      refs.freqResults.addEventListener("click", (event) => {
        const button = event.target.closest("[data-add-freq]");
        if (!button) return;
        addFrequencyById(button.dataset.addFreq);
      });
      refs.freqPicked.addEventListener("click", (event) => {
        const button = event.target.closest("[data-remove-freq]");
        const zone = selectedZone();
        if (!button || !zone) return;
        zone.frequencies = (zone.frequencies || []).filter((row) => row.id !== button.dataset.removeFreq);
        syncFrequencyAssignmentForZone(zone);
        renderAll();
      });

      refs.mapCanvas.addEventListener("wheel", (event) => {
        event.preventDefault();
        if (!state.viewport) return;
        const rect = refs.mapCanvas.getBoundingClientRect();
        const point = state.viewport.unproject(event.clientX - rect.left, event.clientY - rect.top);
        zoomAt(point, event.deltaY < 0 ? 1.22 : 0.82);
      }, { passive: false });

      refs.mapCanvas.addEventListener("click", (event) => {
        const zone = selectedZone();
        if (!zone || !state.viewport) return;
        const rect = refs.mapCanvas.getBoundingClientRect();
        const point = state.viewport.unproject(event.clientX - rect.left, event.clientY - rect.top);
        if (zone.shape === "circle") {
          zone.circle = zone.circle || { center: point, radiusNm: 5 };
          zone.circle.center = point;
        } else {
          zone.points = (zone.points || []).concat(point);
        }
        renderAll();
      });

      document.getElementById("newPolygonBtn").addEventListener("click", () => addZone("polygon"));
      document.getElementById("newCircleBtn").addEventListener("click", () => addZone("circle"));
      document.getElementById("duplicateBtn").addEventListener("click", duplicateZone);
      document.getElementById("deleteBtn").addEventListener("click", deleteZone);
      document.getElementById("reversePointsBtn").addEventListener("click", () => {
        const zone = selectedZone();
        if (zone && zone.shape === "polygon") {
          zone.points = (zone.points || []).slice().reverse();
          renderAll();
        }
      });

      document.getElementById("saveLocalBtn").addEventListener("click", () => {
        localStorage.setItem("nordsweet-airspaces-editor", JSON.stringify(exportZones()));
        setStatus("Zapisano w localStorage.", "");
      });
      document.getElementById("loadLocalBtn").addEventListener("click", () => {
        const raw = localStorage.getItem("nordsweet-airspaces-editor");
        if (!raw) {
          setStatus("Brak zapisu lokalnego.", "bad");
          return;
        }
        loadZones(JSON.parse(raw), "localStorage");
      });
      document.getElementById("exportJsonBtn").addEventListener("click", () => {
        T.downloadText("airspaces.json", JSON.stringify({
          generatedAt: new Date().toISOString(),
          source: state.sourceLabel,
          activeAupMode: refs.aupMode.value,
          aup: activeAup(),
          aupToday: state.currentAup,
          aupTomorrow: state.nextAup,
          zones: exportZones()
        }, null, 2), "application/json;charset=utf-8");
      });

      window.addEventListener("resize", renderMap);
      fillSelects();
      loadBasemapUi();
      renderAll();
      loadInitialZones();
      loadAupApi("aup_today", "currentAup", "PANSA current API");
      loadAupApi("aup_tomorrow", "nextAup", "PANSA next API");
    }());
  
}
