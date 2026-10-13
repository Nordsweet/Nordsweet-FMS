export async function start(loadScript) {
await loadScript("./airports.js");
await loadScript("./airports-cz-sk.js");
await loadScript("./navdata.js");
await loadScript("./Waypoints/Poland.js");
await loadScript("./airport-frequencies-data.js?v=20260617-2");
await loadScript("./airspace-api-config.js");
await loadScript("./airspace-data/Poland_Airspaces.js");
await loadScript("./airspace-data/Slovakia_Airspaces.js");
await loadScript("./airspace-data/Poland_Airspaces_TODAY.js");
await loadScript("./airspace-data/Poland_Airspaces_TOMORROW.js");
await loadScript("./airspace-data/AUP_today.js");
await loadScript("./airspace-data/AUP_tomorrow.js");
await loadScript("./airspace-tools.js");
await loadScript("./comms.js");
await loadScript("./traffic-identity-data.js");
await loadScript("./traffic-proxy-config.js");

    (function () {
      "use strict";

      const T = window.AirspaceTools;
      const refs = {
        mapCanvas: document.getElementById("mapCanvas"),
        mapStatus: document.getElementById("mapStatus"),
        coordStatus: document.getElementById("coordStatus"),
        sourceStatus: document.getElementById("sourceStatus"),
        pointMenu: document.getElementById("pointMenu"),
        pointMenuTitle: document.getElementById("pointMenuTitle"),
        pointMenuMeta: document.getElementById("pointMenuMeta"),
        pointMenuCloseBtn: document.getElementById("pointMenuCloseBtn"),
        routeSegmentMenu: document.getElementById("routeSegmentMenu"),
        routeSegmentMenuTitle: document.getElementById("routeSegmentMenuTitle"),
        routeSegmentMenuMeta: document.getElementById("routeSegmentMenuMeta"),
        routeSegmentMenuCloseBtn: document.getElementById("routeSegmentMenuCloseBtn"),
        routeSegmentDetails: document.getElementById("routeSegmentDetails"),
        routeCreateWaypointBtn: document.getElementById("routeCreateWaypointBtn"),
        airspaceInspector: document.getElementById("airspaceInspector"),
        airspaceInspectorTitle: document.getElementById("airspaceInspectorTitle"),
        airspaceInspectorMeta: document.getElementById("airspaceInspectorMeta"),
        airspaceInspectorBody: document.getElementById("airspaceInspectorBody"),
        airspaceInspectorCloseBtn: document.getElementById("airspaceInspectorCloseBtn"),
        trafficMenu: document.getElementById("trafficMenu"),
        trafficMenuTitle: document.getElementById("trafficMenuTitle"),
        trafficMenuMeta: document.getElementById("trafficMenuMeta"),
        trafficMenuDetails: document.getElementById("trafficMenuDetails"),
        trafficMenuCloseBtn: document.getElementById("trafficMenuCloseBtn"),
        trafficMenuDragHandle: document.getElementById("trafficMenuDragHandle"),
        addPointToRouteBtn: document.getElementById("addPointToRouteBtn"),
        directToPointBtn: document.getElementById("directToPointBtn"),
        pointWxBtn: document.getElementById("pointWxBtn"),
        pointRestrictionBtn: document.getElementById("pointRestrictionBtn"),
        pointRestrictionEditor: document.getElementById("pointRestrictionEditor"),
        pointRestrictionSpeed: document.getElementById("pointRestrictionSpeed"),
        pointRestrictionAltitude: document.getElementById("pointRestrictionAltitude"),
        pointRestrictionMode: document.getElementById("pointRestrictionMode"),
        pointRestrictionApplyBtn: document.getElementById("pointRestrictionApplyBtn"),
        pointRestrictionClearBtn: document.getElementById("pointRestrictionClearBtn"),
        pointAirportActions: document.getElementById("pointAirportActions"),
        pointNotamBtn: document.getElementById("pointNotamBtn"),
        pointChartBtn: document.getElementById("pointChartBtn"),
        routeInput: document.getElementById("routeInput"),
        buildRouteBtn: document.getElementById("buildRouteBtn"),
        fitRouteBtn: document.getElementById("fitRouteBtn"),
        gpsBtn: document.getElementById("gpsBtn"),
        gpsCenterBtn: document.getElementById("gpsCenterBtn"),
        gpsStatus: document.getElementById("gpsStatus"),
        gpxFile: document.getElementById("gpxFile"),
        openAirFile: document.getElementById("openAirFile"),
        tabBody: document.getElementById("tabBody"),
        aupMode: document.getElementById("aupMode"),
        labelToggle: document.getElementById("labelToggle"),
        basemapSelect: document.getElementById("basemapSelect"),
        basemapTemplate: document.getElementById("basemapTemplate"),
        basemapApiKey: document.getElementById("basemapApiKey"),
        basemapStatus: document.getElementById("basemapStatus"),
        saveBasemapBtn: document.getElementById("saveBasemapBtn"),
        airspaceTypeFilters: document.getElementById("airspaceTypeFilters"),
        selectAllTypesBtn: document.getElementById("selectAllTypesBtn"),
        clearTypesBtn: document.getElementById("clearTypesBtn"),
        metricAirspaces: document.getElementById("metricAirspaces"),
        metricRoute: document.getElementById("metricRoute"),
        metricCrossed: document.getElementById("metricCrossed"),
        embeddedLayersBtn: document.getElementById("embeddedLayersBtn"),
        embeddedLayersPanel: document.getElementById("embeddedLayersPanel"),
        trafficStatus: document.getElementById("trafficStatus"),
        trafficAttribution: document.getElementById("trafficAttribution"),
      };

      const AIRSPACE_TYPE_FILTERS = ["FIS", "R", "P", "CTR", "MCTR", "TMA", "ADIZ", "MTMA", "ATZ", "D", "TRA", "TSA", "RMZ", "TMZ", "OTHER"];
      const AIRSPACE_TYPE_LABELS = {
        OTHER: "Inne"
      };
      const LOCAL_DEV_SERVER = "http://127.0.0.1:8765/";
      const GPS_VECTOR_MINUTES = [1, 2, 3, 4, 5];
      const MPS_TO_KT = 1.94384449;
      const MS_PER_HOUR = 3600000;
      const COLLECTOR_TRAFFIC_URL = String(window.NORDSWEET_TRAFFIC_COLLECTOR_URL || "https://aviation.lab.vibecde.com/traffic").trim();
      const TRAFFIC_REFRESH_MS = 15000;
      const TRAFFIC_MIN_REQUEST_INTERVAL_MS = 1100;
      const TRAFFIC_MAX_DISTANCE_NM = 250;
      const TRAFFIC_HISTORY_MAX_AGE_MS = 6 * 60 * 60 * 1000;
      const TRAFFIC_HISTORY_MAX_POINTS = 1440;
      const TRAFFIC_HISTORY_MIN_MOVEMENT_NM = 0.015;
      const TRAFFIC_TRACK_PROJECTION_MINUTES = 2;
      const TRAFFIC_ANIMATION_FRAME_MS = 1000 / 24;
      const TRAFFIC_FADE_START_MS = 60 * 1000;
      const TRAFFIC_FADE_END_MS = 2 * 60 * 1000;
      const TRAFFIC_CAUTION_TIME_SECONDS = 5 * 60;
      const TRAFFIC_WARNING_TIME_SECONDS = 48;
      const TRAFFIC_COLLISION_TIME_SECONDS = 35;

      function setupEmbeddedMode() {
        const params = new URLSearchParams(window.location.search);
        if (params.get("embed") !== "1") {
          return;
        }

        document.body.classList.add("embedded");
        const panel = refs.embeddedLayersPanel;
        const button = refs.embeddedLayersBtn;
        if (!panel || !button) {
          return;
        }

        const header = document.querySelector("header");
        const mapTools = document.querySelector(".map-tools");
        if (header && !panel.querySelector(".embedded-header-section")) {
          const section = document.createElement("div");
          section.className = "embedded-layer-section embedded-header-section";
          while (header.firstChild) {
            section.appendChild(header.firstChild);
          }
          panel.appendChild(section);
        }
        if (mapTools && !panel.querySelector(".embedded-tools-section")) {
          const section = document.createElement("div");
          section.className = "embedded-layer-section embedded-tools-section";
          while (mapTools.firstChild) {
            section.appendChild(mapTools.firstChild);
          }
          panel.appendChild(section);
        }

        button.hidden = false;
        button.addEventListener("click", () => {
          const nextOpen = panel.hidden;
          panel.hidden = !nextOpen;
          button.classList.toggle("active", nextOpen);
          button.setAttribute("aria-expanded", String(nextOpen));
        });
      }

      function truthyQueryParam(params, key) {
        const value = String(params.get(key) || "").trim().toLowerCase();
        return value === "1" || value === "true" || value === "yes" || value === "on";
      }

      function setLayerEnabled(layer, enabled) {
        state.layers[layer] = Boolean(enabled);
        const input = document.querySelector('[data-layer="' + layer + '"]');
        if (input) {
          input.checked = Boolean(enabled);
        }
      }

      function hasEnabledTrafficLayers() {
        return Boolean(state.layers.traffic);
      }

      function applyStartupMapParams() {
        const params = new URLSearchParams(window.location.search);
        if (truthyQueryParam(params, "trafficOnly")) {
          setLayerEnabled("route", false);
        }
        if (truthyQueryParam(params, "traffic") || truthyQueryParam(params, "liveTraffic")) {
          setLayerEnabled("traffic", true);
        }
      }

      function startStartupMapServices() {
        if (hasEnabledTrafficLayers()) {
          startTrafficRefresh();
        }
      }

      const BASEMAPS = {
        osm: {
          id: "osm",
          label: "OpenStreetMap",
          type: "xyz",
          template: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          fallbackTemplates: [
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
          ],
          referrerPolicy: "origin-when-cross-origin",
          minZoom: 3,
          maxZoom: 18,
          attribution: "(c) OpenStreetMap contributors"
        },
        black: {
          id: "black",
          label: "Black",
          type: "black",
          attribution: ""
        }
      };

      const state = {
        zones: [],
        currentAup: null,
        nextAup: null,
        czechCurrentAup: null,
        czechNextAup: null,
        route: [],
        unresolved: [],
        pointIndex: null,
        zoneFrequencyIndex: new Map(),
        bounds: Object.assign({}, T.DEFAULT_BOUNDS),
        viewport: null,
        layers: {
          airspaces: true,
          airports: true,
          vfr: true,
          ifr: true,
          navaids: true,
          route: true,
          traffic: true,
        },
        typeFilters: new Set(AIRSPACE_TYPE_FILTERS),
        activeTab: "route",
        drag: null,
        suppressNextMapClick: false,
        selectedPoint: null,
        selectedPointRestrictionOpen: false,
        selectedPointRestrictionAltitudeMode: "at",
        selectedRouteSegment: null,
        selectedAirspacePoint: null,
        selectedTraffic: null,
        directTo: null,
        routeCruiseSpeedKt: 0,
        trafficMenuDrag: null,
        trafficMenuPosition: null,
        routeInputSynced: true,
        tileCache: new Map(),
        googleSessions: {},
        traffic: {
          aircraft: [],
          historyById: new Map(),
          fetchedAt: 0,
          lastRequestAt: 0,
          lastQuery: null,
          pending: false,
          intervalId: null,
          refreshTimer: null,
          animationFrameId: null,
          lastAnimationRenderAt: 0,
          abortController: null,
          error: "",
          sourceName: "",
          sourceHref: ""
        },
        gps: {
          browserFix: null,
          browserPreviousFix: null,
          debugActive: false,
          enabled: false,
          following: false,
          manualAnchorRatio: null,
          manualPanRatio: { x: 0, y: 0 },
          manualSourceRatio: null,
          navigationHeadingDeg: null,
          watchId: null,
          fix: null,
          previousFix: null,
          error: "",
          track: []
        },
        navigationTransform: null,
        renderQueued: false
      };

      function setSourceStatus(text, bad) {
        refs.sourceStatus.textContent = text;
        refs.sourceStatus.style.color = bad ? "#a81731" : "";
      }

      function resizeCanvas() {
        const rect = refs.mapCanvas.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        const width = Math.max(420, Math.floor(rect.width));
        const height = Math.max(420, Math.floor(rect.height));
        if (refs.mapCanvas.width !== Math.floor(width * ratio) || refs.mapCanvas.height !== Math.floor(height * ratio)) {
          refs.mapCanvas.width = Math.floor(width * ratio);
          refs.mapCanvas.height = Math.floor(height * ratio);
        }
        const ctx = refs.mapCanvas.getContext("2d");
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        return { ctx, width, height };
      }

      function combineAupPlans(plans, label) {
        const available = (plans || []).filter((plan) => plan && Array.isArray(plan.rows));
        if (!available.length) return null;
        const seen = new Set();
        const rows = [];
        available.forEach((plan) => plan.rows.forEach((row) => {
          const key = [row.designator, row.lower, row.upper, row.start, row.end, row.remarks, row.source].join("|");
          if (!seen.has(key)) {
            seen.add(key);
            rows.push(row);
          }
        }));
        return {
          label,
          validityStart: available.map((plan) => plan.validityStart).find(Boolean) || "",
          validityEnd: available.map((plan) => plan.validityEnd).find(Boolean) || "",
          rows
        };
      }

      function activeAup() {
        if (refs.aupMode.value === "next") return combineAupPlans([state.nextAup, state.czechNextAup], "AUP next: Poland / Czechia");
        if (refs.aupMode.value === "current") return combineAupPlans([state.currentAup, state.czechCurrentAup], "AUP current: Poland / Czechia");
        return null;
      }

      function normalizeZoneType(zone) {
        const kind = String(zone && zone.kind || "").trim().toUpperCase();
        return AIRSPACE_TYPE_FILTERS.includes(kind) ? kind : "OTHER";
      }

      function zoneTypeCounts() {
        return state.zones.reduce((counts, zone) => {
          const type = normalizeZoneType(zone);
          counts[type] = (counts[type] || 0) + 1;
          return counts;
        }, {});
      }

      function filteredZones() {
        if (!state.typeFilters.size) return [];
        return state.zones.filter((zone) => state.typeFilters.has(normalizeZoneType(zone)));
      }

      function renderTypeFilters() {
        const counts = zoneTypeCounts();
        refs.airspaceTypeFilters.innerHTML = AIRSPACE_TYPE_FILTERS.map((type) => {
          const checked = state.typeFilters.has(type) ? " checked" : "";
          const label = AIRSPACE_TYPE_LABELS[type] || type;
          return (
            "<label class=\"type-chip\"><input data-airspace-type=\"" + type + "\" type=\"checkbox\"" + checked + ">" +
            "<span>" + escapeHtml(label) + "</span><small>" + (counts[type] || 0) + "</small></label>"
          );
        }).join("");
      }

      function zonesFromAirspacePayload(payload) {
        if (Array.isArray(payload)) {
          return payload;
        }
        if (!payload || typeof payload !== "object") {
          return [];
        }
        if (Array.isArray(payload.zones)) {
          return payload.zones;
        }
        if (Array.isArray(payload.airspaces)) {
          return payload.airspaces;
        }
        if (Array.isArray(payload.items)) {
          return payload.items;
        }
        return [];
      }

      function staticAirspaceSupplementZones() {
        const datasets = window.NORDSWEET_STATIC_AIRSPACE_ZONES || {};
        return Object.keys(datasets).sort().flatMap((key) => {
          const dataset = datasets[key];
          return Array.isArray(dataset && dataset.zones) ? dataset.zones : [];
        });
      }

      function appendStaticAirspaceSupplements(zones) {
        const seen = new Set();
        return (Array.isArray(zones) ? zones : []).concat(staticAirspaceSupplementZones()).filter((zone, index) => {
          const source = String(zone && zone.source || "local").trim().toUpperCase();
          const id = String(zone && zone.id || "zone-" + index).trim().toUpperCase();
          const key = source + "|" + id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      function normalizeJsonZones(payload) {
        return appendStaticAirspaceSupplements(zonesFromAirspacePayload(payload)).filter(Boolean).map((zone, index) => Object.assign({}, zone, {
          id: zone.id || "json-zone-" + String(index + 1).padStart(4, "0"),
          kind: zone.kind || T.inferAirspaceKind(zone.name || zone.designator, zone.classType),
          frequencies: Array.isArray(zone.frequencies) ? zone.frequencies : []
        }));
      }

      function zoneFrequencyKeys(zone) {
        const keys = [];
        const assignmentKey = T.clean(zone && zone.assignmentKey);
        const name = T.searchKey(zone && zone.name);
        const designator = T.searchKey(zone && zone.designator);
        const full = [zone && zone.kind, zone && zone.classType, zone && zone.name, zone && zone.lower, zone && zone.upper].map(T.searchKey).join("|");
        if (assignmentKey) keys.push("assignment:" + T.searchKey(assignmentKey));
        if (full.replace(/\|/g, "")) keys.push("full:" + full);
        if (designator && name) keys.push("designator-name:" + designator + "|" + name);
        if (name) keys.push("name:" + name);
        return Array.from(new Set(keys));
      }

      function buildZoneFrequencyIndex(zones) {
        const index = new Map();
        zones.forEach((zone) => {
          const rows = normalizeZoneFrequencyRows(zone);
          if (!rows.length) return;
          zoneFrequencyKeys(zone).forEach((key) => {
            if (!index.has(key)) {
              index.set(key, rows.map((row) => Object.assign({}, row)));
            }
          });
        });
        return index;
      }

      function hydrateZoneFrequencies(zones) {
        zones = zones.map(zone => Array.isArray(zone.points) && zone.shape !== 'circle'
          ? {...zone, points:T.normalizeRetracedPolygon(zone.points)} : zone);
        if (!state.zoneFrequencyIndex || !state.zoneFrequencyIndex.size) {
          return zones;
        }
        return zones.map((zone) => {
          if (Array.isArray(zone.frequencies) && zone.frequencies.length) {
            return zone;
          }
          const key = zoneFrequencyKeys(zone).find((candidate) => state.zoneFrequencyIndex.has(candidate));
          if (!key) {
            return zone;
          }
          return Object.assign({}, zone, {
            frequencies: state.zoneFrequencyIndex.get(key).map((row) => Object.assign({}, row))
          });
        });
      }

      function applyAirspacePayload(payload, label) {
        const zones = normalizeJsonZones(payload);
        if (!zones.length) {
          throw new Error("Brak tablicy zones w pliku.");
        }

        state.zoneFrequencyIndex = buildZoneFrequencyIndex(zones);
        state.zones = hydrateZoneFrequencies(zones);
        if (payload && typeof payload === "object" && !Array.isArray(payload)) {
          if (payload.aupToday) {
            state.currentAup = payload.aupToday;
          }
          if (payload.aupTomorrow) {
            state.nextAup = payload.aupTomorrow;
          }
          if (payload.aup && !payload.aupToday && !payload.aupTomorrow) {
            if (payload.activeAupMode === "next") {
              state.nextAup = payload.aup;
            } else {
              state.currentAup = payload.aup;
            }
          }
          if (["current", "next", ""].includes(payload.activeAupMode)) {
            refs.aupMode.value = payload.activeAupMode;
          }
        }

        const source = payload && payload.source ? " / " + payload.source : "";
        setSourceStatus("Wczytano " + state.zones.length + " stref z " + label + source + ".");
        renderTypeFilters();
        renderMap();
        renderTab();
      }

      function airspacesJsonCandidates(url) {
        const sourceUrl = url || "airspaces.json";
        if (/^https?:\/\//i.test(sourceUrl)) {
          return [sourceUrl];
        }

        const relativeUrl = sourceUrl.replace(/^\.?\//, "");
        const candidates = [];
        if (window.location.protocol === "file:") {
          candidates.push(LOCAL_DEV_SERVER + relativeUrl);
        }
        candidates.push(sourceUrl);
        if (window.location.protocol !== "file:" && window.location.hostname !== "127.0.0.1") {
          candidates.push(LOCAL_DEV_SERVER + relativeUrl);
        }
        return Array.from(new Set(candidates));
      }

      function friendlyFetchError(error) {
        const message = error && error.message ? error.message : String(error);
        if (message === "Failed to fetch" && window.location.protocol === "file:") {
          return "Failed to fetch (otworz przez " + LOCAL_DEV_SERVER + "airspaces-map.html albo wgraj airspaces.json przyciskiem OpenAir/JSON)";
        }
        return message;
      }

      async function loadAirspacesJson(url) {
        const candidates = airspacesJsonCandidates(url);
        const errors = [];
        setSourceStatus("Ladowanie " + candidates[0] + "...");
        for (const sourceUrl of candidates) {
          try {
            const response = await fetch(sourceUrl, { cache: "no-store" });
            if (!response.ok) {
              throw new Error(response.status + " " + response.statusText);
            }
            applyAirspacePayload(await response.json(), sourceUrl);
            return;
          } catch (error) {
            errors.push(sourceUrl + ": " + friendlyFetchError(error));
          }
        }
        throw new Error(errors.join(" | "));
      }

      async function loadDefaultAirspaces() {
        try {
          await loadAirspacesJson("airspaces.json");
          if (!state.currentAup) {
            loadAupApi("aup_today", "currentAup", "PANSA current API");
          }
          if (!state.nextAup) {
            loadAupApi("aup_tomorrow", "nextAup", "PANSA next API");
          }
          loadCzechGeometry();
          loadCzechAupApi("czech_aup_current", "czechCurrentAup", "ANS CR current AUP/UUP");
          loadCzechAupApi("czech_aup_next", "czechNextAup", "ANS CR next AUP");
        } catch (error) {
          setSourceStatus("Nie udalo sie wczytac airspaces.json: " + error.message + ". Probuje TODAY API.", true);
          loadOpenAirApi("today", "TODAY API");
          loadAupApi("aup_today", "currentAup", "PANSA current API");
          loadAupApi("aup_tomorrow", "nextAup", "PANSA next API");
          loadCzechGeometry();
          loadCzechAupApi("czech_aup_current", "czechCurrentAup", "ANS CR current AUP/UUP");
          loadCzechAupApi("czech_aup_next", "czechNextAup", "ANS CR next AUP");
        }
      }

      function getNavigationMapTransform(viewport) {
        if (!state.gps.debugActive || !state.gps.enabled || !state.gps.fix) {
          return null;
        }

        const fix = animatedGpsPosition(state.gps.fix, Date.now()) || state.gps.fix;
        if (!fix || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lon)) {
          return null;
        }

        const motion = gpsMotion(fix);
        const measuredHeadingDeg = motion && Number.isFinite(motion.headingDeg) ? motion.headingDeg : 0;
        const following = Boolean(state.gps.following);
        // While the pilot pans, keep the last track-up heading instead of rotating again on each GPS update.
        if (following) {
          state.gps.navigationHeadingDeg = measuredHeadingDeg;
        }
        const headingDeg = Number.isFinite(state.gps.navigationHeadingDeg)
          ? state.gps.navigationHeadingDeg
          : measuredHeadingDeg;
        const source = following
          ? viewport.project(fix)
          : state.gps.manualSourceRatio
            ? {
              x: state.gps.manualSourceRatio.x * viewport.width,
              y: state.gps.manualSourceRatio.y * viewport.height
            }
            : { x: viewport.width / 2, y: viewport.height / 2 };
        const manualPanRatio = state.gps.manualPanRatio || { x: 0, y: 0 };
        const anchor = following
          ? { x: viewport.width / 2, y: viewport.height * 0.75 }
          : state.gps.manualAnchorRatio
            ? {
              x: (state.gps.manualAnchorRatio.x + manualPanRatio.x) * viewport.width,
              y: (state.gps.manualAnchorRatio.y + manualPanRatio.y) * viewport.height
            }
            : {
              x: (0.5 + manualPanRatio.x) * viewport.width,
              y: (0.5 + manualPanRatio.y) * viewport.height
            };
        return {
          anchor,
          fix,
          following,
          headingDeg,
          rotationRad: -headingDeg * Math.PI / 180,
          source
        };
      }

      function mapCanvasPointToScreen(point) {
        const transform = state.navigationTransform;
        if (!transform || !point) return point;
        const dx = point.x - transform.source.x;
        const dy = point.y - transform.source.y;
        const cos = Math.cos(transform.rotationRad);
        const sin = Math.sin(transform.rotationRad);
        return {
          x: transform.anchor.x + dx * cos - dy * sin,
          y: transform.anchor.y + dx * sin + dy * cos
        };
      }

      function mapScreenPointToCanvas(point) {
        const transform = state.navigationTransform;
        if (!transform || !point) return point;
        const dx = point.x - transform.anchor.x;
        const dy = point.y - transform.anchor.y;
        const cos = Math.cos(-transform.rotationRad);
        const sin = Math.sin(-transform.rotationRad);
        return {
          x: transform.source.x + dx * cos - dy * sin,
          y: transform.source.y + dx * sin + dy * cos
        };
      }

      function getMapCoordinateAtCss(cssX, cssY, rect) {
        if (!state.viewport || !rect || !rect.width || !rect.height) return null;
        const screenPoint = {
          x: cssX * state.viewport.width / rect.width,
          y: cssY * state.viewport.height / rect.height
        };
        const canvasPoint = mapScreenPointToCanvas(screenPoint);
        return state.viewport.unproject(canvasPoint.x, canvasPoint.y);
      }

      function updateGpsCenterButton() {
        if (!refs.gpsCenterBtn) return;
        const canCenter = Boolean(state.gps.debugActive && state.gps.enabled && state.gps.fix);
        refs.gpsCenterBtn.hidden = !canCenter || Boolean(state.gps.following);
      }

      function centerMapBoundsOnPoint(point) {
        if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return;
        const latSpan = Math.max(0.01, state.bounds.maxLat - state.bounds.minLat);
        const lonSpan = Math.max(0.01, state.bounds.maxLon - state.bounds.minLon);
        state.bounds = {
          minLat: point.lat - latSpan / 2,
          maxLat: point.lat + latSpan / 2,
          minLon: point.lon - lonSpan / 2,
          maxLon: point.lon + lonSpan / 2
        };
      }

      function detachGpsNavigationWithoutJump() {
        const transform = state.navigationTransform;
        const viewport = state.viewport;
        if (!transform || !viewport || !transform.following || !transform.fix) {
          state.gps.following = false;
          return;
        }

        // Freeze the current canvas transform rather than changing geographic bounds.
        // The first manual frame therefore renders identically to the tracked frame.
        state.gps.manualSourceRatio = {
          x: transform.source.x / viewport.width,
          y: transform.source.y / viewport.height
        };
        state.gps.manualAnchorRatio = {
          x: transform.anchor.x / viewport.width,
          y: transform.anchor.y / viewport.height
        };
        state.gps.manualPanRatio = { x: 0, y: 0 };
        state.gps.following = false;
        state.gps.navigationHeadingDeg = Number.isFinite(transform.headingDeg)
          ? transform.headingDeg
          : state.gps.navigationHeadingDeg;
      }

      function centerGpsNavigation() {
        if (!state.gps.debugActive || !state.gps.fix) return;
        state.gps.following = true;
        state.gps.manualAnchorRatio = null;
        state.gps.manualPanRatio = { x: 0, y: 0 };
        state.gps.manualSourceRatio = null;
        const motion = gpsMotion(state.gps.fix);
        state.gps.navigationHeadingDeg = motion && Number.isFinite(motion.headingDeg) ? motion.headingDeg : 0;
        centerMapBoundsOnPoint(state.gps.fix);
        updateGpsCenterButton();
        renderMap();
      }

      function renderMap() {
        const canvas = resizeCanvas();
        const ctx = canvas.ctx;
        const viewport = T.createViewport(state.bounds, canvas.width, canvas.height, 28);
        state.viewport = viewport;
        state.navigationTransform = getNavigationMapTransform(viewport);

        ctx.save();
        const basemap = selectedBasemap();
        ctx.fillStyle = basemap.type === "black" ? "#05070b" : "#faf9f4";
        ctx.fillRect(0, 0, viewport.width, viewport.height);
        if (state.navigationTransform) {
          const transform = state.navigationTransform;
          ctx.translate(transform.anchor.x, transform.anchor.y);
          ctx.rotate(transform.rotationRad);
          ctx.translate(-transform.source.x, -transform.source.y);
        }
        if (basemap.type !== "black") {
          T.drawBaseMap(ctx, viewport);
        }
        drawBasemap(ctx, viewport);
        const activeSet = T.aupDesignatorSet(activeAup());
        const zones = filteredZones();

        if (state.layers.airspaces) {
          T.drawAirspaces(ctx, viewport, zones, { activeSet, labels: refs.labelToggle.checked });
        }
        drawPoints(ctx, viewport);
        if (state.layers.route) {
          drawRoute(ctx, viewport);
        }
        if (hasEnabledTrafficLayers()) {
          drawTrafficEstimatedSegments(ctx, viewport);
          drawTraffic(ctx, viewport);
        }
        drawSelectedTrafficHistory(ctx, viewport);
        drawSelectedTrafficTrack(ctx, viewport);
        drawSelectedTraffic(ctx, viewport);
        drawSelectedPoint(ctx, viewport);
        drawGps(ctx, viewport);
        ctx.restore();
        drawBasemapAttribution(ctx, viewport);
        updateMetrics();
        updateGpsCenterButton();
        positionTrafficMenu();
      }

      function selectedBasemap() {
        return BASEMAPS[refs.basemapSelect.value] || BASEMAPS.osm;
      }

      function loadBasemapUi() {
        const savedBasemap = localStorage.getItem("nordsweet-basemap") || "osm";
        refs.basemapSelect.value = BASEMAPS[savedBasemap] ? savedBasemap : "osm";
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

      function getProviderApiKey(provider) {
        if (provider.type === "google") {
          return localStorage.getItem("nordsweet-basemap-google-key") || "";
        }
        return provider.apiKeyStorageKey ? (localStorage.getItem(provider.apiKeyStorageKey) || "") : "";
      }

      function getBasemapStatus(provider) {
        if (provider.type === "black") return "black";
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
        // Viewport bounds may describe a narrow, vertical route while the
        // canvas is wide. Use the visible canvas span to avoid requesting an
        // excessive number of high-zoom tiles and repeatedly evicting them.
        const topLeft = viewport.unproject(0, 0);
        const bottomRight = viewport.unproject(viewport.width, viewport.height);
        const spanLon = Math.max(0.01, Math.abs(bottomRight.lon - topLeft.lon));
        const raw = Math.log2((viewport.width - 56) * 360 / (256 * spanLon));
        const minZoom = Number.isFinite(provider.minZoom) ? provider.minZoom : 0;
        const maxZoom = Number.isFinite(provider.maxZoom) ? provider.maxZoom : 18;
        return Math.max(minZoom, Math.min(maxZoom, Math.round(raw)));
      }

      function drawBasemap(ctx, viewport) {
        const provider = selectedBasemap();
        if (provider.type === "black") {
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

        // The route bounds preserve their geographic aspect ratio. On a wide
        // canvas, the visible area extends beyond those bounds horizontally,
        // so derive tile coverage from the actual canvas corners.
        const topLeft = viewport.unproject(0, 0);
        const bottomRight = viewport.unproject(viewport.width, viewport.height);
        const visibleMinLon = Math.min(topLeft.lon, bottomRight.lon);
        const visibleMaxLon = Math.max(topLeft.lon, bottomRight.lon);
        const visibleMinLat = Math.min(topLeft.lat, bottomRight.lat);
        const visibleMaxLat = Math.max(topLeft.lat, bottomRight.lat);
        const tileMargin = state.navigationTransform ? 3 : 1;
        const x0 = Math.floor(lonToTileX(visibleMinLon, zoom)) - tileMargin;
        const x1 = Math.floor(lonToTileX(visibleMaxLon, zoom)) + tileMargin;
        const y0 = Math.max(0, Math.floor(latToTileY(visibleMaxLat, zoom)) - tileMargin);
        const y1 = Math.min(n - 1, Math.floor(latToTileY(visibleMinLat, zoom)) + tileMargin);
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
        const topLeft = viewport.project({ lat: tileYToLat(y, zoom), lon: tileXToLon(x, zoom) });
        const bottomRight = viewport.project({ lat: tileYToLat(y + 1, zoom), lon: tileXToLon(x + 1, zoom) });
        const drawWidth = bottomRight.x - topLeft.x + 1;
        const drawHeight = bottomRight.y - topLeft.y + 1;
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
          drawTilePlaceholder(ctx, viewport, topLeft.x, topLeft.y, drawWidth, drawHeight);
          return;
        }
        ctx.drawImage(image, topLeft.x, topLeft.y, drawWidth, drawHeight);
      }

      function drawTilePlaceholder(ctx, viewport, x, y, width, height) {
        // A shared canvas-wide gradient keeps missing tiles seamless while a
        // provider request is pending or temporarily unavailable.
        const wash = ctx.createLinearGradient(0, 0, viewport.width, viewport.height);
        wash.addColorStop(0, "#edf2e8");
        wash.addColorStop(0.48, "#e4ebdf");
        wash.addColorStop(1, "#dce8d7");
        ctx.fillStyle = wash;
        ctx.fillRect(x, y, width, height);
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
        if (!provider.attribution || provider.type === "black") {
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

      function currentViewportBounds() {
        if (!state.viewport) return state.bounds;
        const corners = [
          { x: 0, y: 0 },
          { x: state.viewport.width, y: 0 },
          { x: 0, y: state.viewport.height },
          { x: state.viewport.width, y: state.viewport.height }
        ].map(mapScreenPointToCanvas).map((point) => state.viewport.unproject(point.x, point.y));
        return {
          minLat: Math.min(...corners.map((point) => point.lat)),
          maxLat: Math.max(...corners.map((point) => point.lat)),
          minLon: Math.min(...corners.map((point) => point.lon)),
          maxLon: Math.max(...corners.map((point) => point.lon))
        };
      }

      function inBounds(point, bounds) {
        // Array.filter passes an index as its second argument; only accept an actual bounds object.
        const b = bounds && typeof bounds === "object" && Number.isFinite(bounds.minLat)
          ? bounds
          : currentViewportBounds();
        return point && point.lat >= b.minLat - 0.2 && point.lat <= b.maxLat + 0.2 &&
          point.lon >= b.minLon - 0.2 && point.lon <= b.maxLon + 0.2;
      }

      function isLandingSiteWaypoint(point) {
        const kind = String(point && (point.kind || (point.cup && point.cup.kind)) || "").trim().toLowerCase();
        return ["landing-site", "airfield", "airport", "aerodrome"].includes(kind);
      }

      function visiblePointEntries() {
        const entries = [];
        const viewBounds = currentViewportBounds();
        if (state.layers.airports) {
          T.getAirports()
            .filter((point) => inBounds(point, viewBounds))
            .forEach((airport) => entries.push({ point: airport, kind: "airport" }));
        }
        const privatePoints = T.getPrivateWaypoints().filter((point) => inBounds(point, viewBounds));
        if (state.layers.vfr) {
          privatePoints
            // Landing sites remain route points in the data index, but are drawn only by the airport layer.
            .filter((point) => !point.navaid && !isLandingSiteWaypoint(point) && (point.rules || point.ruleSet || "").toUpperCase() !== "IFR")
            .forEach((point) => entries.push({ point, kind: "vfr" }));
        }
        if (state.layers.navaids) {
          privatePoints
            .filter((point) => point.navaid)
            .forEach((point) => entries.push({ point, kind: "navaid" }));
        }
        if (state.layers.ifr) {
          T.getIfrWaypoints()
            .filter((point) => inBounds(point, viewBounds))
            .forEach((point) => entries.push({ point, kind: "ifr" }));
        }
        return entries;
      }

      function drawPoints(ctx, viewport) {
        visiblePointEntries().forEach((entry) => drawSymbol(ctx, viewport, entry.point, entry.kind));
      }

      function isControlledAirport(point) {
        const descriptor = [
          point && point.status,
          point && point.sourceDescription,
          point && point.remarks
        ].filter(Boolean).join(" ");
        return T.searchKey(descriptor).includes("LOTNISKOKONTROLOWANE");
      }

      function isUncontrolledIcaoAirport(point) {
        const icao = String(point && point.icao || "").trim().toUpperCase();
        return Boolean(point && point.isIcao === true && /^[A-Z]{4}$/.test(icao) && !isControlledAirport(point));
      }

      function getAirportRunwayLengthM(point) {
        const runways = Array.isArray(point && point.runways) ? point.runways : [];
        const length = runways.reduce((longest, runway) => {
          const candidate = Math.max(
            Number(runway && runway.length_m) || 0,
            Number(runway && runway.tora) || 0,
            Number(runway && runway.toda) || 0,
            Number(runway && runway.asda) || 0,
            Number(runway && runway.lda) || 0
          );
          return Math.max(longest, candidate);
        }, 0);
        return length > 0 ? Math.round(length) : null;
      }

      function getAirportRunwayHeading(point) {
        const runways = Array.isArray(point && point.runways) ? point.runways : [];
        const runway = runways.find((candidate) => Number.isFinite(Number(candidate && (candidate.trueHdg || candidate.hdg || candidate.magHdg))));
        const heading = Number(runway && (runway.trueHdg || runway.hdg || runway.magHdg));
        return Number.isFinite(heading) ? ((heading % 360) + 360) % 360 : null;
      }

      function isVorNavaid(point) {
        const type = T.searchKey(point && point.navaid && point.navaid.type);
        return type.includes("VOR");
      }

      function isVorDmeNavaid(point) {
        const type = T.searchKey(point && point.navaid && point.navaid.type);
        return type.includes("VOR") && type.includes("DME");
      }

      function isDmeNavaid(point) {
        const type = T.searchKey(point && point.navaid && point.navaid.type);
        return type.includes("DME") && !type.includes("VOR");
      }

      function isNdbNavaid(point) {
        const type = T.searchKey(point && point.navaid && point.navaid.type);
        return type.includes("NDB");
      }

      function isReportingPoint(point) {
        const kind = T.searchKey(point && (point.kind || (point.cup && point.cup.kind)));
        return kind === "VFRREPORTINGPOINT";
      }

      const POINT_LABEL_MIN_ZOOM = 9;

      function mapLabelZoom(viewport) {
        // Pixels per degree, independent of screen size and device pixel ratio.
        return Math.log2(viewport.scale * 360 / 256);
      }

      function drawAirportDataLabel(ctx, viewport, point, screenPoint) {
        const zoom = mapLabelZoom(viewport);
        if (!refs.labelToggle.checked || zoom < POINT_LABEL_MIN_ZOOM) {
          return;
        }
        const name = String(point && point.name || point && point.icao || "").trim();
        const rawIcao = String(point && point.icao || "").trim().toUpperCase();
        // Imported landing sites may put a name or local identifier in `icao`.
        const icao = point && point.isIcao !== false && /^[A-Z]{4}$/.test(rawIcao) ? rawIcao : "";
        if (zoom < 10 && !icao) return;
        const elevation = Number(point && point.elevation);
        const runwayLength = getAirportRunwayLengthM(point);
        const title = zoom < 10 ? icao : icao && name && T.searchKey(name) !== T.searchKey(icao)
          ? name + " / " + icao
          : name || icao;
        const details = [
          Number.isFinite(elevation) ? "AD " + Math.round(elevation) + " ft AMSL" : "",
          runwayLength ? "RWY " + runwayLength + " m" : ""
        ].filter(Boolean).join(" / ");

        ctx.save();
        ctx.textBaseline = "alphabetic";
        ctx.font = "700 10px system-ui, sans-serif";
        ctx.fillStyle = "#126cac";
        ctx.fillText(title, screenPoint.x + 10, screenPoint.y - 4);
        if (zoom >= 10 && details) {
          ctx.font = "600 8px system-ui, sans-serif";
          ctx.fillStyle = "#2479ae";
          ctx.fillText(details, screenPoint.x + 10, screenPoint.y + 6);
        }
        ctx.restore();
      }

      function drawSymbol(ctx, viewport, point, kind) {
        const p = viewport.project(point);
        const label = point.name || point.key || point.id || point.icao || "";
        const zoomed = mapLabelZoom(viewport) >= POINT_LABEL_MIN_ZOOM;
        const controlledAirport = kind === "airport" && isControlledAirport(point);
        const uncontrolledIcaoAirport = kind === "airport" && isUncontrolledIcaoAirport(point);
        const vorNavaid = kind === "navaid" && isVorNavaid(point);
        const vorDmeNavaid = kind === "navaid" && isVorDmeNavaid(point);
        const dmeNavaid = kind === "navaid" && isDmeNavaid(point);
        const ndbNavaid = kind === "navaid" && isNdbNavaid(point);
        const reportingPoint = kind === "vfr" && isReportingPoint(point);
        const ordinaryVfrPoint = kind === "vfr" && !reportingPoint;
        ctx.save();
        if (kind === "airport") {
          if (controlledAirport) {
            ctx.strokeStyle = "#126cac";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 1.35;
            ctx.beginPath();
            ctx.moveTo(p.x - 9, p.y);
            ctx.lineTo(p.x + 9, p.y);
            ctx.moveTo(p.x, p.y - 9);
            ctx.lineTo(p.x, p.y + 9);
            ctx.stroke();
          } else if (uncontrolledIcaoAirport) {
            const heading = getAirportRunwayHeading(point);
            ctx.strokeStyle = "#126cac";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.stroke();
            if (heading !== null) {
              const radians = heading * Math.PI / 180;
              const dx = Math.sin(radians) * 10;
              const dy = -Math.cos(radians) * 10;
              ctx.lineWidth = 1.6;
              ctx.beginPath();
              ctx.moveTo(p.x - dx, p.y - dy);
              ctx.lineTo(p.x + dx, p.y + dy);
              ctx.stroke();
            }
          } else {
            ctx.strokeStyle = "#126cac";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (kind === "navaid") {
          if (vorNavaid) {
            ctx.strokeStyle = "#111827";
            ctx.lineWidth = 1.45;
            if (vorDmeNavaid) {
              ctx.beginPath();
              ctx.rect(p.x - 7, p.y - 7, 14, 14);
              ctx.stroke();
            }
            const radius = vorDmeNavaid ? 3.8 : 6;
            ctx.beginPath();
            for (let side = 0; side < 6; side += 1) {
              const angle = -Math.PI / 2 + side * Math.PI / 3;
              const x = p.x + Math.cos(angle) * radius;
              const y = p.y + Math.sin(angle) * radius;
              if (side === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.fillStyle = "#111827";
            ctx.beginPath();
            ctx.arc(p.x, p.y, vorDmeNavaid ? 1.2 : 1.7, 0, Math.PI * 2);
            ctx.fill();
          } else if (dmeNavaid) {
            ctx.strokeStyle = "#111827";
            ctx.lineWidth = 1.45;
            ctx.beginPath();
            ctx.rect(p.x - 5.5, p.y - 5.5, 11, 11);
            ctx.stroke();
            ctx.fillStyle = "#111827";
            ctx.fillRect(p.x - 1.25, p.y - 1.25, 2.5, 2.5);
          } else if (ndbNavaid) {
            ctx.strokeStyle = "#111827";
            ctx.lineWidth = 1;
            ctx.setLineDash([1, 1.6]);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = "#111827";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = "#7b2cbf";
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - 5);
            ctx.lineTo(p.x + 5, p.y);
            ctx.lineTo(p.x, p.y + 5);
            ctx.lineTo(p.x - 5, p.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        } else {
          if (reportingPoint) {
            ctx.fillStyle = "#111827";
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - 5);
            ctx.lineTo(p.x + 5, p.y + 4);
            ctx.lineTo(p.x - 5, p.y + 4);
            ctx.closePath();
            ctx.fill();
          } else if (ordinaryVfrPoint) {
            ctx.strokeStyle = "#111827";
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - 5);
            ctx.lineTo(p.x + 5, p.y + 4);
            ctx.lineTo(p.x - 5, p.y + 4);
            ctx.closePath();
            ctx.stroke();
          } else {
            ctx.fillStyle = kind === "vfr" ? "#1d8b57" : "#2563a7";
            ctx.beginPath();
            ctx.arc(p.x, p.y, kind === "ifr" ? 2.2 : 2.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (kind === "airport") {
          drawAirportDataLabel(ctx, viewport, point, p);
        } else if (refs.labelToggle.checked && zoomed) {
          ctx.font = kind === "airport" ? "700 10px system-ui, sans-serif" : "600 9px system-ui, sans-serif";
          ctx.fillStyle = (reportingPoint || ordinaryVfrPoint) ? "#111827" : kind === "vfr" ? "#17633f" : kind === "navaid" ? ((vorNavaid || dmeNavaid || ndbNavaid) ? "#111827" : "#6923a5") : kind === "ifr" ? "#1f5794" : "#111827";
          ctx.fillText(label, p.x + 6, p.y - 5);
        }
        ctx.restore();
      }

      function drawSelectedPoint(ctx, viewport) {
        if (!state.selectedPoint || !state.selectedPoint.point) return;
        const p = viewport.project(state.selectedPoint.point);
        ctx.save();
        ctx.strokeStyle = "#d97706";
        ctx.fillStyle = "rgba(217, 119, 6, 0.12)";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x - 15, p.y);
        ctx.lineTo(p.x - 8, p.y);
        ctx.moveTo(p.x + 8, p.y);
        ctx.lineTo(p.x + 15, p.y);
        ctx.moveTo(p.x, p.y - 15);
        ctx.lineTo(p.x, p.y - 8);
        ctx.moveTo(p.x, p.y + 8);
        ctx.lineTo(p.x, p.y + 15);
        ctx.stroke();
        ctx.restore();
      }

      function pointDisplayName(point) {
        return point && (point.label || point.icao || point.cupCode || point.code || point.key || point.id || point.name) || "Punkt";
      }

      function pointKindLabel(kind) {
        if (kind === "airport") return "Lotnisko";
        if (kind === "navaid") return "Navaid";
        if (kind === "ifr") return "IFR";
        if (kind === "vfr") return "VFR";
        return "Punkt";
      }

      function findPointAt(cssX, cssY, rect) {
        if (!state.viewport || !rect.width || !rect.height) return null;
        const scaleX = state.viewport.width / rect.width;
        const scaleY = state.viewport.height / rect.height;
        const canvasPoint = mapScreenPointToCanvas({ x: cssX * scaleX, y: cssY * scaleY });
        const canvasX = canvasPoint.x;
        const canvasY = canvasPoint.y;
        const hitRadius = 14 * Math.max(scaleX, scaleY);
        const hitRadiusSq = hitRadius * hitRadius;
        let best = null;
        visiblePointEntries().forEach((entry) => {
          const p = state.viewport.project(entry.point);
          const dx = p.x - canvasX;
          const dy = p.y - canvasY;
          const distanceSq = dx * dx + dy * dy;
          if (distanceSq <= hitRadiusSq && (!best || distanceSq < best.distanceSq)) {
            best = Object.assign({ distanceSq }, entry);
          }
        });
        return best;
      }

      function routeSegmentBearingDeg(from, to) {
        const lat1 = Number(from && from.lat) * Math.PI / 180;
        const lat2 = Number(to && to.lat) * Math.PI / 180;
        const deltaLon = (Number(to && to.lon) - Number(from && from.lon)) * Math.PI / 180;
        const y = Math.sin(deltaLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
        return (Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360) + 360) % 360;
      }

      function formatRouteSegmentTime(distanceNm, speedRestrictionKt) {
        const cruiseSpeedKt = Number(state.routeCruiseSpeedKt);
        const restrictionKt = Number(speedRestrictionKt);
        const speedKt = Number.isFinite(restrictionKt) && restrictionKt > 0
          ? Math.min(cruiseSpeedKt, restrictionKt)
          : cruiseSpeedKt;
        if (!Number.isFinite(speedKt) || speedKt <= 0 || !Number.isFinite(distanceNm)) {
          return "--";
        }
        const totalMinutes = Math.max(1, Math.round(distanceNm / speedKt * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return hours ? String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") : "00:" + String(minutes).padStart(2, "0");
      }

      function findRouteSegmentAt(cssX, cssY, rect) {
        if (!state.viewport || state.route.length < 2 || !rect.width || !rect.height) return null;
        const scaleX = state.viewport.width / rect.width;
        const scaleY = state.viewport.height / rect.height;
        const canvasPoint = mapScreenPointToCanvas({ x: cssX * scaleX, y: cssY * scaleY });
        const hitRadius = 11 * Math.max(scaleX, scaleY);
        let best = null;

        for (let index = 1; index < state.route.length; index += 1) {
          const from = state.route[index - 1];
          const to = state.route[index];
          const start = state.viewport.project(from);
          const end = state.viewport.project(to);
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const lengthSq = dx * dx + dy * dy;
          if (lengthSq < 0.0001) continue;
          const rawFraction = ((canvasPoint.x - start.x) * dx + (canvasPoint.y - start.y) * dy) / lengthSq;
          const fraction = Math.max(0, Math.min(1, rawFraction));
          const closestX = start.x + dx * fraction;
          const closestY = start.y + dy * fraction;
          const offsetX = canvasPoint.x - closestX;
          const offsetY = canvasPoint.y - closestY;
          const distanceSq = offsetX * offsetX + offsetY * offsetY;
          if (distanceSq > hitRadius * hitRadius || (best && distanceSq >= best.distanceSq)) continue;
          const distanceNm = T.haversineNm(from, to);
          best = {
            distanceNm,
            distanceSq,
            fraction,
            from,
            index,
            point: {
              lat: Number(from.lat) + (Number(to.lat) - Number(from.lat)) * fraction,
              lon: Number(from.lon) + (Number(to.lon) - Number(from.lon)) * fraction
            },
            to,
            trackDeg: routeSegmentBearingDeg(from, to)
          };
        }
        return best;
      }

      function findTrafficAt(cssX, cssY, rect) {
        if (!state.viewport || !hasEnabledTrafficLayers() || !rect.width || !rect.height) return null;
        const scaleX = state.viewport.width / rect.width;
        const scaleY = state.viewport.height / rect.height;
        const canvasPoint = mapScreenPointToCanvas({ x: cssX * scaleX, y: cssY * scaleY });
        const canvasX = canvasPoint.x;
        const canvasY = canvasPoint.y;
        const hitRadius = 16 * Math.max(scaleX, scaleY);
        const hitRadiusSq = hitRadius * hitRadius;
        let best = null;
        const now = Date.now();
        allTrafficAircraft().forEach((traffic) => {
          const animated = animatedTrafficPosition(traffic, now);
          if (!animated || !inBounds(animated)) return;
          const point = state.viewport.project(animated);
          const dx = point.x - canvasX;
          const dy = point.y - canvasY;
          const distanceSq = dx * dx + dy * dy;
          if (distanceSq <= hitRadiusSq && (!best || distanceSq < best.distanceSq)) {
            best = { traffic, distanceSq };
          }
        });
        return best;
      }

      function trafficDetail(label, value) {
        return '<div class="traffic-menu-detail"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + "</strong></div>";
      }

      function formatTrafficTrack(trackDeg) {
        return Number.isFinite(trackDeg) ? Math.round(trackDeg).toString().padStart(3, "0") + " deg" : "--";
      }

      function formatTrafficSource(traffic) {
        const source = String(traffic && traffic.source || "").trim();
        if (source) {
          const labels = {
            adsbfi: "ADSB.fi",
            airplaneslive: "Airplanes.live",
            ogn: "SeeYou Navigator / OGN/FLARM",
          };
          return Array.from(new Set(source.split("+")
            .map((part) => part.trim().toLowerCase())
            .filter(Boolean)
            .map((part) => labels[part] || part)))
            .join(" + ");
        }
        return String(traffic && traffic.sourceLabel || "").trim() || "--";
      }

      function formatTrafficVerticalRate(verticalRateFpm) {
        if (!Number.isFinite(verticalRateFpm)) return "--";
        const rounded = Math.round(verticalRateFpm);
        return (rounded > 0 ? "+" : "") + rounded + " fpm";
      }

      function normalizeTrafficRegistration(value) {
        // Keep registration labels compact and consistent, e.g. SP-FCW -> SPFCW.
        return String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "");
      }

      function normalizeTrafficHex(value) {
        return String(value || "").trim().toUpperCase().replace(/^0X/, "").replace(/[^0-9A-F]/g, "");
      }

      function getTrafficIdentity(hex) {
        const database = window.NORDSWEET_TRAFFIC_IDENTITY_DATABASE;
        const normalizedHex = normalizeTrafficHex(hex);
        if (!normalizedHex || !database || typeof database !== "object") {
          return null;
        }
        const identity = database[normalizedHex];
        return identity && typeof identity === "object" ? identity : null;
      }

      function getTrafficRegistration(traffic) {
        return normalizeTrafficRegistration(traffic && traffic.registration);
      }

      function formatTrafficRegistrationForDetails(traffic) {
        const raw = String(traffic && (traffic.registrationRaw || traffic.registration) || "").trim().toUpperCase();
        const registration = getTrafficRegistration(traffic);
        if (!registration) return "--";
        if (raw.includes("-")) return raw.replace(/\s+/g, "");
        // The common Polish and Turkish formats use a two-character prefix.
        if (/^(SP|TC)[A-Z0-9]{3,4}$/.test(registration)) {
          return registration.slice(0, 2) + "-" + registration.slice(2);
        }
        return registration;
      }

      function getTrafficDisplayName(traffic) {
        return String(traffic && (getTrafficCallsign(traffic) || traffic.displayName || getTrafficRegistration(traffic) || traffic.hex) || "").trim() || "Traffic";
      }

      function getTrafficCallsign(traffic) {
        const callsign = String(traffic && traffic.callsign || "").trim().toUpperCase();
        if (!callsign || /^(ICA|FLR|OGN|SKY)[0-9A-F]{6}$/.test(callsign)) {
          return "";
        }
        return callsign;
      }

      function trafficHistoryKey(traffic) {
        const serverKey = String(traffic && traffic.historyKey || "").trim();
        if (serverKey) {
          return serverKey;
        }
        const hex = String(traffic && traffic.hex || "").trim().toUpperCase();
        if (hex && hex !== "000000") {
          return "hex:" + hex;
        }
        const callsign = getTrafficCallsign(traffic).replace(/\s+/g, "");
        if (callsign) {
          return "callsign:" + callsign;
        }
        const registration = getTrafficRegistration(traffic);
        if (registration) {
          return "registration:" + registration;
        }
        return "id:" + String(traffic && traffic.id || "unknown").trim().toUpperCase();
      }

      function isMlatTraffic(traffic) {
        const positionSource = String(traffic && traffic.positionSource || "").trim().toUpperCase();
        const type = String(traffic && traffic.type || "").trim().toUpperCase();
        return positionSource === "MLAT" || type === "MLAT";
      }

      function isDroneTraffic(traffic) {
        const sourceParts = String(traffic && traffic.source || "").toLowerCase().split("+");
        return String(traffic && traffic.type || "").trim().toUpperCase() === "UAV";
      }

      function getTrafficPositionSourceLabel(traffic) {
        return isMlatTraffic(traffic) ? "MLAT" : String(traffic && traffic.positionSource || "").trim().toUpperCase();
      }

      function getTrafficMapLabel(traffic) {
        const label = getTrafficCallsign(traffic) || getTrafficRegistration(traffic) || getTrafficDisplayName(traffic);
        return label;
      }

      function updateTrafficMenuHeader(traffic) {
        const callsign = getTrafficCallsign(traffic);
        const registration = getTrafficRegistration(traffic);
        refs.trafficMenuTitle.textContent = callsign || registration || getTrafficDisplayName(traffic);
        refs.trafficMenuMeta.textContent = [formatTrafficSource(traffic), registration, traffic.hex].filter(Boolean).join(" | ") || "Traffic";
      }

      function renderTrafficMenuDetails(traffic) {
        if (!refs.trafficMenuDetails) return;
        const details = [
          trafficDetail("Source", formatTrafficSource(traffic)),
          trafficDetail("History", formatTrafficHistory(traffic)),
          trafficDetail("Current track", formatTrafficTrack(traffic.trackDeg)),
          trafficDetail("Ground speed", Number.isFinite(traffic.speedKt) ? Math.round(traffic.speedKt) + " kt" : "--"),
          trafficDetail("Altitude", Number.isFinite(traffic.altitudeFt) ? Math.round(traffic.altitudeFt) + " ft" : "--"),
          trafficDetail("V/S", formatTrafficVerticalRate(traffic.verticalRateFpm))
        ];
        if (isMlatTraffic(traffic)) {
          details.push(trafficDetail("Position source", getTrafficPositionSourceLabel(traffic)));
        }
        details.push(
          trafficDetail("Type", traffic.type || "--"),
          trafficDetail("Registration", formatTrafficRegistrationForDetails(traffic)),
          trafficDetail("Position", Number(traffic.lat).toFixed(4) + ", " + Number(traffic.lon).toFixed(4))
        );
        refs.trafficMenuDetails.innerHTML = details.join("");
      }

      function positionTrafficMenu() {
        const traffic = state.selectedTraffic;
        if (!traffic || refs.trafficMenu.hidden || !state.viewport) return;

        const setMenuPosition = (left, top) => {
          const rect = refs.mapCanvas.getBoundingClientRect();
          const menuWidth = refs.trafficMenu.offsetWidth || 260;
          const menuHeight = refs.trafficMenu.offsetHeight || 150;
          const margin = 8;
          const clampedLeft = Math.max(margin, Math.min(left, rect.width - menuWidth - margin));
          const clampedTop = Math.max(margin, Math.min(top, rect.height - menuHeight - margin));
          refs.trafficMenu.style.left = clampedLeft + "px";
          refs.trafficMenu.style.top = clampedTop + "px";
          return { left: clampedLeft, top: clampedTop };
        };

        if (state.trafficMenuPosition) {
          state.trafficMenuPosition = setMenuPosition(state.trafficMenuPosition.left, state.trafficMenuPosition.top);
          return;
        }

        const animated = animatedTrafficPosition(traffic, Date.now());
        if (!animated) {
          refs.trafficMenu.hidden = true;
          return;
        }
        const rect = refs.mapCanvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const point = mapCanvasPointToScreen(state.viewport.project(animated));
        const menuWidth = refs.trafficMenu.offsetWidth || 260;
        const menuHeight = refs.trafficMenu.offsetHeight || 150;
        const margin = 8;
        const offset = 14;
        const preferredLeft = point.x + offset;
        const preferredTop = point.y + offset;
        const left = preferredLeft + menuWidth <= rect.width - margin
          ? preferredLeft
          : point.x - menuWidth - offset;
        const top = preferredTop + menuHeight <= rect.height - margin
          ? preferredTop
          : point.y - menuHeight - offset;

        setMenuPosition(left, top);
      }

      function showTrafficMenu(hit, cssX, cssY, rect) {
        const traffic = hit.traffic;
        state.selectedTraffic = traffic;
        state.trafficMenuPosition = null;
        hidePointMenu({ skipRender: true });
        hideRouteSegmentMenu({ skipRender: true });
        hideAirspaceInspector();
        updateTrafficMenuHeader(traffic);
        renderTrafficMenuDetails(traffic);
        void loadTrafficHistory(traffic);
        refs.trafficMenu.hidden = false;
        positionTrafficMenu();
        renderMap();
      }

      function hideTrafficMenu(options) {
        const wasVisible = state.selectedTraffic || !refs.trafficMenu.hidden;
        state.selectedTraffic = null;
        state.trafficMenuDrag = null;
        state.trafficMenuPosition = null;
        refs.trafficMenuDragHandle.classList.remove("is-dragging");
        refs.trafficMenu.hidden = true;
        if (wasVisible && !(options && options.skipRender)) {
          renderMap();
        }
      }

      function startTrafficMenuDrag(event) {
        if (event.button !== 0 || refs.trafficMenu.hidden || event.target.closest("button")) return;
        const mapRect = refs.mapCanvas.getBoundingClientRect();
        const menuRect = refs.trafficMenu.getBoundingClientRect();
        state.trafficMenuPosition = {
          left: menuRect.left - mapRect.left,
          top: menuRect.top - mapRect.top
        };
        state.trafficMenuDrag = {
          offsetX: event.clientX - menuRect.left,
          offsetY: event.clientY - menuRect.top,
          pointerId: event.pointerId
        };
        refs.trafficMenuDragHandle.classList.add("is-dragging");
        refs.trafficMenuDragHandle.setPointerCapture(event.pointerId);
        event.preventDefault();
      }

      function moveTrafficMenuDrag(event) {
        const drag = state.trafficMenuDrag;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const mapRect = refs.mapCanvas.getBoundingClientRect();
        state.trafficMenuPosition = {
          left: event.clientX - mapRect.left - drag.offsetX,
          top: event.clientY - mapRect.top - drag.offsetY
        };
        positionTrafficMenu();
        event.preventDefault();
      }

      function stopTrafficMenuDrag(event) {
        const drag = state.trafficMenuDrag;
        if (!drag || (event && drag.pointerId !== event.pointerId)) return;
        if (refs.trafficMenuDragHandle.hasPointerCapture(drag.pointerId)) {
          refs.trafficMenuDragHandle.releasePointerCapture(drag.pointerId);
        }
        state.trafficMenuDrag = null;
        refs.trafficMenuDragHandle.classList.remove("is-dragging");
      }

      function parseAirspaceAltitude(value, fallbackFt) {
        const raw = T.clean(value).toUpperCase();
        const fallback = Number.isFinite(Number(fallbackFt)) ? Number(fallbackFt) : 0;
        if (!raw) return { feet: fallback, label: "--", unbounded: false };
        if (/\b(?:UNL|UNLIMITED)\b/.test(raw)) return { feet: Infinity, label: raw, unbounded: true };
        if (/\b(?:GND|SFC|SURFACE)\b/.test(raw)) return { feet: 0, label: raw, unbounded: false };
        const flightLevel = raw.match(/\bFL\s*(\d{1,3})\b/);
        if (flightLevel) return { feet: Number(flightLevel[1]) * 100, label: "FL" + flightLevel[1], unbounded: false };
        const numeric = raw.match(/-?\d+(?:[.,]\d+)?/);
        if (!numeric) return { feet: fallback, label: raw, unbounded: false };
        let feet = Number(numeric[0].replace(",", "."));
        if (/\b(?:M|METRE|METRES|METER|METERS)\b/.test(raw) && !/\bFT\b/.test(raw)) {
          feet *= 3.28084;
        }
        return { feet, label: raw, unbounded: false };
      }

      function medianAltitude(values) {
        const sorted = (values || []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
        if (!sorted.length) return null;
        const middle = Math.floor(sorted.length / 2);
        return Math.round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
      }

      function routePlannedAltitude() {
        return medianAltitude(state.route.map((point) => point && point.altitudeFt));
      }

      function plannedAltitudeInZone(zone, fallback) {
        const segmentValues = [];
        for (let index = 1; index < state.route.length; index += 1) {
          const previous = state.route[index - 1];
          const current = state.route[index];
          if (!T.routeIntersectsZone([previous, current], zone)) continue;
          const values = [previous && previous.altitudeFt, current && current.altitudeFt]
            .map(Number)
            .filter(Number.isFinite);
          if (values.length) segmentValues.push(values.reduce((sum, value) => sum + value, 0) / values.length);
        }
        if (segmentValues.length) return medianAltitude(segmentValues);
        const pointValues = state.route
          .filter((point) => T.zoneContainsPoint(zone, point))
          .map((point) => point.altitudeFt);
        return medianAltitude(pointValues) ?? fallback;
      }

      function currentAircraftAltitude() {
        const fix = animatedGpsPosition(state.gps.fix, Date.now()) || state.gps.fix;
        const altitude = Number(fix && fix.altitudeFt);
        return Number.isFinite(altitude) ? Math.round(altitude) : null;
      }

      function zonesAtPoint(point) {
        const seen = new Set();
        return state.zones.filter((zone) => {
          if (!T.zoneContainsPoint(zone, point)) return false;
          const key = [zone.id, zone.designator, zone.name, zone.lower, zone.upper].map(T.clean).join("|");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).sort((a, b) => {
          const aLower = parseAirspaceAltitude(a.lower).feet;
          const bLower = parseAirspaceAltitude(b.lower).feet;
          return aLower - bLower || T.clean(a.name || a.designator).localeCompare(T.clean(b.name || b.designator));
        });
      }

      function serviceCode(row) {
        const service = T.searchKey([
          row && row.serviceShortLabel,
          row && row.serviceLabel,
          row && row.serviceId,
          row && row.callsign
        ].filter(Boolean).join(" "));
        if (service.includes("TOWER") || service.includes("TWR")) return "TWR";
        if (service.includes("APP") || service.includes("APPROACH") || service.includes("ZBLIZ")) return "APP";
        if (service.includes("ACC") || service.includes("CONTROL")) return "ACC";
        if (service.includes("FIS")) return "FIS";
        if (service.includes("ATIS")) return "ATIS";
        if (service.includes("GROUND") || service.includes("GND")) return "GND";
        if (service.includes("DELIVERY") || service.includes("DEL")) return "DEL";
        if (service.includes("RADIO") || service.includes("RDO")) return "RDO";
        return T.clean(row && (row.serviceShortLabel || row.serviceId || row.serviceLabel)).toUpperCase().slice(0, 6) || "COM";
      }

      function serviceName(row, zone) {
        return T.clean(row && (row.callsign || row.sector || row.serviceLabel)) ||
          T.clean(zone && (zone.name || zone.designator)) || "Service";
      }

      function renderAirspaceProfile(records, currentAltitudeFt) {
        if (!records.length) return "";
        const finiteCeilings = records.map((record) => record.upper.feet).filter(Number.isFinite);
        const finiteFloors = records.map((record) => record.lower.feet).filter(Number.isFinite);
        const planned = records.map((record) => record.plannedAltitudeFt).filter(Number.isFinite);
        const suggestedCeiling = Math.max(
          3000,
          ...finiteCeilings,
          ...finiteFloors,
          ...planned,
          Number.isFinite(currentAltitudeFt) ? currentAltitudeFt : 0,
          records.some((record) => record.upper.unbounded) ? 18000 : 0
        );
        const ceilingFt = Math.ceil((suggestedCeiling + 500) / 1000) * 1000;
        const width = Math.max(292, records.length * 60 + 44);
        const height = 270;
        const plot = { left: 34, right: width - 8, top: 16, bottom: height - 28 };
        const plotHeight = plot.bottom - plot.top;
        const tickCount = 4;
        const tickStepFt = Math.max(1000, Math.ceil((ceilingFt / tickCount) / 1000) * 1000);
        const profileCeilingFt = Math.ceil(ceilingFt / tickStepFt) * tickStepFt;
        const yFor = (feet) => plot.bottom - Math.max(0, Math.min(profileCeilingFt, feet)) / profileCeilingFt * plotHeight;
        const columns = Math.max(1, records.length);
        const columnWidth = (plot.right - plot.left) / columns;
        const grid = Array.from({ length: profileCeilingFt / tickStepFt + 1 }, (_, index) => {
          const feet = tickStepFt * index;
          const y = yFor(feet);
          return '<line x1="' + plot.left + '" x2="' + plot.right + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#dfe7ef" stroke-width="1" />' +
            '<text x="' + (plot.left - 4) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" fill="#65758a" font-size="9" font-weight="700">' + feet + '</text>';
        }).join("");
        const bars = records.map((record, index) => {
          const style = T.TYPE_STYLE[normalizeZoneType(record.zone)] || T.TYPE_STYLE.OTHER;
          const x = plot.left + columnWidth * index + 5;
          const widthForZone = Math.max(14, columnWidth - 10);
          const lowerFt = Math.max(0, record.lower.feet);
          const upperFt = record.upper.unbounded ? profileCeilingFt : Math.max(lowerFt, Math.min(profileCeilingFt, record.upper.feet));
          const top = yFor(upperFt);
          const bottom = yFor(lowerFt);
          const labelY = Math.min(height - 9, plot.bottom + 15);
          const plannedLine = Number.isFinite(record.plannedAltitudeFt)
            ? '<line x1="' + x.toFixed(1) + '" x2="' + (x + widthForZone).toFixed(1) + '" y1="' + yFor(record.plannedAltitudeFt).toFixed(1) + '" y2="' + yFor(record.plannedAltitudeFt).toFixed(1) + '" stroke="#0f7898" stroke-width="2.5" stroke-dasharray="5 3" />'
            : "";
          return '<g><title>' + escapeHtml((record.zone.designator || record.zone.name || record.zone.kind) + ': ' + record.lower.label + ' - ' + record.upper.label) + '</title>' +
            '<rect x="' + x.toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + widthForZone.toFixed(1) + '" height="' + Math.max(2, bottom - top).toFixed(1) + '" rx="3" fill="' + style.stroke + '" fill-opacity="0.38" stroke="' + style.stroke + '" stroke-width="1.4" />' +
            plannedLine +
            '<text x="' + (x + widthForZone / 2).toFixed(1) + '" y="' + labelY + '" text-anchor="middle" fill="#43536a" font-size="10" font-weight="900">' + (index + 1) + '</text></g>';
        }).join("");
        const currentLine = Number.isFinite(currentAltitudeFt)
          ? '<line x1="' + plot.left + '" x2="' + plot.right + '" y1="' + yFor(currentAltitudeFt).toFixed(1) + '" y2="' + yFor(currentAltitudeFt).toFixed(1) + '" stroke="#c4334d" stroke-width="2.2" />' +
            '<text x="' + (plot.right - 2) + '" y="' + (yFor(currentAltitudeFt) - 4).toFixed(1) + '" text-anchor="end" fill="#a51f39" font-size="9" font-weight="900">GPS ' + Math.round(currentAltitudeFt) + ' ft</text>'
          : "";
        return '<svg class="airspace-profile" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Pionowy profil stref">' + grid + bars + currentLine + '</svg>';
      }

      function renderAirspaceInspector(point) {
        const zones = zonesAtPoint(point);
        const defaultPlannedAltitude = routePlannedAltitude();
        const currentAltitudeFt = currentAircraftAltitude();
        const records = zones.map((zone) => ({
          zone,
          lower: parseAirspaceAltitude(zone.lower, 0),
          upper: parseAirspaceAltitude(zone.upper, 18000),
          plannedAltitudeFt: plannedAltitudeInZone(zone, defaultPlannedAltitude)
        }));
        refs.airspaceInspectorTitle.textContent = zones.length ? "Strefy w punkcie" : "Brak stref w punkcie";
        refs.airspaceInspectorMeta.textContent = Number(point.lat).toFixed(5) + ", " + Number(point.lon).toFixed(5) +
          " | GPS " + (Number.isFinite(currentAltitudeFt) ? currentAltitudeFt + " ft" : "brak wysokosci") +
          " | plan " + (Number.isFinite(defaultPlannedAltitude) ? defaultPlannedAltitude + " ft" : "brak wysokosci");
        if (!records.length) {
          refs.airspaceInspectorBody.innerHTML = '<div class="airspace-inspector-empty">W aktywnie wczytanych danych nie ma strefy obejmujacej ten punkt.</div>';
          return;
        }
        const rows = records.map((record, index) => {
          const style = T.TYPE_STYLE[normalizeZoneType(record.zone)] || T.TYPE_STYLE.OTHER;
          const frequencies = uniqueZoneFrequencyRows(infoZoneFrequencyRows(record.zone), record.zone);
          const frequencyRows = frequencies.length
            ? '<div class="airspace-service-list">' + frequencies.map((row) => (
              '<div class="airspace-service-row"><strong>' + escapeHtml(serviceCode(row)) + '</strong><span>' +
              escapeHtml(serviceName(row, record.zone)) + '</span><b>' + escapeHtml(row.frequencyMhz) + '</b></div>'
            )).join("") + '</div>'
            : "";
          const planText = Number.isFinite(record.plannedAltitudeFt)
            ? ' | plan ' + record.plannedAltitudeFt + ' ft'
            : "";
          return '<div class="airspace-zone-row"><span class="airspace-zone-swatch" style="background:' + style.stroke + '"></span><div>' +
            '<div class="airspace-zone-name">' + (index + 1) + '. ' + escapeHtml(record.zone.designator || record.zone.name || record.zone.kind || "Strefa") + '</div>' +
            '<div class="airspace-zone-limits">' + escapeHtml(record.lower.label) + ' - ' + escapeHtml(record.upper.label) + escapeHtml(planText) + '</div>' +
            frequencyRows + '</div></div>';
        }).join("");
        refs.airspaceInspectorBody.innerHTML = '<div class="airspace-inspector-body">' +
          '<section class="airspace-profile-card"><div class="airspace-profile-title">Profil pionowy</div>' +
          renderAirspaceProfile(records, currentAltitudeFt) +
          '<div class="airspace-profile-legend"><span><i></i> planowana wysokosc</span><span><i class="current"></i> aktualna GPS</span></div></section>' +
          '<section class="airspace-inspector-list"><div class="airspace-inspector-list-title">Strefy i sluzby</div>' + rows + '</section></div>';
      }

      function showAirspaceInspector(point, cssX, cssY, rect) {
        state.selectedAirspacePoint = { lat: Number(point.lat), lon: Number(point.lon) };
        hideTrafficMenu({ skipRender: true });
        hidePointMenu({ skipRender: true });
        hideRouteSegmentMenu({ skipRender: true });
        renderAirspaceInspector(state.selectedAirspacePoint);
        refs.airspaceInspector.hidden = false;
        const menuWidth = refs.airspaceInspector.offsetWidth || 560;
        const menuHeight = refs.airspaceInspector.offsetHeight || 360;
        const preferredLeft = cssX + 14;
        const left = preferredLeft + menuWidth <= rect.width - 8
          ? preferredLeft
          : Math.max(8, cssX - menuWidth - 14);
        const top = Math.max(8, Math.min(cssY + 14, rect.height - menuHeight - 8));
        refs.airspaceInspector.style.left = left + "px";
        refs.airspaceInspector.style.top = top + "px";
      }

      function refreshAirspaceInspector() {
        if (!state.selectedAirspacePoint || refs.airspaceInspector.hidden) return;
        renderAirspaceInspector(state.selectedAirspacePoint);
      }

      function hideAirspaceInspector() {
        state.selectedAirspacePoint = null;
        refs.airspaceInspector.hidden = true;
      }

      function showPointMenu(hit, cssX, cssY, rect) {
        state.selectedPoint = { point: hit.point, kind: hit.kind };
        state.selectedPointRestrictionOpen = false;
        state.selectedPointRestrictionAltitudeMode = "at";
        hideTrafficMenu({ skipRender: true });
        hideRouteSegmentMenu({ skipRender: true });
        hideAirspaceInspector();
        refs.pointMenuTitle.textContent = pointDisplayName(hit.point);
        refs.pointMenuMeta.textContent = pointKindLabel(hit.kind) + " | " +
          Number(hit.point.lat).toFixed(5) + ", " + Number(hit.point.lon).toFixed(5);
        updateSelectedPointRouteAction();
        refs.pointMenu.hidden = false;

        const menuWidth = refs.pointMenu.offsetWidth || 230;
        const menuHeight = refs.pointMenu.offsetHeight || 98;
        const left = Math.max(8, Math.min(cssX + 12, rect.width - menuWidth - 8));
        const top = Math.max(8, Math.min(cssY + 12, rect.height - menuHeight - 8));
        refs.pointMenu.style.left = left + "px";
        refs.pointMenu.style.top = top + "px";
        renderMap();
      }

      function hidePointMenu(options) {
        const wasVisible = state.selectedPoint || !refs.pointMenu.hidden;
        state.selectedPoint = null;
        state.selectedPointRestrictionOpen = false;
        refs.pointMenu.hidden = true;
        refs.pointRestrictionEditor.hidden = true;
        if (wasVisible && !(options && options.skipRender)) {
          renderMap();
        }
      }

      function routeSegmentDetail(label, value) {
        return '<div class="route-segment-detail"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong></div>';
      }

      function showRouteSegmentMenu(segment, cssX, cssY, rect) {
        if (!segment) return;
        state.selectedRouteSegment = segment;
        hideTrafficMenu({ skipRender: true });
        hidePointMenu({ skipRender: true });
        hideAirspaceInspector();
        refs.routeSegmentMenuTitle.textContent = "Route segment";
        refs.routeSegmentMenuMeta.textContent = pointDisplayName(segment.from) + " -> " + pointDisplayName(segment.to);
        refs.routeSegmentDetails.innerHTML = [
          routeSegmentDetail("Distance", segment.distanceNm.toFixed(1) + " NM"),
          routeSegmentDetail("Track", String(segment.trackDeg).padStart(3, "0") + " deg"),
          routeSegmentDetail("Time", formatRouteSegmentTime(segment.distanceNm, segment.to && segment.to.speedKt))
        ].join("");
        refs.routeSegmentMenu.hidden = false;
        const menuWidth = refs.routeSegmentMenu.offsetWidth || 300;
        const menuHeight = refs.routeSegmentMenu.offsetHeight || 170;
        const left = Math.max(8, Math.min(cssX + 12, rect.width - menuWidth - 8));
        const top = Math.max(8, Math.min(cssY + 12, rect.height - menuHeight - 8));
        refs.routeSegmentMenu.style.left = left + "px";
        refs.routeSegmentMenu.style.top = top + "px";
      }

      function hideRouteSegmentMenu(options) {
        const wasVisible = state.selectedRouteSegment || !refs.routeSegmentMenu.hidden;
        state.selectedRouteSegment = null;
        refs.routeSegmentMenu.hidden = true;
        if (wasVisible && !(options && options.skipRender)) {
          renderMap();
        }
      }

      function nextRouteWaypointLabel() {
        const highestNumber = state.route.reduce((highest, point) => {
          const match = pointDisplayName(point).match(/^WPT\s*(\d+)$/i);
          return match ? Math.max(highest, Number(match[1])) : highest;
        }, 0);
        return "WPT " + (highestNumber + 1);
      }

      function createWaypointOnSelectedRouteSegment() {
        const segment = state.selectedRouteSegment;
        if (!segment || !segment.point || !Number.isInteger(segment.index)) return;
        const label = nextRouteWaypointLabel();
        const fromAltitude = Number(segment.from && segment.from.altitudeFt);
        const toAltitude = Number(segment.to && segment.to.altitudeFt);
        const altitudeFt = Number.isFinite(fromAltitude) && Number.isFinite(toAltitude)
          ? Math.round(fromAltitude + (toAltitude - fromAltitude) * segment.fraction)
          : (Number.isFinite(fromAltitude) ? Math.round(fromAltitude) : (Number.isFinite(toAltitude) ? Math.round(toAltitude) : null));
        const waypoint = {
          altitudeFt,
          code: label,
          id: label,
          isAirport: false,
          key: label,
          kind: "user-waypoint",
          label,
          lat: Number(segment.point.lat),
          lon: Number(segment.point.lon),
          profileLabels: Array.isArray(point.profileLabels) ? point.profileLabels : [],
          isProfilePoint: Boolean(point.isProfilePoint),
          mapKind: "route",
          name: label
        };
        const nextRoute = state.route.slice();
        nextRoute.splice(segment.index, 0, waypoint);
        window.parent.postMessage({
          type: "nordsweet:routeWaypointCreated",
          waypoint,
          anchor: {
            from: { id: pointDisplayName(segment.from), lat: Number(segment.from.lat), lon: Number(segment.from.lon) },
            to: { id: pointDisplayName(segment.to), lat: Number(segment.to.lat), lon: Number(segment.to.lon) }
          },
          timestamp: Date.now()
        }, "*");
        hideRouteSegmentMenu({ skipRender: true });
        applyRoute(nextRoute, state.unresolved, { preserveDirect: true });
        refs.mapStatus.textContent = label + " added to the route.";
      }

      function handleMapClick(event) {
        if (state.suppressNextMapClick) {
          state.suppressNextMapClick = false;
          return;
        }
        if (!state.viewport) return;
        const rect = refs.mapCanvas.getBoundingClientRect();
        const cssX = event.clientX - rect.left;
        const cssY = event.clientY - rect.top;
        if (cssX < 0 || cssY < 0 || cssX > rect.width || cssY > rect.height) {
          hideTrafficMenu({ skipRender: true });
          hidePointMenu();
          hideRouteSegmentMenu({ skipRender: true });
          hideAirspaceInspector();
          return;
        }
        const trafficHit = findTrafficAt(cssX, cssY, rect);
        if (trafficHit) {
          showTrafficMenu(trafficHit, cssX, cssY, rect);
          return;
        }
        const hit = findPointAt(cssX, cssY, rect);
        if (hit) {
          showPointMenu(hit, cssX, cssY, rect);
        } else {
          const routeSegment = findRouteSegmentAt(cssX, cssY, rect);
          if (routeSegment) {
            showRouteSegmentMenu(routeSegment, cssX, cssY, rect);
            return;
          }
          const point = getMapCoordinateAtCss(cssX, cssY, rect);
          if (point) {
            showAirspaceInspector(point, cssX, cssY, rect);
          } else {
            hideTrafficMenu({ skipRender: true });
            hidePointMenu();
            hideRouteSegmentMenu({ skipRender: true });
            hideAirspaceInspector();
          }
        }
      }

      function drawRoute(ctx, viewport) {
        const route = state.route;
        if (!route.length) return;
        const directActive = Boolean(state.directTo && state.directTo.target);
        ctx.save();
        if (directActive) {
          // The planned route stays visible while Direct To is active, but it is
          // deliberately de-emphasized so the active guidance is unambiguous.
          ctx.globalAlpha = 0.5;
          ctx.setLineDash([9, 7]);
        }
        ctx.lineWidth = 4;
        // Standard FMS route magenta, with a soft halo to remain visible over airspace fills.
        ctx.strokeStyle = "rgba(255, 0, 255, 0.36)";
        ctx.beginPath();
        route.forEach((point, index) => {
          const p = viewport.project(point);
          if (index) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = "#ff00ff";
        ctx.stroke();
        ctx.setLineDash([]);
        route.forEach((point, index) => {
          const p = viewport.project(point);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#ff00ff";
          ctx.stroke();
          ctx.fillStyle = "#d000d0";
          ctx.font = "700 11px system-ui, sans-serif";
          const routeLabel = [point.label || point.icao || point.key || String(index + 1), ...(point.profileLabels || [])].join(" / ");
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3;
          ctx.strokeText(routeLabel, p.x + 7, p.y - 7);
          ctx.fillText(routeLabel, p.x + 7, p.y - 7);
        });
        ctx.restore();
        if (directActive) {
          drawDirectToLeg(ctx, viewport);
        }
      }

      function drawDirectToLeg(ctx, viewport) {
        const direct = state.directTo;
        const target = direct && direct.target;
        const ownship = animatedGpsPosition(state.gps.fix, Date.now());
        if (!target || !ownship || !Number.isFinite(target.lat) || !Number.isFinite(target.lon)) return;

        const start = viewport.project(ownship);
        const end = viewport.project(target);
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = "#ff00ff";
        ctx.stroke();
        ctx.fillStyle = "#ff00ff";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(end.x, end.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#d000d0";
        ctx.font = "700 11px system-ui, sans-serif";
        ctx.fillText("DTO " + pointDisplayName(target), end.x + 10, end.y - 10);
        ctx.restore();
      }

      function toFiniteTrafficNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
      }

      function normalizeTrafficAircraftTypeText(value) {
        const type = String(value || "").trim().toUpperCase();
        return ["", "OGN", "GLIDER", "AIRCRAFT", "UNKNOWN", "MLAT", "ADSB_ICAO", "ADSB_OTHER"].includes(type) ? "" : type;
      }

      function normalizeTrafficPositionSource(row) {
        const values = [
          row && row.positionSource,
          row && row.position_source,
          row && row.surveillanceSource,
          row && row.surveillance_source,
          row && row.type,
          row && row.addr_type,
          row && row.addrType
        ].map((value) => String(value || "").trim().toUpperCase()).filter(Boolean);

        if (row && Array.isArray(row.mlat) && row.mlat.length) return "MLAT";
        if (values.some((value) => value.includes("MLAT"))) return "MLAT";
        if (values.some((value) => value.includes("ADSB") || value.includes("ADS-B"))) return "ADS-B";
        if (values.some((value) => value.includes("ADSR") || value.includes("ADS-R"))) return "ADS-R";
        if (values.some((value) => value.includes("TISB") || value.includes("TIS-B"))) return "TIS-B";
        return "";
      }

      function normalizeTrafficTimestamp(value) {
        if (typeof value === "string" && value.includes("T")) {
          const parsed = Date.parse(value);
          return Number.isFinite(parsed) ? parsed : null;
        }
        const timestamp = toFiniteTrafficNumber(value);
        if (!Number.isFinite(timestamp)) return null;
        return timestamp > 0 && timestamp < 100000000000 ? timestamp * 1000 : timestamp;
      }

      function trafficRowsFromPayload(payload) {
        if (Array.isArray(payload)) return payload;
        if (!payload || typeof payload !== "object") return [];
        return [payload.ac, payload.aircraft, payload.vehicles, payload.items]
          .find((rows) => Array.isArray(rows)) || [];
      }

      function normalizeTrafficHistorySamples(samples) {
        if (!Array.isArray(samples)) return [];
        return samples.map((sample) => {
          const lat = toFiniteTrafficNumber(sample && (sample.lat ?? sample.latitude));
          const lon = toFiniteTrafficNumber(sample && (sample.lon ?? sample.longitude));
          const sampledAt = normalizeTrafficTimestamp(sample && (sample.sampledAt ?? sample.timestampMs ?? sample.time));
          if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(sampledAt)) {
            return null;
          }
          return { lat, lon, sampledAt };
        }).filter(Boolean);
      }

      function normalizeTrafficAircraft(row) {
        const lat = toFiniteTrafficNumber(row && (row.lat ?? row.latitude));
        const lon = toFiniteTrafficNumber(row && (row.lon ?? row.longitude));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

        const positionTime = normalizeTrafficTimestamp(row && row.position_time);
        const seenPositionSeconds = Number.isFinite(positionTime) ? Math.max(0, (Date.now() - positionTime) / 1000) : toFiniteTrafficNumber(row && (row.seen_pos ?? row.seenPos));
        if (Number.isFinite(seenPositionSeconds) && seenPositionSeconds > 180) return null;

        const altitudeRaw = row && (row.altitudeFt ?? row.altitude_ft ?? row.alt_baro ?? row.alt_geom ?? row.altitude);
        const altitudeFt = row && row.on_ground ? null : toFiniteTrafficNumber(altitudeRaw);
        const speedKt = toFiniteTrafficNumber(row && (row.ground_speed_kt ?? row.speedKt ?? row.speed_kt ?? row.groundspeed ?? row.groundSpeed ?? row.gs ?? row.speed ?? row.tas));
        const trackDeg = normalizeHeading(row && (row.trackDeg ?? row.track_deg ?? row.track ?? row.true_heading ?? row.mag_heading));
        const explicitId = String(row && row.id || "").trim().toUpperCase();
        const hex = normalizeTrafficHex(row && (row.hex ?? row.icao ?? row.icao24));
        const identity = getTrafficIdentity(hex);
        const displayName = String(row && row.displayName || "").trim().toUpperCase();
        const callsign = String(row && (row.flight ?? row.callsign) || identity && identity.callsign || "").trim().toUpperCase();
        const rawCallsign = String(row && row.rawCallsign || "").trim().toUpperCase();
        const registrationRaw = String(identity && identity.registration || row && (row.r ?? row.registration) || "").trim().toUpperCase();
        const registration = normalizeTrafficRegistration(registrationRaw);
        const type = normalizeTrafficAircraftTypeText(row && (row.t ?? row.aircraft_type ?? row.aircraftType ?? row.type));
        const positionSource = normalizeTrafficPositionSource(row);
        const source = String(row && (row.source || (Array.isArray(row.sources) ? row.sources.join("+") : "")) || "").trim();
        const sourceLabel = String(row && row.sourceLabel || "").trim();
        const addressType = String(row && row.addressType || "").trim();
        const aircraftModel = String(row && row.aircraftModel || "").trim();
        const competitionNumber = String(row && row.competitionNumber || "").trim().toUpperCase();
        const verticalRateFpm = toFiniteTrafficNumber(row && (row.vertical_rate_fpm ?? row.verticalRateFpm ?? row.vert_rate ?? row.baro_rate));
        const explicitSampledAt = normalizeTrafficTimestamp(row && (row.position_time ?? row.sampledAt ?? row.timestampMs));
        const sampledAt = Number.isFinite(explicitSampledAt)
          ? explicitSampledAt
          : Date.now() - (Number.isFinite(seenPositionSeconds) ? Math.max(0, seenPositionSeconds) * 1000 : 0);
        const history = normalizeTrafficHistorySamples(row && row.history);
        const historyKey = String(row && row.historyKey || "").trim();

        return {
          id: explicitId || hex || [callsign, registration, lat.toFixed(5), lon.toFixed(5)].join("-"),
          lat,
          lon,
          hex,
          callsign,
          rawCallsign,
          registration,
          registrationRaw,
          displayName,
          aircraftModel,
          competitionNumber,
          type,
          positionSource,
          altitudeFt,
          speedKt,
          trackDeg,
          verticalRateFpm,
          seenPositionSeconds,
          sampledAt,
          history,
          historyKey,
          source,
          sourceLabel,
          addressType
        };
      }

      function normalizeTrafficPayload(payload) {
        const uniqueAircraft = new Map();
        trafficRowsFromPayload(payload).forEach((row) => {
          const aircraft = normalizeTrafficAircraft(row);
          if (aircraft) uniqueAircraft.set(aircraft.id, aircraft);
        });
        return Array.from(uniqueAircraft.values());
      }



      function allTrafficAircraft() {
        const aircraft = state.layers.traffic ? state.traffic.aircraft : [];
        return aircraft;
      }

      function refreshSelectedTrafficFromSources() {
        if (!state.selectedTraffic) return;
        const selectedTraffic = allTrafficAircraft().find((item) => item.id === state.selectedTraffic.id);
        if (selectedTraffic) {
          state.selectedTraffic = selectedTraffic;
          updateTrafficMenuHeader(selectedTraffic);
          renderTrafficMenuDetails(selectedTraffic);
          void loadTrafficHistory(selectedTraffic);
          return;
        }
        state.selectedTraffic = null;
        refs.trafficMenu.hidden = true;
      }

      function trafficSampledAt(traffic, now) {
        const sampledAt = Number(traffic && traffic.sampledAt);
        if (Number.isFinite(sampledAt)) return sampledAt;
        return state.traffic.fetchedAt || now;
      }

      function trafficAgeMs(traffic, now) {
        return Math.max(0, now - trafficSampledAt(traffic, now));
      }

      function trafficFadeAlpha(ageMs) {
        if (!Number.isFinite(ageMs) || ageMs <= TRAFFIC_FADE_START_MS) return 1;
        if (ageMs >= TRAFFIC_FADE_END_MS) return 0;
        return 1 - (ageMs - TRAFFIC_FADE_START_MS) / (TRAFFIC_FADE_END_MS - TRAFFIC_FADE_START_MS);
      }

      function gpsFixAgeMs(fix, now) {
        const timestamp = Number(fix && (fix.receivedAt ?? fix.timestamp));
        return Number.isFinite(timestamp) ? Math.max(0, now - timestamp) : 0;
      }

      function hasActiveGpsAnimation(now = Date.now()) {
        return Boolean(
          state.gps.enabled &&
          state.gps.fix &&
          gpsFixAgeMs(state.gps.fix, now) < TRAFFIC_FADE_END_MS
        );
      }

      function animatedGpsPosition(fix, now) {
        if (!fix || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lon)) return null;
        const ageMs = gpsFixAgeMs(fix, now);
        const alpha = trafficFadeAlpha(ageMs);
        if (alpha <= 0) return null;

        let position = { lat: fix.lat, lon: fix.lon };
        const motion = gpsMotion(fix);
        if (motion && motion.moving && ageMs > 0) {
          const distanceNm = Math.max(0, motion.speedKt * Math.min(ageMs, TRAFFIC_FADE_END_MS) / MS_PER_HOUR);
          if (Number.isFinite(distanceNm) && distanceNm > 0) {
            position = T.destinationPoint(fix, motion.headingDeg, distanceNm);
          }
        }

        return Object.assign({}, fix, {
          lat: position.lat,
          lon: position.lon,
          gpsAgeMs: ageMs,
          gpsAlpha: alpha
        });
      }

      function animatedTrafficPosition(traffic, now) {
        if (!traffic || !Number.isFinite(traffic.lat) || !Number.isFinite(traffic.lon)) return null;
        const ageMs = trafficAgeMs(traffic, now);
        const alpha = trafficFadeAlpha(ageMs);
        if (alpha <= 0) return null;

        let position = { lat: traffic.lat, lon: traffic.lon };
        if (Number.isFinite(traffic.trackDeg) && Number.isFinite(traffic.speedKt) && traffic.speedKt > 0 && ageMs > 0) {
          const distanceNm = Math.max(0, traffic.speedKt * Math.min(ageMs, TRAFFIC_FADE_END_MS) / MS_PER_HOUR);
          if (Number.isFinite(distanceNm) && distanceNm > 0) {
            position = T.destinationPoint(traffic, traffic.trackDeg, distanceNm);
          }
        }
        return Object.assign({}, traffic, {
          lat: position.lat,
          lon: position.lon,
          trafficAgeMs: ageMs,
          trafficAlpha: alpha
        });
      }

      function animatedTrafficList(now) {
        return allTrafficAircraft()
          .map((traffic) => animatedTrafficPosition(traffic, now))
          .filter(Boolean);
      }

      function trafficVelocityComponents(speedKt, headingDeg) {
        if (!Number.isFinite(speedKt) || speedKt < 0 || !Number.isFinite(headingDeg)) {
          return { east: 0, north: 0 };
        }
        const radians = headingDeg * Math.PI / 180;
        return {
          east: speedKt * Math.sin(radians),
          north: speedKt * Math.cos(radians)
        };
      }

      function getTrafficAlert(traffic, now = Date.now()) {
        const ownship = animatedGpsPosition(state.gps.fix, now);
        const target = animatedTrafficPosition(traffic, now);
        if (!ownship || !target ||
            !Number.isFinite(ownship.altitudeFt) || !Number.isFinite(target.altitudeFt) ||
            !Number.isFinite(target.speedKt) || !Number.isFinite(target.trackDeg)) {
          return { level: "normal" };
        }

        const ownMotion = gpsMotion(ownship);
        const ownVelocity = ownMotion && ownMotion.moving
          ? trafficVelocityComponents(ownMotion.speedKt, ownMotion.headingDeg)
          : { east: 0, north: 0 };
        const targetVelocity = trafficVelocityComponents(target.speedKt, target.trackDeg);
        const latitudeRadians = ((ownship.lat + target.lat) / 2) * Math.PI / 180;
        const relativeEastNm = (target.lon - ownship.lon) * 60 * Math.cos(latitudeRadians);
        const relativeNorthNm = (target.lat - ownship.lat) * 60;
        const relativeEastKt = targetVelocity.east - ownVelocity.east;
        const relativeNorthKt = targetVelocity.north - ownVelocity.north;
        const relativeSpeedSquared = relativeEastKt * relativeEastKt + relativeNorthKt * relativeNorthKt;

        if (relativeSpeedSquared < 0.25) {
          return { level: "normal" };
        }

        const timeToCpaSeconds = -3600 * (
          relativeEastNm * relativeEastKt + relativeNorthNm * relativeNorthKt
        ) / relativeSpeedSquared;
        if (!Number.isFinite(timeToCpaSeconds) || timeToCpaSeconds < 0 || timeToCpaSeconds > TRAFFIC_CAUTION_TIME_SECONDS) {
          return { level: "normal" };
        }

        const verticalSeparationFt = Math.abs(target.altitudeFt - ownship.altitudeFt);
        if (verticalSeparationFt <= 200 && timeToCpaSeconds <= TRAFFIC_COLLISION_TIME_SECONDS) {
          return { level: "red", timeToCpaSeconds, verticalSeparationFt };
        }
        if (verticalSeparationFt <= 500 &&
            timeToCpaSeconds >= 20 && timeToCpaSeconds <= TRAFFIC_WARNING_TIME_SECONDS) {
          return { level: "amber", timeToCpaSeconds, verticalSeparationFt };
        }
        if (verticalSeparationFt <= 1000) {
          return { level: "caution", timeToCpaSeconds, verticalSeparationFt };
        }
        return { level: "normal" };
      }

      function getTrafficSymbolStyle(traffic, now) {
        const alert = getTrafficAlert(traffic, now);
        if (alert.level === "red") {
          return { alert, fill: "#dc2626", stroke: "#111111" };
        }
        if (alert.level === "amber") {
          return { alert, fill: "#f59e0b", stroke: "#111111" };
        }
        if (alert.level === "caution") {
          return { alert, fill: "#ffffff", stroke: "#111111" };
        }
        return { alert, fill: "#111111", stroke: "rgba(255, 255, 255, 0.98)" };
      }

      function compactTrafficHistorySamples(samples, cutoff) {
        const ordered = samples
          .filter((sample) => sample && Number.isFinite(sample.lat) && Number.isFinite(sample.lon) && Number.isFinite(sample.sampledAt))
          .filter((sample) => sample.sampledAt >= cutoff)
          .sort((a, b) => a.sampledAt - b.sampledAt);
        const compacted = [];
        ordered.forEach((sample) => {
          const position = { lat: sample.lat, lon: sample.lon, sampledAt: sample.sampledAt };
          const previous = compacted[compacted.length - 1];
          if (!previous || T.haversineNm(previous, position) >= TRAFFIC_HISTORY_MIN_MOVEMENT_NM) {
            compacted.push(position);
            return;
          }
          previous.sampledAt = position.sampledAt;
          previous.lat = position.lat;
          previous.lon = position.lon;
        });
        return compacted.slice(-TRAFFIC_HISTORY_MAX_POINTS);
      }

      function updateTrafficHistory(aircraft, sampledAt) {
        const cutoff = sampledAt - TRAFFIC_HISTORY_MAX_AGE_MS;
        const activeIds = new Set();

        aircraft.forEach((item) => {
          const historyKey = trafficHistoryKey(item);
          item.historyKey = historyKey;
          activeIds.add(historyKey);
          const history = state.traffic.historyById.get(historyKey) || state.traffic.historyById.get(item.id) || [];
          const itemSampledAt = Number.isFinite(item.sampledAt) ? item.sampledAt : sampledAt;
          const position = { lat: item.lat, lon: item.lon, sampledAt: itemSampledAt };
          const serverHistory = normalizeTrafficHistorySamples(item.history);

          state.traffic.historyById.set(
            historyKey,
            compactTrafficHistorySamples(history.concat(serverHistory, [position]), cutoff)
          );
          if (historyKey !== item.id) {
            state.traffic.historyById.delete(item.id);
          }
        });

        state.traffic.historyById.forEach((history, id) => {
          const recent = compactTrafficHistorySamples(history, cutoff);
          if (!activeIds.has(id) && !recent.length) {
            state.traffic.historyById.delete(id);
            return;
          }
          state.traffic.historyById.set(id, recent);
        });
      }

      const remoteTrafficHistories = new Map();

      // Fetch the available provider trace on selection, not for every visible aircraft.
      async function loadTrafficHistory(traffic) {
        const hex=String(traffic && traffic.hex || '').toLowerCase();
        if(!/^[0-9a-f]{6}$/.test(hex))return;
        const previous=remoteTrafficHistories.get(hex);
        if(previous && (previous.pending || Date.now()-previous.fetchedAt<60000))return;
        const entry={samples:previous?.samples || [],pending:true,fetchedAt:Date.now(),status:'Loading ADSB.lol history…'};
        remoteTrafficHistories.set(hex,entry);
        const controller=new AbortController();
        const timeout=window.setTimeout(()=>controller.abort(),15000);
        try {
          const response=await fetch(COLLECTOR_TRAFFIC_URL.replace(/\/$/,'')+'/'+hex+'/history',{signal:controller.signal,headers:{Accept:'application/json'}});
          if(!response.ok)throw new Error('HTTP '+response.status);
          const payload=await response.json();
          if(String(payload.hex || '').toLowerCase()!==hex)throw new Error('Aircraft mismatch');
          const samples=normalizeTrafficHistorySamples(payload.history).sort((a,b)=>a.sampledAt-b.sampledAt);
          if(!samples.length)throw new Error('No provider history');
          entry.samples=samples;
          entry.status='ADSB.lol · available history';
        } catch (_error) {
          entry.status=entry.samples.length?'Cached ADSB.lol history':'History unavailable · session track only';
        } finally {
          window.clearTimeout(timeout);
          entry.pending=false;
          while(remoteTrafficHistories.size>8)remoteTrafficHistories.delete(remoteTrafficHistories.keys().next().value);
          if(String(state.selectedTraffic?.hex || '').toLowerCase()===hex){renderTrafficMenuDetails(state.selectedTraffic);renderMap();}
        }
      }

      function selectedTrafficHistory(traffic) {
        if(!traffic)return [];
        const local=state.traffic.historyById.get(trafficHistoryKey(traffic)) || state.traffic.historyById.get(traffic.id) || [];
        const remote=remoteTrafficHistories.get(String(traffic.hex || '').toLowerCase())?.samples || [];
        const last=remote.length?remote[remote.length-1].sampledAt:-Infinity;
        return remote.concat(local.filter(sample=>sample.sampledAt>last));
      }

      function formatTrafficHistory(traffic) {
        const history = selectedTrafficHistory(traffic);
        const source=remoteTrafficHistories.get(String(traffic?.hex || '').toLowerCase())?.status || 'Session track';
        if (history.length < 2) return source;
        const spanMinutes = Math.max(0, Math.round((history[history.length - 1].sampledAt - history[0].sampledAt) / 60000));
        return source + ' · ' + spanMinutes + ' min';
      }

      function trafficQueryForViewport() {
        const viewport = state.viewport;
        if (!viewport) return null;

        const center = viewport.unproject(viewport.width / 2, viewport.height / 2);
        const corners = [
          viewport.unproject(0, 0),
          viewport.unproject(viewport.width, 0),
          viewport.unproject(0, viewport.height),
          viewport.unproject(viewport.width, viewport.height)
        ];
        const edgeDistanceNm = Math.max(...corners.map((corner) => T.haversineNm(center, corner)));
        return {
          lat: Number(center.lat.toFixed(4)),
          lon: Number(center.lon.toFixed(4)),
          distanceNm: Math.max(20, Math.min(TRAFFIC_MAX_DISTANCE_NM, Math.ceil(edgeDistanceNm * 1.12)))
        };
      }

      function defaultTrafficSourceName() {
        return "Aviation Collector · ADSB.lol / ADSB.fi";
      }

      function defaultTrafficSourceHref() {
        return COLLECTOR_TRAFFIC_URL;
      }

      function trafficStatusUrlForEndpoint(endpointUrl) {
        try {
          const url = new URL(endpointUrl, window.location.href);
          if (url.pathname.endsWith("/api/traffic")) {
            url.pathname = url.pathname.replace(/\/api\/traffic$/, "/api/traffic/status");
          }
          return url.toString();
        } catch (error) {
          return endpointUrl || "";
        }
      }

      function updateTrafficStatus() {
        if (!refs.trafficStatus) return;
        const sourceName = state.traffic.sourceName || defaultTrafficSourceName();
        if (refs.trafficAttribution) {
          refs.trafficAttribution.href = state.traffic.sourceHref || defaultTrafficSourceHref();
          refs.trafficAttribution.textContent = "Traffic source: " + sourceName;
        }
        if (!state.layers.traffic) {
          refs.trafficStatus.textContent = sourceName + ": off";
          refs.trafficStatus.style.color = "";
          return;
        }
        if (state.traffic.pending) {
          refs.trafficStatus.textContent = sourceName + ": updating...";
          refs.trafficStatus.style.color = "";
          return;
        }
        if (state.traffic.error) {
          refs.trafficStatus.textContent = sourceName + ": " + state.traffic.error;
          refs.trafficStatus.style.color = "#a81731";
          return;
        }

        const ageSeconds = Math.max(0, Math.floor((Date.now() - state.traffic.fetchedAt) / 1000));
        const radiusText = state.traffic.lastQuery ? " / " + state.traffic.lastQuery.distanceNm + " NM" : "";
        refs.trafficStatus.textContent = sourceName + ": " + state.traffic.aircraft.length + " aircraft" + radiusText + " / " + ageSeconds + " s";
        refs.trafficStatus.style.color = "";
      }









      function scheduleTrafficRefresh(delayMs) {
        if (!hasEnabledTrafficLayers()) return;
        window.clearTimeout(state.traffic.refreshTimer);
        state.traffic.refreshTimer = window.setTimeout(() => {
          state.traffic.refreshTimer = null;
          refreshAllTraffic();
        }, Math.max(0, Number(delayMs) || 0));
      }

      function trafficUrlWithQuery(endpointUrl, query) {
        const url = new URL(endpointUrl, window.location.href);
        url.searchParams.set("lat", String(query.lat));
        url.searchParams.set("lon", String(query.lon));
        url.searchParams.set("radius_nm", String(Math.max(1, Math.min(250, Math.round(query.distanceNm)))));
        return url.toString();
      }

      function trafficEndpointCandidatesForQuery(query) {
        return [{
          sourceName: defaultTrafficSourceName(),
          attributionUrl: defaultTrafficSourceHref(),
          url: trafficUrlWithQuery(COLLECTOR_TRAFFIC_URL, query)
        }];
      }



      function refreshAllTraffic() {
        void refreshTraffic();
      }

      async function refreshTraffic() {
        if (!state.layers.traffic || state.traffic.pending) return;
        const query = trafficQueryForViewport();
        if (!query) return;

        const now = Date.now();
        const waitMs = TRAFFIC_MIN_REQUEST_INTERVAL_MS - (now - state.traffic.lastRequestAt);
        if (waitMs > 0) {
          scheduleTrafficRefresh(waitMs);
          return;
        }

        state.traffic.pending = true;
        state.traffic.error = "";
        state.traffic.lastRequestAt = now;
        updateTrafficStatus();
        const controller = new AbortController();
        state.traffic.abortController = controller;
        const candidates = trafficEndpointCandidatesForQuery(query);

        try {
          const errors = [];
          let payload = null;
          let activeCandidate = null;
          for (const candidate of candidates) {
            try {
              const response = await fetch(candidate.url, {
                cache: "no-store",
                signal: controller.signal,
                headers: Object.assign({ Accept: "application/json" }, candidate.headers || {})
              });
              if (!response.ok) {
                throw new Error("HTTP " + response.status);
              }
              const candidatePayload = await response.json();
              if (candidate.sourceName === "Local traffic" &&
                  candidatePayload &&
                  candidatePayload.source === "local-traffic-server" &&
                  !Number(candidatePayload.lastSuccessAt) &&
                  !trafficRowsFromPayload(candidatePayload).length) {
                throw new Error("local collector has no upstream data yet");
              }
              payload = candidatePayload;
              activeCandidate = candidate;
              break;
            } catch (error) {
              if (error && error.name === "AbortError") throw error;
              errors.push(candidate.sourceName + ": " + (error.message || "request failed"));
            }
          }
          if (!payload) {
            throw new Error(errors.join(" | ") || "request failed");
          }

          if (!state.layers.traffic) return;
          state.traffic.sourceName = String(payload.sourceLabel || (activeCandidate && activeCandidate.sourceName) || defaultTrafficSourceName());
          state.traffic.sourceHref = String(payload.attributionUrl || (activeCandidate && activeCandidate.attributionUrl) || defaultTrafficSourceHref());
          state.traffic.aircraft = activeCandidate && typeof activeCandidate.normalizePayload === "function"
            ? activeCandidate.normalizePayload(payload)
            : normalizeTrafficPayload(payload);
          updateTrafficHistory(state.traffic.aircraft, Date.now());
          refreshSelectedTrafficFromSources();
          state.traffic.lastQuery = query;
          state.traffic.fetchedAt = Date.now();
        } catch (error) {
          if (error && error.name !== "AbortError") {
            state.traffic.error = error.message || "request failed";
          }
        } finally {
          state.traffic.pending = false;
          state.traffic.abortController = null;
          updateTrafficStatus();
          renderMap();
        }
      }

      function trafficAnimationFrame(timestamp) {
        if (!hasEnabledTrafficLayers() && !hasActiveGpsAnimation()) {
          state.traffic.animationFrameId = null;
          return;
        }
        if (!state.traffic.lastAnimationRenderAt ||
            timestamp - state.traffic.lastAnimationRenderAt >= TRAFFIC_ANIMATION_FRAME_MS) {
          state.traffic.lastAnimationRenderAt = timestamp;
          renderMap();
        }
        state.traffic.animationFrameId = window.requestAnimationFrame(trafficAnimationFrame);
      }

      function startTrafficAnimation() {
        if (state.traffic.animationFrameId) return;
        state.traffic.lastAnimationRenderAt = 0;
        state.traffic.animationFrameId = window.requestAnimationFrame(trafficAnimationFrame);
      }

      function stopTrafficAnimation() {
        if (state.traffic.animationFrameId) {
          window.cancelAnimationFrame(state.traffic.animationFrameId);
        }
        state.traffic.animationFrameId = null;
        state.traffic.lastAnimationRenderAt = 0;
      }

      function startTrafficRefresh() {
        window.clearInterval(state.traffic.intervalId);
        window.clearTimeout(state.traffic.refreshTimer);
        state.traffic.intervalId = window.setInterval(refreshAllTraffic, TRAFFIC_REFRESH_MS);
        startTrafficAnimation();
        refreshAllTraffic();
      }

      function stopTrafficRefresh() {
        window.clearInterval(state.traffic.intervalId);
        window.clearTimeout(state.traffic.refreshTimer);
        stopTrafficAnimation();
        state.traffic.intervalId = null;
        state.traffic.refreshTimer = null;
        if (state.traffic.abortController) {
          state.traffic.abortController.abort();
        }
        state.traffic.pending = false;
        updateTrafficStatus();
      }

      function scheduleTrafficViewportRefresh() {
        if (!hasEnabledTrafficLayers()) return;
        const nextQuery = trafficQueryForViewport();
        const previousQuery = state.traffic.lastQuery;
        if (!nextQuery || !previousQuery) {
          scheduleTrafficRefresh(650);
          return;
        }
        const centerDistanceNm = T.haversineNm(nextQuery, previousQuery);
        if (centerDistanceNm >= Math.max(8, previousQuery.distanceNm * 0.2)) {
          scheduleTrafficRefresh(650);
        }
      }

      function isOgnTraffic(item) {
        return String(item && item.source || "").toLowerCase().split("+").includes("ogn");
      }

      function drawTrafficEstimatedSegments(ctx, viewport) {
        const now = Date.now();
        const selectedId = state.selectedTraffic && state.selectedTraffic.id;
        ctx.save();
        allTrafficAircraft().forEach((traffic) => {
          const animated = animatedTrafficPosition(traffic, now);
          if (!animated || !inBounds(traffic) && !inBounds(animated)) return;

          const start = viewport.project(traffic);
          const end = viewport.project(animated);
          const length = Math.hypot(end.x - start.x, end.y - start.y);
          if (!Number.isFinite(length) || length < 3) return;

          const selected = selectedId && traffic.id === selectedId;
          ctx.save();
          ctx.globalAlpha = Number.isFinite(animated.trafficAlpha) ? animated.trafficAlpha : 1;
          ctx.lineCap = "round";
          ctx.setLineDash(selected ? [7, 5] : [4, 5]);

          if (selected) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.44)";
            ctx.lineWidth = 4.6;
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
          }

          ctx.strokeStyle = selected
            ? "rgba(245, 158, 11, 0.42)"
            : "rgba(0, 166, 199, 0.24)";
          ctx.lineWidth = selected ? 2.2 : 1.4;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          ctx.restore();
        });
        ctx.restore();
      }

      function drawTraffic(ctx, viewport) {
        const now = Date.now();
        const aircraft = animatedTrafficList(now).filter(inBounds);
        if (!aircraft.length) return;

        const showLabels = (state.bounds.maxLon - state.bounds.minLon) < 8;
        ctx.save();
        aircraft.forEach((item) => {
          const point = viewport.project(item);
          if (point.x < -24 || point.y < -24 || point.x > viewport.width + 24 || point.y > viewport.height + 24) return;
          const symbolStyle = getTrafficSymbolStyle(item, now);
          ctx.save();
          ctx.globalAlpha = Number.isFinite(item.trafficAlpha) ? item.trafficAlpha : 1;
          ctx.save();
          ctx.translate(point.x, point.y);
          ctx.rotate((item.trackDeg || 0) * Math.PI / 180);
          ctx.fillStyle = symbolStyle.fill;
          ctx.strokeStyle = symbolStyle.stroke;
          ctx.lineWidth = 1.6;
          if (isDroneTraffic(item)) {
            ctx.beginPath();
            ctx.rect(-5.5, -5.5, 11, 11);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-7.5, 0);
            ctx.lineTo(7.5, 0);
            ctx.moveTo(0, -7.5);
            ctx.lineTo(0, 7.5);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.moveTo(0, -9);
            ctx.lineTo(5.5, 7);
            ctx.lineTo(0, 4.5);
            ctx.lineTo(-5.5, 7);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();

          if (showLabels) {
            const identity = getTrafficMapLabel(item);
            if (identity) {
              const trackText = Number.isFinite(item.trackDeg) ? Math.round(item.trackDeg).toString().padStart(3, "0") + " deg" : "TRK --";
              const altitudeText = Number.isFinite(item.altitudeFt) ? Math.round(item.altitudeFt) + " ft" : "ALT --";
              const speedText = Number.isFinite(item.speedKt) ? Math.round(item.speedKt) + " kt" : "SPD --";

              // Keep traffic labels in the same map transform as routes and waypoints.
              // In Track Up mode this makes the names rotate with the chart instead of staying north-up.
              ctx.font = "700 10px system-ui, sans-serif";
              ctx.textAlign = "left";
              ctx.textBaseline = "middle";
              ctx.lineWidth = 3;
              ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
              ctx.strokeText(identity, point.x + 8, point.y - 7);
              ctx.fillStyle = "#064f67";
              ctx.fillText(identity, point.x + 8, point.y - 7);
              ctx.font = "700 9px system-ui, sans-serif";
              ctx.strokeText(trackText + " / " + altitudeText + " / " + speedText, point.x + 8, point.y + 6);
              ctx.fillStyle = "#17633f";
              ctx.fillText(trackText + " / " + altitudeText + " / " + speedText, point.x + 8, point.y + 6);
            }
          }
          ctx.restore();
        });
        ctx.restore();
      }

      function drawSelectedTraffic(ctx, viewport) {
        const traffic = state.selectedTraffic;
        const animated = animatedTrafficPosition(traffic, Date.now());
        if (!animated || !hasEnabledTrafficLayers() || !inBounds(animated)) return;
        const point = viewport.project(animated);
        ctx.save();
        ctx.globalAlpha = Number.isFinite(animated.trafficAlpha) ? animated.trafficAlpha : 1;
        ctx.strokeStyle = "#f59e0b";
        ctx.fillStyle = "rgba(245, 158, 11, 0.16)";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      function drawSelectedTrafficHistory(ctx, viewport) {
        const traffic = state.selectedTraffic;
        const animated = animatedTrafficPosition(traffic, Date.now());
        const history = selectedTrafficHistory(traffic);
        if (!animated || !hasEnabledTrafficLayers() || history.length < 2) return;

        ctx.save();
        ctx.globalAlpha = Number.isFinite(animated.trafficAlpha) ? animated.trafficAlpha : 1;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        history.forEach((sample, index) => {
          const point = viewport.project(sample);
          if (index && sample.sampledAt-history[index-1].sampledAt<=300000) ctx.lineTo(point.x, point.y);
          else ctx.moveTo(point.x, point.y);
        });
        ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
        ctx.lineWidth = 5.2;
        ctx.stroke();

        ctx.beginPath();
        history.forEach((sample, index) => {
          const point = viewport.project(sample);
          if (index && sample.sampledAt-history[index-1].sampledAt<=300000) ctx.lineTo(point.x, point.y);
          else ctx.moveTo(point.x, point.y);
        });
        ctx.strokeStyle = "rgba(245, 158, 11, 0.96)";
        ctx.lineWidth = 2.6;
        ctx.stroke();

        history.forEach((sample, index) => {
          if (index === history.length - 1 || index % 4 !== 0) return;
          const point = viewport.project(sample);
          ctx.beginPath();
          ctx.arc(point.x, point.y, 2.8, 0, Math.PI * 2);
          ctx.fillStyle = "#f59e0b";
          ctx.fill();
        });
        ctx.restore();
      }

      function drawSelectedTrafficTrack(ctx, viewport) {
        const traffic = state.selectedTraffic;
        const animated = animatedTrafficPosition(traffic, Date.now());
        if (!animated || !hasEnabledTrafficLayers() || !inBounds(animated) || !Number.isFinite(traffic.trackDeg) || !Number.isFinite(traffic.speedKt)) return;

        const projectionDistanceNm = Math.max(0, traffic.speedKt * TRAFFIC_TRACK_PROJECTION_MINUTES / 60);
        if (!Number.isFinite(projectionDistanceNm) || projectionDistanceNm <= 0) return;
        const start = viewport.project(animated);
        const end = viewport.project(T.destinationPoint(animated, traffic.trackDeg, projectionDistanceNm));
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        if (!Number.isFinite(length) || length < 8) return;

        const nx = dx / length;
        const ny = dy / length;
        const px = -ny;
        const py = nx;
        ctx.save();
        ctx.globalAlpha = Number.isFinite(animated.trafficAlpha) ? animated.trafficAlpha : 1;
        ctx.strokeStyle = "rgba(0, 166, 199, 0.92)";
        ctx.fillStyle = "#006d85";
        ctx.lineWidth = 2.2;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - nx * 11 + px * 5, end.y - ny * 11 + py * 5);
        ctx.lineTo(end.x - nx * 11 - px * 5, end.y - ny * 11 - py * 5);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      function normalizeHeading(value) {
        if (value === null || value === "") return null;
        const heading = Number(value);
        if (!Number.isFinite(heading)) return null;
        return ((heading % 360) + 360) % 360;
      }

      function bearingBetween(a, b) {
        const lat1 = a.lat * Math.PI / 180;
        const lat2 = b.lat * Math.PI / 180;
        const dLon = (b.lon - a.lon) * Math.PI / 180;
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) -
          Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        return normalizeHeading(Math.atan2(y, x) * 180 / Math.PI);
      }

      function normalizeGpsPosition(position) {
        const coords = position && position.coords;
        if (!coords || coords.latitude == null || coords.longitude == null) return null;
        const lat = Number(coords.latitude);
        const lon = Number(coords && coords.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const accuracyM = coords.accuracy == null ? NaN : Number(coords.accuracy);
        const altitudeM = coords.altitude == null ? NaN : Number(coords.altitude);
        const speedMps = coords.speed == null ? NaN : Number(coords.speed);
        return {
          lat,
          lon,
          accuracyM: Number.isFinite(accuracyM) ? Math.max(0, accuracyM) : null,
          altitudeFt: Number.isFinite(altitudeM) ? altitudeM * 3.28084 : null,
          receivedAt: Date.now(),
          speedMps: Number.isFinite(speedMps) && speedMps >= 0 ? speedMps : null,
          headingDeg: coords.heading == null ? null : normalizeHeading(coords.heading),
          timestamp: Number(position.timestamp) || Date.now()
        };
      }

      function gpsMotion(fix = state.gps.fix) {
        if (!fix) return null;
        let speedKt = Number.isFinite(fix.speedMps) ? fix.speedMps * MPS_TO_KT : null;
        let headingDeg = fix.headingDeg;
        const previous = state.gps.previousFix;

        if (previous && (!Number.isFinite(speedKt) || speedKt < 1 || !Number.isFinite(headingDeg))) {
          const elapsedHours = (fix.timestamp - previous.timestamp) / MS_PER_HOUR;
          const distanceNm = T.haversineNm(previous, fix);
          if (elapsedHours > 0 && distanceNm > 0.003) {
            if (!Number.isFinite(speedKt) || speedKt < 1) {
              speedKt = distanceNm / elapsedHours;
            }
            if (!Number.isFinite(headingDeg)) {
              headingDeg = bearingBetween(previous, fix);
            }
          }
        }

        return {
          speedKt,
          headingDeg,
          moving: Number.isFinite(speedKt) && speedKt >= 1 && Number.isFinite(headingDeg)
        };
      }

      function drawGps(ctx, viewport) {
        const fix = animatedGpsPosition(state.gps.fix, Date.now());
        if (!state.gps.enabled || !fix) return;
        const p = viewport.project(fix);
        const alpha = Number.isFinite(fix.gpsAlpha) ? fix.gpsAlpha : 1;
        ctx.save();
        ctx.globalAlpha = alpha;
        drawGpsTrack(ctx, viewport);
        drawGpsAccuracy(ctx, viewport, fix, p);
        const motion = gpsMotion();
        if (motion && motion.moving) {
          drawGpsVector(ctx, viewport, fix, p, motion);
        }
        drawGpsAirplane(ctx, p, motion && Number.isFinite(motion.headingDeg) ? motion.headingDeg : 0);
        ctx.restore();
      }

      function drawGpsTrack(ctx, viewport) {
        const track = Array.isArray(state.gps.track) ? state.gps.track : [];
        if (track.length < 2) return;

        const drawLine = (color, width) => {
          ctx.beginPath();
          track.forEach((point, index) => {
            const projected = viewport.project(point);
            if (index === 0) ctx.moveTo(projected.x, projected.y);
            else ctx.lineTo(projected.x, projected.y);
          });
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.stroke();
        };

        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        drawLine("rgba(118, 242, 164, 0.28)", 7);
        drawLine("rgba(118, 242, 164, 0.94)", 2.8);
        ctx.restore();
      }

      function appendGpsTrack(fix) {
        if (!fix || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lon)) return;
        const track = Array.isArray(state.gps.track) ? state.gps.track : [];
        const last = track[track.length - 1];
        if (last && T.haversineNm(last, fix) < 0.00001) {
          track[track.length - 1] = fix;
        } else {
          track.push(fix);
        }
        state.gps.track = track.slice(-2400);
      }

      function drawGpsAccuracy(ctx, viewport, fix, p) {
        if (!Number.isFinite(fix.accuracyM) || fix.accuracyM <= 0) return;
        const edge = viewport.project(T.destinationPoint(fix, 90, fix.accuracyM / 1852));
        const radius = Math.abs(edge.x - p.x);
        if (!Number.isFinite(radius) || radius < 3 || radius > Math.max(viewport.width, viewport.height)) return;
        ctx.save();
        ctx.fillStyle = "rgba(36, 79, 134, 0.10)";
        ctx.strokeStyle = "rgba(36, 79, 134, 0.35)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      function drawGpsVector(ctx, viewport, fix, p, motion) {
        const totalDistanceNm = motion.speedKt * 5 / 60;
        const end = viewport.project(T.destinationPoint(fix, motion.headingDeg, totalDistanceNm));
        const dx = end.x - p.x;
        const dy = end.y - p.y;
        const length = Math.hypot(dx, dy);
        if (!Number.isFinite(length) || length < 8) return;
        const nx = dx / length;
        const ny = dy / length;
        const px = -ny;
        const py = nx;

        ctx.save();
        ctx.strokeStyle = "rgba(36, 79, 134, 0.9)";
        ctx.fillStyle = "#244f86";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - nx * 11 + px * 5, end.y - ny * 11 + py * 5);
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - nx * 11 - px * 5, end.y - ny * 11 - py * 5);
        ctx.stroke();

        ctx.font = "700 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        GPS_VECTOR_MINUTES.forEach((minute) => {
          const mark = viewport.project(T.destinationPoint(fix, motion.headingDeg, motion.speedKt * minute / 60));
          const tick = minute === 5 ? 12 : 9;
          ctx.beginPath();
          ctx.moveTo(mark.x - px * tick / 2, mark.y - py * tick / 2);
          ctx.lineTo(mark.x + px * tick / 2, mark.y + py * tick / 2);
          ctx.stroke();
          const labelX = mark.x + px * 12;
          const labelY = mark.y + py * 12;
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
          ctx.strokeText(String(minute), labelX, labelY);
          ctx.fillStyle = "#244f86";
          ctx.fillText(String(minute), labelX, labelY);
          ctx.strokeStyle = "rgba(36, 79, 134, 0.9)";
          ctx.lineWidth = 2;
        });
        ctx.restore();
      }

      function drawGpsAirplane(ctx, p, headingDeg) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((Number(headingDeg) || 0) * Math.PI / 180);
        ctx.fillStyle = "#244f86";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.quadraticCurveTo(2.8, -15, 2.7, -8);
        ctx.lineTo(3.1, -4.4);
        ctx.lineTo(20, -0.8);
        ctx.lineTo(20, 3.2);
        ctx.lineTo(3.5, 1.7);
        ctx.lineTo(2.6, 9.5);
        ctx.lineTo(8.8, 12.1);
        ctx.lineTo(8.8, 15.5);
        ctx.lineTo(2, 13.9);
        ctx.lineTo(1.2, 19);
        ctx.lineTo(-1.2, 19);
        ctx.lineTo(-2, 13.9);
        ctx.lineTo(-8.8, 15.5);
        ctx.lineTo(-8.8, 12.1);
        ctx.lineTo(-2.6, 9.5);
        ctx.lineTo(-3.5, 1.7);
        ctx.lineTo(-20, 3.2);
        ctx.lineTo(-20, -0.8);
        ctx.lineTo(-3.1, -4.4);
        ctx.quadraticCurveTo(-2.8, -15, 0, -18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // C172-style propeller disc and high-wing cabin reference.
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.86)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, -18, 4.2, 0, Math.PI * 2);
        ctx.moveTo(0, -12.5);
        ctx.lineTo(0, 6.5);
        ctx.stroke();
        ctx.restore();
        ctx.restore();
      }

      function gpsErrorText(error) {
        if (!error) return "blad pozycji";
        if (error.code === 1) return "brak zgody";
        if (error.code === 2) return "pozycja niedostepna";
        if (error.code === 3) return "timeout";
        return error.message || "blad pozycji";
      }

      function updateGpsUi() {
        const hasGeolocation = Boolean(navigator.geolocation);
        refs.gpsBtn.disabled = !hasGeolocation;
        refs.gpsBtn.classList.toggle("active", state.gps.enabled);
        if (!hasGeolocation) {
          refs.gpsStatus.textContent = "GPS niedostepny";
          return;
        }
        if (state.gps.error) {
          refs.gpsStatus.textContent = "GPS: " + state.gps.error;
          return;
        }
        if (!state.gps.enabled) {
          refs.gpsStatus.textContent = "GPS off";
          return;
        }
        if (!state.gps.fix) {
          refs.gpsStatus.textContent = "GPS szuka...";
          return;
        }

        const parts = ["GPS"];
        if (Number.isFinite(state.gps.fix.accuracyM)) {
          parts.push(Math.round(state.gps.fix.accuracyM) + " m");
        }
        const motion = gpsMotion();
        if (motion && Number.isFinite(motion.speedKt)) {
          parts.push(Math.round(motion.speedKt) + " kt");
        }
        if (motion && Number.isFinite(motion.headingDeg)) {
          parts.push(Math.round(motion.headingDeg) + " deg");
        }
        refs.gpsStatus.textContent = parts.join(" / ");
      }

      function clearGpsWatch() {
        if (state.gps.watchId != null && navigator.geolocation) {
          navigator.geolocation.clearWatch(state.gps.watchId);
        }
        state.gps.watchId = null;
      }

      function startGps() {
        if (!navigator.geolocation) {
          state.gps.error = "niedostepny";
          updateGpsUi();
          return;
        }
        if (state.gps.watchId != null) return;
        state.gps.enabled = true;
        state.gps.error = "";
        updateGpsUi();
        try {
          state.gps.watchId = navigator.geolocation.watchPosition(handleGpsPosition, handleGpsError, {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 15000
          });
        } catch (error) {
          state.gps.enabled = false;
          state.gps.error = error.message || "nie udalo sie uruchomic";
          clearGpsWatch();
          updateGpsUi();
        }
        renderMap();
      }

      function stopGps() {
        clearGpsWatch();
        state.gps.browserFix = null;
        state.gps.browserPreviousFix = null;
        state.gps.debugActive = false;
        state.gps.enabled = false;
        state.gps.following = false;
        state.gps.manualAnchorRatio = null;
        state.gps.manualPanRatio = { x: 0, y: 0 };
        state.gps.manualSourceRatio = null;
        state.gps.navigationHeadingDeg = null;
        state.gps.fix = null;
        state.gps.previousFix = null;
        state.gps.track = [];
        state.gps.error = "";
        updateGpsUi();
        refreshAirspaceInspector();
        renderMap();
      }

      function handleGpsPosition(position) {
        const fix = normalizeGpsPosition(position);
        if (!fix) {
          handleGpsError({ message: "brak wspolrzednych" });
          return;
        }
        if (state.gps.browserFix && (
          state.gps.browserFix.timestamp !== fix.timestamp ||
          T.haversineNm(state.gps.browserFix, fix) > 0.0001
        )) {
          state.gps.browserPreviousFix = state.gps.browserFix;
        }
        state.gps.browserFix = fix;
        if (state.gps.debugActive) {
          return;
        }
        state.gps.previousFix = state.gps.browserPreviousFix;
        state.gps.fix = fix;
        appendGpsTrack(fix);
        advanceDirectToIfReached(fix);
        state.gps.error = "";
        updateGpsUi();
        refreshAirspaceInspector();
        startTrafficAnimation();
        renderMap();
      }

      function applyExternalGpsMessage(message) {
        if (message && message.type==='nordsweet:setGpsPosition') {
          const fix=normalizeGpsPosition(message.position);
          if (!fix) return false;
          const first=!state.gps.browserFix || state.gps.debugActive;
          state.gps.debugActive=false;
          state.gps.enabled=true;
          if(first) {
            state.gps.following=true;
            centerMapBoundsOnPoint(fix);
          } else if(state.gps.following) centerMapBoundsOnPoint(fix);
          handleGpsPosition(message.position);
          return true;
        }
        if (!message || message.type !== "nordsweet:setGpsSimulation") {
          return false;
        }

        if (!message.active) {
          const wasDebugActive = state.gps.debugActive;
          state.gps.debugActive = false;
          state.gps.following = false;
          state.gps.manualAnchorRatio = null;
          state.gps.manualPanRatio = { x: 0, y: 0 };
          state.gps.manualSourceRatio = null;
          state.gps.navigationHeadingDeg = null;
          if (wasDebugActive) {
            state.gps.fix = state.gps.browserFix;
            state.gps.previousFix = state.gps.browserPreviousFix;
            state.gps.track = state.gps.browserFix ? [state.gps.browserFix] : [];
          }
          updateGpsUi();
          refreshAirspaceInspector();
          startTrafficAnimation();
          renderMap();
          return true;
        }

        const point = message.point || {};
        const lat = Number(point.lat);
        const lon = Number(point.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return true;
        }

        const nextFix = {
          accuracyM: null,
          altitudeFt: Number.isFinite(Number(point.altitudeFt)) ? Number(point.altitudeFt) : null,
          headingDeg: normalizeHeading(point.headingDeg),
          lat,
          lon,
          receivedAt: Number.isFinite(Number(point.receivedAt)) ? Number(point.receivedAt) : Date.now(),
          speedMps: Number.isFinite(Number(point.speedKt)) ? Math.max(0, Number(point.speedKt)) / MPS_TO_KT : null,
          timestamp: Number.isFinite(Number(point.timestamp)) ? Number(point.timestamp) : Date.now()
        };
        const enteringDebug = !state.gps.debugActive;
        if (!enteringDebug && state.gps.fix && (
          state.gps.fix.timestamp !== nextFix.timestamp ||
          T.haversineNm(state.gps.fix, nextFix) > 0.0001
        )) {
          state.gps.previousFix = state.gps.fix;
        } else if (enteringDebug) {
          state.gps.previousFix = null;
          state.gps.track = [];
        }
        state.gps.debugActive = true;
        state.gps.enabled = true;
        if (enteringDebug) {
          state.gps.following = true;
          state.gps.manualAnchorRatio = null;
          state.gps.manualPanRatio = { x: 0, y: 0 };
          state.gps.manualSourceRatio = null;
          const motion = gpsMotion(nextFix);
          state.gps.navigationHeadingDeg = motion && Number.isFinite(motion.headingDeg) ? motion.headingDeg : 0;
        }
        state.gps.error = "";
        state.gps.fix = nextFix;
        if (state.gps.following) {
          centerMapBoundsOnPoint(nextFix);
        }
        appendGpsTrack(nextFix);
        advanceDirectToIfReached(nextFix);
        updateGpsUi();
        refreshAirspaceInspector();
        startTrafficAnimation();
        renderMap();
        return true;
      }

      function handleGpsError(error) {
        state.gps.error = gpsErrorText(error);
        updateGpsUi();
      }

      function isEnrouteInfoZone(zone) {
        const text = T.searchKey([zone && zone.kind, zone && zone.designator, zone && zone.name, zone && zone.classType].filter(Boolean).join(" "));
        return text.includes("FIS") || text.includes("FIR");
      }

      function pointsBounds(points) {
        const list = (points || []).filter((point) => point && Number.isFinite(point.lat) && Number.isFinite(point.lon));
        if (!list.length) return null;
        return {
          minLat: Math.min(...list.map((point) => point.lat)),
          maxLat: Math.max(...list.map((point) => point.lat)),
          minLon: Math.min(...list.map((point) => point.lon)),
          maxLon: Math.max(...list.map((point) => point.lon))
        };
      }

      function zoneBounds(zone) {
        if (zone && zone.shape === "circle" && zone.circle && zone.circle.center) {
          const radiusDeg = (Number(zone.circle.radiusNm) || 0) / 60;
          return {
            minLat: zone.circle.center.lat - radiusDeg,
            maxLat: zone.circle.center.lat + radiusDeg,
            minLon: zone.circle.center.lon - radiusDeg,
            maxLon: zone.circle.center.lon + radiusDeg
          };
        }
        return pointsBounds(zone && zone.points);
      }

      function boundsOverlap(a, b, margin) {
        const pad = Number(margin) || 0;
        return Boolean(a && b &&
          a.minLat <= b.maxLat + pad &&
          a.maxLat >= b.minLat - pad &&
          a.minLon <= b.maxLon + pad &&
          a.maxLon >= b.minLon - pad);
      }

      function zoneMatchesRoute(zone) {
        return T.routeIntersectsZone(state.route, zone);
      }

      function crossedZones() {
        return filteredZones().filter((zone) => zoneMatchesRoute(zone));
      }

      function updateMetrics() {
        const zones = filteredZones();
        refs.metricAirspaces.textContent = zones.length === state.zones.length
          ? state.zones.length
          : zones.length + "/" + state.zones.length;
        refs.metricRoute.textContent = state.route.length;
        refs.metricCrossed.textContent = crossedZones().length;
      }

      async function loadOpenAirApi(key, label) {
        setSourceStatus("Ladowanie " + label + "...");
        try {
          const result = await T.fetchConfiguredSource(key);
          state.zones = hydrateZoneFrequencies(appendStaticAirspaceSupplements(T.parseOpenAir(result.text, label + " (" + result.source + ")")));
          setSourceStatus("Wczytano " + state.zones.length + " stref z " + label + " / " + result.source + ".");
          renderTypeFilters();
          renderMap();
          renderTab();
        } catch (error) {
          setSourceStatus("Nie udalo sie wczytac stref: " + error.message, true);
        }
      }

      async function loadAupApi(key, mode, label) {
        try {
          const result = await T.fetchConfiguredSource(key);
          state[mode] = T.parsePansaAup(result.text, label + " (" + result.source + ")");
          renderMap();
          renderTab();
        } catch (error) {
          refs.mapStatus.textContent = "AUP " + label + " nie zostal wczytany; strefy moga dzialac bez AUP.";
        }
      }

      async function loadCzechGeometry() {
        try {
          const result = await T.fetchConfiguredSource("czech_geometry", { preferProxy: false, direct: false });
          const zones = T.parseCzechLkr320a(result.text, "LKR320A (" + result.source + ")");
          if (!zones.length) {
            throw new Error("LKR320A contains no supported polygon geometry");
          }
          window.NORDSWEET_STATIC_AIRSPACE_ZONES = window.NORDSWEET_STATIC_AIRSPACE_ZONES || {};
          window.NORDSWEET_STATIC_AIRSPACE_ZONES.czech = {
            generatedAt: new Date().toISOString(),
            source: "ANS CR LKR320A",
            zones
          };
          state.zones = hydrateZoneFrequencies(appendStaticAirspaceSupplements(state.zones));
          renderTypeFilters();
          renderMap();
          renderTab();
        } catch (error) {
          console.info("Czech LKR320A geometry was not loaded:", error && error.message ? error.message : error);
        }
      }

      async function loadCzechAupApi(key, mode, label) {
        try {
          const result = await T.fetchConfiguredSource(key, { direct: false });
          state[mode] = T.parseCzechAupPackage(result.text, label + " (" + result.source + ")");
          renderMap();
          renderTab();
        } catch (error) {
          console.info("Czech AUP/UUP was not loaded:", error && error.message ? error.message : error);
        }
      }

      async function refreshCupApi() {
        setSourceStatus("Ladowanie AERODROMES_URL...");
        try {
          const result = await T.fetchConfiguredSource("aerodromes");
          window.NORDSWEET_CUP_API_DATA = T.parseCup(result.text, "AERODROMES_URL (" + result.source + ")");
          state.pointIndex = T.buildPointIndex();
          buildRoute();
          setSourceStatus("CUP API: " + window.NORDSWEET_CUP_API_DATA.airports.length + " lotnisk/ladowisk i " + window.NORDSWEET_CUP_API_DATA.points.length + " punktow VFR.");
          renderMap();
          renderTab();
        } catch (error) {
          setSourceStatus("Nie udalo sie wczytac CUP API: " + error.message, true);
        }
      }

      function applyRoute(points, unresolved, options) {
        state.route = (points || []).filter((point) =>
          point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon))
        );
        if (!(options && options.preserveDirect)) {
          state.directTo = null;
        }
        state.unresolved = unresolved || [];
        refs.mapStatus.textContent = state.route.length
          ? "Trasa: " + state.route.map(pointDisplayName).join(" - ")
          : "Brak trasy.";
        refreshAirspaceInspector();
        renderMap();
        renderTab();
      }

      function buildRoute() {
        state.pointIndex = state.pointIndex || T.buildPointIndex();
        const resolved = T.resolveRoute(refs.routeInput.value, state.pointIndex);
        state.routeInputSynced = true;
        applyRoute(resolved.points, resolved.unresolved);
      }

      function normalizeExternalRoutePoint(point, index) {
        const lat = Number(point && point.lat);
        const lon = Number(point && point.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return null;
        }

        const id = String(point.id || point.code || point.icao || point.name || ("PT" + (index + 1))).trim();
        const rawRestriction = point && point.restriction && typeof point.restriction === "object"
          ? point.restriction
          : null;
        const restrictedSpeedKt = Number(rawRestriction && rawRestriction.speedKt);
        const restrictedAltitudeFt = rawRestriction && rawRestriction.altitudeFt != null && String(rawRestriction.altitudeFt).trim() !== ""
          ? Number(rawRestriction.altitudeFt)
          : NaN;
        const altitudeMode = ["below", "at", "above"].includes(String(rawRestriction && rawRestriction.altitudeMode || "").toLowerCase())
          ? String(rawRestriction.altitudeMode).toLowerCase()
          : "at";
        const restriction = {};
        if (Number.isFinite(restrictedSpeedKt) && restrictedSpeedKt > 0) {
          restriction.speedKt = Math.round(restrictedSpeedKt);
        }
        if (Number.isFinite(restrictedAltitudeFt) && restrictedAltitudeFt >= 0) {
          restriction.altitudeFt = Math.round(restrictedAltitudeFt);
          restriction.altitudeMode = altitudeMode;
        }
        return {
          airportIcao: String(point.airportIcao || point.icao || "").trim().toUpperCase(),
          altitudeFt: Number(point.altitudeFt),
          id,
          code: id,
          isAirport: Boolean(point.isAirport),
          key: id,
          kind: String(point.kind || "").trim().toLowerCase(),
          lat,
          lon,
          name: String(point.name || id || ("Point " + (index + 1))).trim(),
          mapKind: "route",
          restriction: Object.keys(restriction).length ? restriction : null,
          speedKt: Number(point.speedKt)
        };
      }

      function routeGeometryMatches(currentRoute, nextRoute) {
        if (!Array.isArray(currentRoute) || !Array.isArray(nextRoute) || currentRoute.length !== nextRoute.length) {
          return false;
        }

        // The flight UI re-sends its route when a side panel opens. Preserve a
        // manually chosen map view unless the actual route geometry changed.
        return currentRoute.every((point, index) => {
          const nextPoint = nextRoute[index];
          return Math.abs(Number(point.lat) - Number(nextPoint.lat)) < 0.000001 &&
            Math.abs(Number(point.lon) - Number(nextPoint.lon)) < 0.000001;
        });
      }

      function applyExternalRouteMessage(message) {
        if (!message || message.type !== "nordsweet:setRoute") {
          return;
        }

        const previousRouteText = refs.routeInput.value;
        const suppliedCruiseSpeedKt = Number(message.cruiseSpeedKt);
        state.routeCruiseSpeedKt = Number.isFinite(suppliedCruiseSpeedKt) && suppliedCruiseSpeedKt > 0
          ? suppliedCruiseSpeedKt
          : 0;
        if (typeof message.routeText === "string") {
          refs.routeInput.value = message.routeText;
        }

        const points = Array.isArray(message.points)
          ? message.points.map(normalizeExternalRoutePoint).filter(Boolean)
          : [];
        if (points.length) {
          const geometryChanged = !routeGeometryMatches(state.route, points);
          state.routeInputSynced = false;
          applyRoute(points, [], { preserveDirect: !geometryChanged });
          if (geometryChanged) {
            fitRoute();
          }
          return;
        }

        if (refs.routeInput.value.trim()) {
          const routeTextChanged = previousRouteText.trim() !== refs.routeInput.value.trim();
          buildRoute();
          if (routeTextChanged) {
            fitRoute();
          }
        }
      }

      function formatRouteDmsToken(value, isLon) {
        const hemisphere = value < 0 ? (isLon ? "W" : "S") : (isLon ? "E" : "N");
        let abs = Math.abs(Number(value) || 0);
        let degrees = Math.floor(abs);
        abs = (abs - degrees) * 60;
        let minutes = Math.floor(abs);
        let seconds = Math.round((abs - minutes) * 60);
        if (seconds >= 60) {
          seconds = 0;
          minutes += 1;
        }
        if (minutes >= 60) {
          minutes = 0;
          degrees += 1;
        }
        return String(degrees).padStart(isLon ? 3 : 2, "0") +
          String(minutes).padStart(2, "0") +
          String(seconds).padStart(2, "0") +
          hemisphere;
      }

      function routeTokenForPoint(point) {
        state.pointIndex = state.pointIndex || T.buildPointIndex();
        const candidates = [
          point && point.icao,
          point && point.cupCode,
          point && point.code,
          point && point.key,
          point && point.id,
          point && point.cup && point.cup.shortCode,
          point && point.cup && point.cup.code,
          point && point.navaid && point.navaid.code,
          point && point.name
        ].map((value) => String(value || "").trim()).filter(Boolean);
        const alias = candidates.find((value) => !/\s/.test(value) && state.pointIndex.has(T.searchKey(value)));
        if (alias) return alias.toUpperCase();
        const lat = Number(point && point.lat);
        const lon = Number(point && point.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
        return formatRouteDmsToken(lat, false) + " " + formatRouteDmsToken(lon, true);
      }

      function syncRouteInputWithPoint(routePoint, nextRoute) {
        const token = routeTokenForPoint(routePoint);
        if (!token) return;
        if (!state.routeInputSynced) {
          refs.routeInput.value = (nextRoute || []).map(routeTokenForPoint).filter(Boolean).join(" ");
          state.routeInputSynced = true;
          return;
        }
        const current = refs.routeInput.value.trim();
        refs.routeInput.value = current ? current + " " + token : token;
      }

      function routePointMatchesSelectedPoint(routePoint, selectedPoint) {
        if (!routePoint || !selectedPoint) return false;
        const identityKeys = (point) => [
          point.icao,
          point.cupCode,
          point.code,
          point.key,
          point.id,
          point.cup && point.cup.shortCode,
          point.cup && point.cup.code
        ].map((value) => T.searchKey(value)).filter(Boolean);
        const selectedKeys = new Set(identityKeys(selectedPoint));
        if (identityKeys(routePoint).some((key) => selectedKeys.has(key))) {
          return true;
        }
        return Math.abs(Number(routePoint.lat) - Number(selectedPoint.lat)) < 0.000001 &&
          Math.abs(Number(routePoint.lon) - Number(selectedPoint.lon)) < 0.000001;
      }

      function selectedPointRouteIndices() {
        const selectedPoint = state.selectedPoint && state.selectedPoint.point;
        if (!selectedPoint) return [];
        return state.route.reduce((indices, routePoint, index) => {
          if (routePointMatchesSelectedPoint(routePoint, selectedPoint)) {
            indices.push(index);
          }
          return indices;
        }, []);
      }

      function getSelectedRoutePoint() {
        const routeIndex = selectedPointRouteIndices()[0];
        return Number.isInteger(routeIndex) && state.route[routeIndex]
          ? { point: state.route[routeIndex], routeIndex }
          : null;
      }

      function isGeneratedRouteProfilePoint(point) {
        const key = pointDisplayName(point).toUpperCase();
        return Boolean(point && point.isProfilePoint) || ["TOC", "TOD", "SOC"].includes(key);
      }

      function setSelectedPointRestrictionMode(mode) {
        state.selectedPointRestrictionAltitudeMode = ["below", "at", "above"].includes(mode) ? mode : "at";
        if (!refs.pointRestrictionMode) return;
        refs.pointRestrictionMode.querySelectorAll("[data-restriction-altitude-mode]").forEach((button) => {
          const isActive = button.dataset.restrictionAltitudeMode === state.selectedPointRestrictionAltitudeMode;
          button.classList.toggle("active", isActive);
          button.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
      }

      function populateSelectedPointRestrictionEditor() {
        const selected = getSelectedRoutePoint();
        const point = selected && selected.point ? selected.point : null;
        const restriction = point && point.restriction
          ? point.restriction
          : {};
        const speedKt = Number(restriction.speedKt);
        const altitudeFt = Number(restriction.altitudeFt);
        const plannedSpeedKt = Number(point && point.speedKt);
        const plannedAltitudeFt = Number(point && point.altitudeFt);
        const cruiseSpeedKt = Number(state.routeCruiseSpeedKt);
        const suggestedSpeedKt = Number.isFinite(plannedSpeedKt) && plannedSpeedKt > 0
          ? plannedSpeedKt
          : cruiseSpeedKt;

        // Existing pilot restrictions always win. Otherwise prefill the exact
        // speed and altitude currently calculated for this route point.
        refs.pointRestrictionSpeed.value = Number.isFinite(speedKt) && speedKt > 0
          ? String(Math.round(speedKt))
          : (Number.isFinite(suggestedSpeedKt) && suggestedSpeedKt > 0 ? String(Math.round(suggestedSpeedKt)) : "");
        refs.pointRestrictionAltitude.value = Number.isFinite(altitudeFt) && altitudeFt >= 0
          ? String(Math.round(altitudeFt))
          : (Number.isFinite(plannedAltitudeFt) && plannedAltitudeFt >= 0 ? String(Math.round(plannedAltitudeFt)) : "");
        setSelectedPointRestrictionMode(restriction.altitudeMode);
      }

      function toggleSelectedPointRestrictionEditor() {
        const selected = getSelectedRoutePoint();
        if (!selected || isGeneratedRouteProfilePoint(selected.point)) return;
        state.selectedPointRestrictionOpen = !state.selectedPointRestrictionOpen;
        refs.pointRestrictionEditor.hidden = !state.selectedPointRestrictionOpen;
        if (state.selectedPointRestrictionOpen) {
          populateSelectedPointRestrictionEditor();
        }
      }

      function updateSelectedPointRestrictionEditor() {
        const selected = getSelectedRoutePoint();
        const isAvailable = Boolean(selected && !isGeneratedRouteProfilePoint(selected.point));
        refs.pointRestrictionBtn.hidden = !isAvailable;
        refs.pointRestrictionBtn.disabled = !isAvailable;
        if (!isAvailable) {
          state.selectedPointRestrictionOpen = false;
        }
        refs.pointRestrictionEditor.hidden = !isAvailable || !state.selectedPointRestrictionOpen;
      }

      function sendSelectedPointRestriction(restriction) {
        const selected = getSelectedRoutePoint();
        if (!selected || isGeneratedRouteProfilePoint(selected.point)) return;
        const point = selected.point;
        const hasRestriction = restriction && Object.keys(restriction).length > 0;
        point.restriction = hasRestriction ? restriction : null;
        window.parent.postMessage({
          type: "nordsweet:routePointRestrictionUpdated",
          point: {
            id: point.id,
            kind: point.kind || "",
            lat: Number(point.lat),
            lon: Number(point.lon),
            name: pointDisplayName(point)
          },
          restriction: hasRestriction ? restriction : null,
          routeIndex: selected.routeIndex,
          timestamp: Date.now()
        }, "*");
        refs.mapStatus.textContent = hasRestriction
          ? "Restriction: " + pointDisplayName(point) + "."
          : "Restriction cleared: " + pointDisplayName(point) + ".";
        renderMap();
      }

      function applySelectedPointRestriction() {
        const restriction = {};
        const speedKt = Number(refs.pointRestrictionSpeed.value);
        const altitudeFt = Number(refs.pointRestrictionAltitude.value);
        if (Number.isFinite(speedKt) && speedKt > 0) {
          restriction.speedKt = Math.round(speedKt);
        }
        if (Number.isFinite(altitudeFt) && altitudeFt >= 0) {
          restriction.altitudeFt = Math.round(altitudeFt);
          restriction.altitudeMode = state.selectedPointRestrictionAltitudeMode;
        }
        sendSelectedPointRestriction(restriction);
      }

      function clearSelectedPointRestriction() {
        refs.pointRestrictionSpeed.value = "";
        refs.pointRestrictionAltitude.value = "";
        setSelectedPointRestrictionMode("at");
        sendSelectedPointRestriction(null);
      }

      function updateSelectedPointRouteAction() {
        const selectedPoint = state.selectedPoint && state.selectedPoint.point;
        const isInRoute = selectedPointRouteIndices().length > 0;
        const isAirport = Boolean(
          selectedPoint && (
            selectedPoint.isAirport ||
            selectedPoint.kind === "airport" ||
            selectedPoint.kind === "threshold" ||
            (state.selectedPoint && (state.selectedPoint.kind === "airport" || state.selectedPoint.kind === "threshold"))
          )
        );
        refs.addPointToRouteBtn.textContent = isInRoute ? "Remove From Route" : "Add To Route";
        refs.addPointToRouteBtn.classList.toggle("primary", !isInRoute);
        refs.directToPointBtn.disabled = !state.selectedPoint || !state.selectedPoint.point;
        refs.pointWxBtn.hidden = !isInRoute;
        refs.pointWxBtn.disabled = !isInRoute;
        updateSelectedPointRestrictionEditor();
        refs.pointAirportActions.hidden = !isAirport;
        refs.pointNotamBtn.disabled = !isAirport;
        refs.pointChartBtn.disabled = !isAirport;
      }

      function requestSelectedPointWeather() {
        if (!state.selectedPoint || !state.selectedPoint.point) return;
        const routeIndex = selectedPointRouteIndices()[0];
        if (!Number.isInteger(routeIndex) || !state.route[routeIndex]) return;
        const point = state.route[routeIndex];
        const airportIcao = String(point.airportIcao || "").trim().toUpperCase();
        const isAirport = Boolean(point.isAirport || point.kind === "airport" || point.kind === "threshold");
        window.parent.postMessage({
          type: "nordsweet:routePointWxRequested",
          point: {
            airportIcao,
            altitudeFt: Number(point.altitudeFt),
            id: point.id,
            isAirport,
            kind: point.kind || "",
            lat: Number(point.lat),
            lon: Number(point.lon),
            name: pointDisplayName(point)
          },
          routeIndex,
          timestamp: Date.now()
        }, "*");
        hidePointMenu({ skipRender: true });
        refs.mapStatus.textContent = "WX: " + pointDisplayName(point) + ".";
      }

      function requestSelectedAirportInformation(panel) {
        const selected = state.selectedPoint && state.selectedPoint.point;
        if (!selected) return;

        const airportIcao = String(selected.airportIcao || selected.icao || selected.code || selected.id || "").trim().toUpperCase();
        window.parent.postMessage({
          type: "nordsweet:airportInformationRequested",
          panel: panel === "chart" ? "chart" : "notam",
          point: {
            airportIcao,
            id: selected.id,
            isAirport: true,
            kind: selected.kind || (state.selectedPoint && state.selectedPoint.kind) || "airport",
            lat: Number(selected.lat),
            lon: Number(selected.lon),
            name: pointDisplayName(selected)
          },
          timestamp: Date.now()
        }, "*");
        hidePointMenu({ skipRender: true });
        refs.mapStatus.textContent = (panel === "chart" ? "Chart" : "NOTAM") + ": " + pointDisplayName(selected) + ".";
      }

      function directToRoutePoint(point) {
        const lat = Number(point && point.lat);
        const lon = Number(point && point.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return Object.assign({}, point, {
          lat,
          lon,
          label: pointDisplayName(point),
          mapKind: point.mapKind || "point"
        });
      }

      function findNextDirectRouteIndex(target) {
        const routeIndices = state.route.reduce((indices, routePoint, index) => {
          if (routePointMatchesSelectedPoint(routePoint, target)) indices.push(index);
          return indices;
        }, []);
        if (routeIndices.length) return Math.min(state.route.length - 1, routeIndices[0] + 1);
        if (!state.route.length) return -1;

        let nearestIndex = 0;
        let nearestDistance = Infinity;
        state.route.forEach((routePoint, index) => {
          const distance = T.haversineNm(target, routePoint);
          if (Number.isFinite(distance) && distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        });
        return nearestIndex;
      }

      function activateDirectToSelectedPoint() {
        const selected = state.selectedPoint && state.selectedPoint.point;
        const target = directToRoutePoint(selected);
        if (!target) return;
        const routeIndex = selectedPointRouteIndices()[0];
        state.directTo = {
          reachedRouteIndex: Number.isInteger(routeIndex) ? routeIndex : null,
          resumeRouteIndex: findNextDirectRouteIndex(target),
          target,
          startedAt: Date.now()
        };
        refs.mapStatus.textContent = "Direct to: " + pointDisplayName(target) + ".";
        hidePointMenu({ skipRender: true });
        window.parent.postMessage({
          type: "nordsweet:directToActivated",
          point: {
            id: pointDisplayName(target),
            lat: target.lat,
            lon: target.lon,
            name: pointDisplayName(target)
          },
          timestamp: state.directTo.startedAt
        }, "*");
        renderMap();
      }

      function advanceDirectToIfReached(fix) {
        const direct = state.directTo;
        if (!direct || !direct.target || !fix) return;
        const distanceNm = T.haversineNm(fix, direct.target);
        if (!Number.isFinite(distanceNm) || distanceNm >= 0.5) return;

        const nextIndex = Number(direct.resumeRouteIndex);
        if (Number.isInteger(nextIndex) && state.route[nextIndex]) {
          direct.target = directToRoutePoint(state.route[nextIndex]);
          direct.reachedRouteIndex = nextIndex;
          direct.resumeRouteIndex = nextIndex < state.route.length - 1 ? nextIndex + 1 : -1;
          refs.mapStatus.textContent = "Direct to: " + pointDisplayName(direct.target) + ".";
          window.parent.postMessage({
            type: "nordsweet:directToAdvanced",
            point: {
              id: pointDisplayName(direct.target),
              lat: direct.target.lat,
              lon: direct.target.lon,
              name: pointDisplayName(direct.target)
            },
            timestamp: Date.now()
          }, "*");
        } else {
          const completedTarget = direct.target;
          state.directTo = null;
          refs.mapStatus.textContent = "Direct complete: " + pointDisplayName(completedTarget) + ".";
          window.parent.postMessage({
            type: "nordsweet:directToCompleted",
            point: {
              id: pointDisplayName(completedTarget),
              lat: completedTarget.lat,
              lon: completedTarget.lon,
              name: pointDisplayName(completedTarget)
            },
            timestamp: Date.now()
          }, "*");
        }
        renderMap();
      }

      function removePointTokenFromRouteInput(point) {
        const token = routeTokenForPoint(point);
        const routeText = refs.routeInput.value.trim();
        if (!token || !routeText) return false;
        const inputTokens = routeText.split(/\s+/);
        const targetTokens = token.split(/\s+/);
        for (let index = inputTokens.length - targetTokens.length; index >= 0; index -= 1) {
          const matches = targetTokens.every((target, offset) =>
            T.searchKey(inputTokens[index + offset]) === T.searchKey(target)
          );
          if (matches) {
            inputTokens.splice(index, targetTokens.length);
            refs.routeInput.value = inputTokens.join(" ");
            state.routeInputSynced = true;
            return true;
          }
        }
        return false;
      }

      function addSelectedPointToRoute() {
        if (!state.selectedPoint || !state.selectedPoint.point) return;
        if (selectedPointRouteIndices().length) {
          removeSelectedPointFromRoute();
          return;
        }
        const point = state.selectedPoint.point;
        const lat = Number(point.lat);
        const lon = Number(point.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        const routePoint = Object.assign({}, point, {
          lat,
          lon,
          label: pointDisplayName(point),
          mapKind: point.mapKind || state.selectedPoint.kind || "point"
        });
        const nextRoute = state.route.concat(routePoint);
        syncRouteInputWithPoint(routePoint, nextRoute);
        hidePointMenu({ skipRender: true });
        applyRoute(nextRoute, state.unresolved);
      }

      function removeSelectedPointFromRoute() {
        if (!state.selectedPoint || !state.selectedPoint.point) return;
        const point = state.selectedPoint.point;
        const routeIndices = selectedPointRouteIndices();
        if (!routeIndices.length) return;
        const routeIndex = routeIndices[routeIndices.length - 1];
        const nextRoute = state.route.filter((_routePoint, index) => index !== routeIndex);
        const removedFromInput = removePointTokenFromRouteInput(point);
        hidePointMenu({ skipRender: true });
        if (removedFromInput) {
          buildRoute();
          return;
        }
        state.routeInputSynced = false;
        applyRoute(nextRoute, state.unresolved);
      }

      function fitRoute() {
        if (!state.route.length) {
          state.bounds = Object.assign({}, T.DEFAULT_BOUNDS);
        } else {
          const lats = state.route.map((point) => point.lat);
          const lons = state.route.map((point) => point.lon);
          state.bounds = T.expandBounds({
            minLat: Math.min(...lats),
            maxLat: Math.max(...lats),
            minLon: Math.min(...lons),
            maxLon: Math.max(...lons)
          }, 0.35);
        }
        renderMap();
      }

      function renderTab() {
        document.querySelectorAll(".tab").forEach((tab) => {
          tab.classList.toggle("active", tab.dataset.tab === state.activeTab);
        });
        if (state.activeTab === "radio") {
          renderRadioTab();
        } else if (state.activeTab === "zones") {
          renderZonesTab();
        } else {
          renderRouteTab();
        }
      }

      function renderRouteTab() {
        const rows = state.route.map((point, index) => (
          "<div class=\"point-line\"><span class=\"tag\">" + (index + 1) + "</span><span>" +
          escapeHtml(point.label || point.icao || point.key || point.id || point.name || "Punkt") +
          "</span><span class=\"muted\">" + point.lat.toFixed(4) + ", " + point.lon.toFixed(4) + "</span></div>"
        )).join("");
        const unresolved = state.unresolved.length
          ? "<div class=\"card\"><div class=\"card-title\">Nierozpoznane</div><div class=\"muted\">" + escapeHtml(state.unresolved.join(", ")) + "</div></div>"
          : "";
        refs.tabBody.innerHTML = (
          "<div class=\"card\"><div class=\"card-title\">Punkty trasy<span class=\"tag\">" + state.route.length + "</span></div>" +
          (rows || "<div class=\"muted\">Wpisz trase lub wgraj GPX.</div>") + "</div>" + unresolved
        );
      }

      function frequencyValue(row) {
        return T.clean(row && (row.frequencyMhz || row.frequency || row.mhz || row.value));
      }

      function frequencyTag(row, zone) {
        return T.clean(row && (row.serviceShortLabel || row.serviceLabel || row.serviceId)) || normalizeZoneType(zone);
      }

      function normalizeZoneFrequencyRows(zone) {
        const rows = Array.isArray(zone && zone.frequencies) ? zone.frequencies : [];
        return rows.map((entry) => {
          const row = typeof entry === "string" ? { frequencyMhz: entry } : Object.assign({}, entry || {});
          const frequencyMhz = frequencyValue(row);
          return frequencyMhz ? Object.assign(row, { frequencyMhz }) : null;
        }).filter(Boolean);
      }

      function uniqueZoneFrequencyRows(rows, zone) {
        const seen = new Set();
        return rows.filter((row) => {
          const key = [zone && zone.id, row.serviceId, row.frequencyMhz, row.callsign, row.sector].map(T.searchKey).join("|");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      function segmentFraction(point, a, b) {
        if (!point || !a || !b) return 0;
        const latScale = Math.cos(((a.lat + b.lat + point.lat) / 3) * Math.PI / 180) || 1;
        const ax = a.lon * latScale;
        const ay = a.lat;
        const bx = b.lon * latScale;
        const by = b.lat;
        const px = point.lon * latScale;
        const py = point.lat;
        const dx = bx - ax;
        const dy = by - ay;
        const lengthSq = dx * dx + dy * dy;
        if (lengthSq <= 1e-12) return 0;
        return Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
      }

      function routeProgressToPoint(route, point) {
        if (!point || !route.length) return Infinity;
        if (route.length === 1) return T.haversineNm(route[0], point);
        let travelled = 0;
        let bestDistance = Infinity;
        let bestProgress = Infinity;
        for (let index = 1; index < route.length; index += 1) {
          const a = route[index - 1];
          const b = route[index];
          const segmentLength = T.haversineNm(a, b);
          const distance = T.distancePointToSegmentNm(point, a, b);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestProgress = travelled + segmentLength * segmentFraction(point, a, b);
          }
          travelled += segmentLength;
        }
        return bestProgress;
      }

      function zoneRouteProgress(zone) {
        const point = T.getZoneLabelPoint(zone) ||
          (zone && zone.shape === "circle" && zone.circle ? zone.circle.center : null) ||
          (zone && zone.points ? zone.points[0] : null);
        return routeProgressToPoint(state.route, point);
      }

      function zoneRadioGroups() {
        return infoZonesOnRoute().map((zone) => ({
          zone,
          rows: uniqueZoneFrequencyRows(infoZoneFrequencyRows(zone), zone),
          progress: zoneRouteProgress(zone)
        })).sort((a, b) => a.progress - b.progress);
      }

      function routeEndpointIcao(endpoint) {
        const point = endpoint === "arr" ? state.route[state.route.length - 1] : state.route[0];
        return T.searchKey(point && (point.icao || point.airportIcao || point.id || point.label || point.key));
      }

      function serviceMatches(row, services) {
        const service = T.searchKey(row && row.serviceId);
        return services.map(T.searchKey).includes(service);
      }

      function airportRowsByServices(icao, services) {
        const serviceOrder = services.map(T.searchKey);
        return uniqueZoneFrequencyRows(T.airportFrequencyRows(icao)
          .filter((row) => serviceMatches(row, services))
          .sort((a, b) => serviceOrder.indexOf(T.searchKey(a.serviceId)) - serviceOrder.indexOf(T.searchKey(b.serviceId))), null);
      }

      function normalizeFrequencyText(value) {
        const match = T.clean(value).match(/(1[12]\d|13\d)[.,](\d{1,3})/);
        if (!match) return "";
        return match[1] + "." + match[2].padEnd(3, "0").slice(0, 3);
      }

      function frequenciesFromZoneName(zone) {
        const text = T.clean(zone && zone.name);
        const matches = text.match(/\b(?:1[12]\d|13\d)[.,]\d{1,3}\s*(?:MHz)?\b/gi) || [];
        return matches.map((match, index) => ({
          id: (zone.id || zone.name || "zone") + "-name-freq-" + index,
          serviceId: "fiss",
          serviceLabel: "FIS / Flight Information",
          serviceShortLabel: normalizeZoneType(zone),
          frequencyMhz: normalizeFrequencyText(match),
          callsign: zone.name || zone.designator || "FIS",
          sector: "",
          source: "ZONE_NAME"
        })).filter((row) => row.frequencyMhz);
      }

      function commsZoneRows(zone) {
        const type=normalizeZoneType(zone);
        if(type==='ATZ') {
          const match=T.clean([zone.designator,zone.name].filter(Boolean).join(' ')).toUpperCase().match(/\bEP[A-Z0-9]{2}\b/);
          const airportRows=match?airportRowsByServices(match[0],['radio','informacja','tower']):[];
          const rows=airportRows.length?airportRows:normalizeZoneFrequencyRows(zone);
          return rows.map(row=>Object.assign({},row,{sector:[zone.name || zone.designator,row.sector].filter(Boolean).join(' / ')}));
        }
        if(/KRAK[OÓ]W/i.test(T.clean(zone.name)) && isEnrouteInfoZone(zone)) {
          const west=/\bW(?:EST)?\b/i.test(zone.name),east=/\bE(?:AST)?\b/i.test(zone.name);
          const rows=airportRowsByServices('EPKK',['fiss']).filter(r=>(west&&r.frequencyMhz==='119.275')||(east&&r.frequencyMhz==='119.950'));
          if(rows.length)return rows;
        }
        return infoZoneFrequencyRows(zone);
      }

      // Build COMMs from the requested route, independently of map visibility filters.
      function buildCommsPlan(input) {
        const route=Array.isArray(input.route)?input.route.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)):[];
        const approachServices=['zblizanie','radar','approach','app'];
        const tmas=state.zones.filter(z=>normalizeZoneType(z)==='TMA' &&
          !/AGL/i.test([z.lower,z.upper].join(' ')) &&
          window.NordsweetComms.routeIntersectsVolume(route,z,
            z.lower ? parseAirspaceAltitude(z.lower,NaN).feet : NaN,
            z.upper ? parseAirspaceAltitude(z.upper,NaN).feet : NaN,T.routeIntersectsZone));
        const tmaGroups=tmas.map(zone=>{
          const assigned=normalizeZoneFrequencyRows(zone).filter(row=>serviceMatches(row,approachServices));
          const codes=T.clean([zone.designator,zone.name].join(' ')).toUpperCase().match(/\b[A-Z]{4}\b/g) || [];
          const rows=assigned.length?assigned:codes.flatMap(icao=>airportRowsByServices(icao,approachServices));
          return {name:zone.name || zone.designator,rows:window.NordsweetComms.unique(rows)};
        }).filter(group=>group.rows.length);
        const approachFrequencies=new Set(tmaGroups.flatMap(group=>group.rows.map(row=>row.frequencyMhz)));
        const airport=(end,services)=>{
          const point=end==='dep'?route[0]:route[route.length-1];
          const icao=point && (point.airportIcao || point.icao || point.id);
          return (icao?airportRowsByServices(icao,services):[]).filter(row=>
            !serviceMatches(row,approachServices) || approachFrequencies.has(row.frequencyMhz));
        };
        const zones=state.zones.filter(z=>isEnrouteInfoZone(z)||normalizeZoneType(z)==='ATZ');
        const result=window.NordsweetComms.estimate({...input,route},{airport,distance:T.haversineNm,fraction:segmentFraction,at:point=>{
          const containing=zones.filter(z=>T.zoneContainsPoint(z,point));
          const fis=containing.filter(z=>normalizeZoneType(z)==='FIS');
          const atz=containing.filter(z=>normalizeZoneType(z)==='ATZ');
          const background=fis.length?fis:containing.filter(isEnrouteInfoZone);
          return [...atz,...background].flatMap(commsZoneRows);
        }});
        result.routeGroups=zones.filter(z=>T.routeIntersectsZone(route,z))
          .map(z=>({name:z.name || z.designator,rows:commsZoneRows(z)})).concat(tmaGroups);
        const seenGroups=new Set();
        result.routeGroups=result.routeGroups.filter(group=>{
          const key=group.name+'|'+group.rows.map(row=>row.frequencyMhz).join(',');
          if(!group.rows.length || seenGroups.has(key))return false;
          seenGroups.add(key);return true;
        });
        const arrival=route[route.length-1];
        const icao=arrival && (arrival.airportIcao || arrival.icao || arrival.id);
        result.airportGroups=icao ? [
          {name:icao+' · ATIS',rows:airport('arr',['atis'])},
          {name:icao+' · APP',rows:airport('arr',approachServices)},
          {name:icao+' · TWR / Radio',rows:airport('arr',['tower','radio'])},
          {name:icao+' · GND',rows:airport('arr',['ground'])}
        ].filter(group=>group.rows.length) : [];
        return result;
      }

      function infoZoneFrequencyRows(zone) {
        const rows = normalizeZoneFrequencyRows(zone);
        if (rows.length) {
          return rows;
        }
        const fromName = frequenciesFromZoneName(zone);
        if (fromName.length) {
          return fromName;
        }
        return [];
      }

      function infoZonesOnRoute() {
        return state.zones.filter((zone) => isEnrouteInfoZone(zone) && zoneMatchesRoute(zone));
      }

      function enrouteRows() {
        return zoneRadioGroups().flatMap((group) => group.rows.map((row) => Object.assign({}, row, {
          _zone: group.zone,
          _progress: group.progress
        })));
      }

      function orderedRadioPhases() {
        const depIcao = routeEndpointIcao("dep");
        const arrIcao = routeEndpointIcao("arr");
        return [
          { title: "DEP ATIS", context: depIcao, rows: depIcao ? airportRowsByServices(depIcao, ["atis"]) : [] },
          { title: "DEP DEL", context: depIcao, rows: depIcao ? airportRowsByServices(depIcao, ["delivery"]) : [] },
          { title: "DEP GND", context: depIcao, rows: depIcao ? airportRowsByServices(depIcao, ["ground"]) : [] },
          { title: "DEP TWR/RDO", context: depIcao, rows: depIcao ? airportRowsByServices(depIcao, ["tower", "radio"]) : [] },
          { title: "DEP APP", context: depIcao, rows: depIcao ? airportRowsByServices(depIcao, ["zblizanie", "radar"]) : [] },
          { title: "ENR FIR/FIS", context: "TRASA", rows: enrouteRows() },
          { title: "ARR ATIS", context: arrIcao, rows: arrIcao ? airportRowsByServices(arrIcao, ["atis"]) : [] },
          { title: "ARR APP", context: arrIcao, rows: arrIcao ? airportRowsByServices(arrIcao, ["zblizanie", "radar"]) : [] },
          { title: "ARR TWR/RDO", context: arrIcao, rows: arrIcao ? airportRowsByServices(arrIcao, ["tower", "radio"]) : [] },
          { title: "ARR GND", context: arrIcao, rows: arrIcao ? airportRowsByServices(arrIcao, ["ground"]) : [] }
        ];
      }

      function phaseServiceTitle(phase) {
        const title = phase.title || "";
        if (title === "DEP TWR/RDO" || title === "ARR TWR/RDO") {
          const prefix = title.slice(0, 3);
          const services = new Set(phase.rows.map((row) => T.searchKey(row.serviceId)));
          if (services.has("TOWER") && services.has("RADIO")) return prefix + " TWR/RDO";
          if (services.has("TOWER")) return prefix + " TWR";
          if (services.has("RADIO")) return prefix + " RDO";
        }
        if (title === "ENR FIR/FIS") {
          const types = new Set(phase.rows.map((row) => normalizeZoneType(row._zone)));
          const hasFis = types.has("FIS");
          const hasFir = Array.from(types).some((type) => type === "FIR") ||
            phase.rows.some((row) => T.searchKey(row._zone && (row._zone.designator || row._zone.name || row._zone.kind)).includes("FIR"));
          if (hasFir && hasFis) return "ENR FIR/FIS";
          if (hasFir) return "ENR FIR";
          if (hasFis) return "ENR FIS";
        }
        return title;
      }

      function renderFrequencyRow(row, zone) {
        const rowZone = zone || row._zone || null;
        const description = T.clean([row.callsign, row.sector].filter(Boolean).join(" / ")) ||
          T.clean(rowZone && (rowZone.name || rowZone.designator)) ||
          "Czestotliwosc";
        return (
          "<div class=\"freq-line\"><span class=\"tag\">" + escapeHtml(frequencyTag(row, rowZone)) + "</span><span>" +
          escapeHtml(description) + "</span><strong>" + escapeHtml(row.frequencyMhz) + "</strong></div>"
        );
      }

      function renderRadioPhase(phase) {
        const title = [phaseServiceTitle(phase), phase.context].filter(Boolean).join(" - ");
        return (
          "<div class=\"card\"><div class=\"card-title\"><span>" + escapeHtml(title) + "</span><span class=\"tag\">" + phase.rows.length + "</span></div>" +
          phase.rows.map((row) => renderFrequencyRow(row, null)).join("") +
          "</div>"
        );
      }

      function renderRadioTab() {
        if (!state.route.length) {
          refs.tabBody.innerHTML = "<div class=\"card\"><div class=\"muted\">Najpierw zbuduj trase.</div></div>";
          return;
        }
        const phases = orderedRadioPhases().filter((phase) => phase.rows.length);
        refs.tabBody.innerHTML = phases.map(renderRadioPhase).join("") ||
          "<div class=\"card\"><div class=\"muted\">Brak dostepnych czestotliwosci dla tej trasy.</div></div>";
      }

      function renderZonesTab() {
        const activeSet = T.aupDesignatorSet(activeAup());
        const zones = crossedZones();
        const rows = zones.map((zone) => {
          const active = T.zoneMatchesAup(zone, activeSet);
          return (
            "<div class=\"zone-line\"><span class=\"tag" + (active ? " hot" : "") + "\">" + escapeHtml(normalizeZoneType(zone)) + "</span><span>" +
            escapeHtml(zone.name || zone.designator || "Strefa") + "</span><span class=\"muted\">" +
            escapeHtml([zone.lower, zone.upper].filter(Boolean).join("-")) + "</span></div>"
          );
        }).join("");
        const aup = activeAup();
        refs.tabBody.innerHTML = (
          "<div class=\"card\"><div class=\"card-title\">Przeciete strefy<span class=\"tag\">" + zones.length + "</span></div>" +
          (rows || "<div class=\"muted\">Brak przecietych stref dla aktywnych typow albo brak trasy.</div>") + "</div>" +
          "<div class=\"card\"><div class=\"card-title\">AUP</div><div class=\"muted\">" +
          escapeHtml(aup ? [aup.label, aup.validityStart, aup.validityEnd].filter(Boolean).join(" / ") : "Bez aktywnego AUP") +
          "</div></div>"
        );
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

      refs.buildRouteBtn.addEventListener("click", buildRoute);
      refs.routeInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") buildRoute();
      });
      refs.fitRouteBtn.addEventListener("click", fitRoute);
      refs.gpsBtn.addEventListener("click", () => {
        if (state.gps.enabled) stopGps();
        else startGps();
      });
      refs.gpsCenterBtn.addEventListener("click", centerGpsNavigation);
      refs.pointMenuCloseBtn.addEventListener("click", () => hidePointMenu());
      refs.routeSegmentMenuCloseBtn.addEventListener("click", () => hideRouteSegmentMenu());
      refs.airspaceInspectorCloseBtn.addEventListener("click", hideAirspaceInspector);
      refs.trafficMenuCloseBtn.addEventListener("click", () => hideTrafficMenu());
      refs.trafficMenuDragHandle.addEventListener("pointerdown", startTrafficMenuDrag);
      refs.trafficMenuDragHandle.addEventListener("pointermove", moveTrafficMenuDrag);
      refs.trafficMenuDragHandle.addEventListener("pointerup", stopTrafficMenuDrag);
      refs.trafficMenuDragHandle.addEventListener("pointercancel", stopTrafficMenuDrag);
      refs.addPointToRouteBtn.addEventListener("click", addSelectedPointToRoute);
      refs.routeCreateWaypointBtn.addEventListener("click", createWaypointOnSelectedRouteSegment);
      refs.directToPointBtn.addEventListener("click", activateDirectToSelectedPoint);
      refs.pointWxBtn.addEventListener("click", requestSelectedPointWeather);
      refs.pointRestrictionBtn.addEventListener("click", toggleSelectedPointRestrictionEditor);
      refs.pointRestrictionMode.addEventListener("click", (event) => {
        const button = event.target && event.target.closest("[data-restriction-altitude-mode]");
        if (button) setSelectedPointRestrictionMode(button.dataset.restrictionAltitudeMode);
      });
      refs.pointRestrictionApplyBtn.addEventListener("click", applySelectedPointRestriction);
      refs.pointRestrictionClearBtn.addEventListener("click", clearSelectedPointRestriction);
      refs.pointNotamBtn.addEventListener("click", () => requestSelectedAirportInformation("notam"));
      refs.pointChartBtn.addEventListener("click", () => requestSelectedAirportInformation("chart"));
      refs.basemapSelect.addEventListener("change", changeBasemap);
      refs.saveBasemapBtn.addEventListener("click", saveBasemapSettings);
      refs.basemapTemplate.addEventListener("keydown", (event) => {
        if (event.key === "Enter") saveBasemapSettings();
      });
      refs.basemapApiKey.addEventListener("keydown", (event) => {
        if (event.key === "Enter") saveBasemapSettings();
      });
      document.getElementById("loadJsonBtn").addEventListener("click", () => {
        loadAirspacesJson("airspaces.json").catch((error) => {
          setSourceStatus("Nie udalo sie wczytac airspaces.json: " + error.message, true);
        });
      });
      document.getElementById("loadAllBtn").addEventListener("click", () => loadOpenAirApi("all", "Poland_Airspaces API"));
      document.getElementById("loadTodayBtn").addEventListener("click", () => loadOpenAirApi("today", "TODAY API"));
      document.getElementById("loadTomorrowBtn").addEventListener("click", () => loadOpenAirApi("tomorrow", "TOMORROW API"));
      document.getElementById("refreshCupBtn").addEventListener("click", refreshCupApi);
      document.getElementById("zoomInBtn").addEventListener("click", () => zoomAt({
        lat: (state.bounds.minLat + state.bounds.maxLat) / 2,
        lon: (state.bounds.minLon + state.bounds.maxLon) / 2
      }, 1.3));
      document.getElementById("zoomOutBtn").addEventListener("click", () => zoomAt({
        lat: (state.bounds.minLat + state.bounds.maxLat) / 2,
        lon: (state.bounds.minLon + state.bounds.maxLon) / 2
      }, 0.77));
      document.getElementById("resetViewBtn").addEventListener("click", () => {
        state.bounds = Object.assign({}, T.DEFAULT_BOUNDS);
        renderMap();
      });
      refs.aupMode.addEventListener("change", () => {
        renderMap();
        renderTab();
      });
      refs.labelToggle.addEventListener("change", renderMap);
      document.querySelectorAll("[data-layer]").forEach((input) => {
        input.addEventListener("change", () => {
          state.layers[input.dataset.layer] = input.checked;
          if (input.dataset.layer === "traffic") {
            if (hasEnabledTrafficLayers()) {
              startTrafficRefresh();
            } else {
              stopTrafficRefresh();
            }
            updateTrafficStatus();
            refreshSelectedTrafficFromSources();
          }
          renderMap();
        });
      });
      refs.airspaceTypeFilters.addEventListener("change", (event) => {
        const input = event.target;
        if (!input || !input.matches("[data-airspace-type]")) return;
        if (input.checked) {
          state.typeFilters.add(input.dataset.airspaceType);
        } else {
          state.typeFilters.delete(input.dataset.airspaceType);
        }
        renderTypeFilters();
        renderMap();
        renderTab();
      });
      refs.selectAllTypesBtn.addEventListener("click", () => {
        state.typeFilters = new Set(AIRSPACE_TYPE_FILTERS);
        renderTypeFilters();
        renderMap();
        renderTab();
      });
      refs.clearTypesBtn.addEventListener("click", () => {
        state.typeFilters = new Set();
        renderTypeFilters();
        renderMap();
        renderTab();
      });
      document.querySelectorAll(".tab").forEach((tab) => {
        tab.addEventListener("click", () => {
          state.activeTab = tab.dataset.tab;
          renderTab();
        });
      });

      refs.openAirFile.addEventListener("change", async () => {
        const file = refs.openAirFile.files && refs.openAirFile.files[0];
        if (!file) return;
        try {
          const text = await readFile(file);
          if (/\.json$/i.test(file.name) || /^\s*[\[{]/.test(text)) {
            applyAirspacePayload(JSON.parse(text), file.name);
          } else {
            state.zones = hydrateZoneFrequencies(T.parseOpenAir(text, file.name));
            setSourceStatus("Wczytano " + state.zones.length + " stref z " + file.name + ".");
            renderTypeFilters();
            renderMap();
            renderTab();
          }
        } catch (error) {
          setSourceStatus("Nie udalo sie wczytac pliku: " + error.message, true);
        }
      });

      refs.gpxFile.addEventListener("change", async () => {
        const file = refs.gpxFile.files && refs.gpxFile.files[0];
        if (!file) return;
        const text = await readFile(file);
        state.route = T.parseGpx(text);
        state.unresolved = [];
        state.routeInputSynced = false;
        refs.mapStatus.textContent = "GPX: " + state.route.length + " punktow.";
        fitRoute();
        renderTab();
      });

      refs.mapCanvas.addEventListener("wheel", (event) => {
        event.preventDefault();
        if (!state.viewport) return;
        const rect = refs.mapCanvas.getBoundingClientRect();
        const navigationFix = state.navigationTransform && state.navigationTransform.following
          ? state.navigationTransform.fix
          : null;
        const point = navigationFix || getMapCoordinateAtCss(event.clientX - rect.left, event.clientY - rect.top, rect);
        if (!point) return;
        zoomAt(point, Math.exp(-Math.max(-300, Math.min(300, event.deltaY)) * (event.ctrlKey ? 0.01 : 0.002)));
        scheduleTrafficViewportRefresh();
      }, { passive: false });

      refs.mapCanvas.addEventListener("click", handleMapClick);

      document.addEventListener("click", (event) => {
        if (refs.trafficMenu.hidden || refs.trafficMenu.contains(event.target) || refs.mapCanvas.contains(event.target)) return;
        hideTrafficMenu();
      });

      const mapPointers = new Map();
      let mapPinchDistance = 0;
      function startMapDrag(event) {
        if (event.pointerType === "mouse" && event.button !== 0 && event.button !== 2) return;
        if (!state.viewport) return;
        const rect = refs.mapCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const startPoint = getMapCoordinateAtCss(x, y, rect);
        if (!startPoint) return;
        state.drag = {
          mode: event.button === 2 ? "rotate" : "pan",
          startPoint,
          startX: x,
          startY: y,
          startHeadingDeg: state.navigationTransform && Number.isFinite(state.navigationTransform.headingDeg)
            ? state.navigationTransform.headingDeg
            : state.gps.navigationHeadingDeg,
          startManualPanRatio: Object.assign({}, state.gps.manualPanRatio || { x: 0, y: 0 }),
          moved: false,
          bounds: Object.assign({}, state.bounds),
          viewport: state.viewport
        };
        refs.mapCanvas.classList.add("dragging");
      }
      refs.mapCanvas.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0 && event.button !== 2) return;
        mapPointers.set(event.pointerId, event);
        refs.mapCanvas.setPointerCapture(event.pointerId);
        if (mapPointers.size === 1) startMapDrag(event);
        else {
          const [a, b] = [...mapPointers.values()];
          mapPinchDistance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          state.drag = null;
          state.suppressNextMapClick = true;
          hidePointMenu({ skipRender: true });
          hideAirspaceInspector();
        }
      });
      refs.mapCanvas.addEventListener("contextmenu", (event) => event.preventDefault());
      function endMapPointer(event) {
        if (!mapPointers.has(event.pointerId)) return;
        const wasPinching = mapPointers.size > 1;
        mapPointers.delete(event.pointerId);
        const moved = Boolean(state.drag && state.drag.moved);
        state.suppressNextMapClick = state.suppressNextMapClick || moved || wasPinching;
        state.drag = null;
        refs.mapCanvas.classList.remove("dragging");
        if (moved || wasPinching) scheduleTrafficViewportRefresh();
        mapPinchDistance = 0;
        if (mapPointers.size === 1) startMapDrag([...mapPointers.values()][0]);
      }
      window.addEventListener("pointerup", endMapPointer);
      window.addEventListener("pointercancel", endMapPointer);
      refs.mapCanvas.addEventListener("lostpointercapture", endMapPointer);
      window.addEventListener("pointermove", (event) => {
        if (mapPointers.has(event.pointerId)) mapPointers.set(event.pointerId, event);
        if (mapPointers.size >= 2) {
          const [a, b] = [...mapPointers.values()];
          const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          const rect = refs.mapCanvas.getBoundingClientRect();
          const point = state.navigationTransform && state.navigationTransform.following
            ? state.navigationTransform.fix
            : getMapCoordinateAtCss((a.clientX + b.clientX) / 2 - rect.left, (a.clientY + b.clientY) / 2 - rect.top, rect);
          if (point && distance > 0 && mapPinchDistance > 0) zoomAt(point, distance / mapPinchDistance);
          mapPinchDistance = distance;
          return;
        }
        if (!state.viewport) return;
        const rect = refs.mapCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
          const point = getMapCoordinateAtCss(x, y, rect);
          if (point) {
            refs.coordStatus.textContent = point.lat.toFixed(5) + ", " + point.lon.toFixed(5);
          }
        }
        if (state.drag) {
          if (Math.hypot(x - state.drag.startX, y - state.drag.startY) > 3) {
            if (!state.drag.moved) {
              state.drag.moved = true;
              hidePointMenu({ skipRender: true });
              hideAirspaceInspector();
              if (state.gps.debugActive && state.gps.following) {
                detachGpsNavigationWithoutJump();
                renderMap();
              }
              // Rebase the drag after detaching the aircraft anchor to avoid a one-frame map jump.
              state.drag.bounds = Object.assign({}, state.bounds);
              state.drag.startPoint = getMapCoordinateAtCss(state.drag.startX, state.drag.startY, rect);
              state.drag.startManualPanRatio = Object.assign({}, state.gps.manualPanRatio || { x: 0, y: 0 });
            }
            updateGpsCenterButton();
          }
          if (state.drag.mode === "rotate") {
            if (state.drag.moved && Number.isFinite(state.drag.startHeadingDeg)) {
              state.gps.navigationHeadingDeg = normalizeHeading(
                state.drag.startHeadingDeg - (x - state.drag.startX) * 0.35
              );
              renderMap();
            }
            return;
          }
          if (state.gps.debugActive && state.gps.enabled && !state.gps.following) {
            // Keep manual movement in screen space. Geographic-bound panning
            // under a rotated track-up transform was the source of the jump.
            state.gps.manualPanRatio = {
              x: state.drag.startManualPanRatio.x + (x - state.drag.startX) / rect.width,
              y: state.drag.startManualPanRatio.y + (y - state.drag.startY) / rect.height
            };
            renderMap();
            return;
          }
          // Keep panning relative to the viewport captured on pointer-down. Using
          // the already-shifted live viewport feeds the prior pan into the next
          // frame and makes regular, non-GPX map dragging jump or accelerate.
          const dragViewport = state.drag.viewport;
          const current = dragViewport && rect.width && rect.height
            ? dragViewport.unproject(
              x * dragViewport.width / rect.width,
              y * dragViewport.height / rect.height
            )
            : null;
          if (!current || !state.drag.startPoint) return;
          const dLat = state.drag.startPoint.lat - current.lat;
          const dLon = state.drag.startPoint.lon - current.lon;
          state.bounds = {
            minLat: state.drag.bounds.minLat + dLat,
            maxLat: state.drag.bounds.maxLat + dLat,
            minLon: state.drag.bounds.minLon + dLon,
            maxLon: state.drag.bounds.maxLon + dLon
          };
          renderMap();
        }
      });

      window.addEventListener("resize", renderMap);
      window.addEventListener("beforeunload", () => {
        clearGpsWatch();
        stopTrafficRefresh();
      });
      window.addEventListener("message", (event) => {
        if (event.origin===location.origin && event.source===window.parent && event.data && event.data.type==='nordsweet:commsRequest') {
          const input=event.data;
          const result=buildCommsPlan(input);
          event.source.postMessage({type:'nordsweet:commsResult',id:input.id,phase:input.phase,result},event.origin);
          return;
        }
        if (event.source===window.parent && event.origin===location.origin) applyExternalGpsMessage(event.data);
        applyExternalRouteMessage(event.data);
      });

      setupEmbeddedMode();
      state.pointIndex = T.buildPointIndex();
      loadBasemapUi();
      updateGpsUi();
      updateTrafficStatus();
      renderTypeFilters();
      applyStartupMapParams();
      renderMap();
      renderTab();
      buildRoute();
      loadDefaultAirspaces();
      startStartupMapServices();
    }());
  
}
