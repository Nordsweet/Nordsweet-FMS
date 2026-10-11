// @ts-nocheck -- legacy DOM engine; type it when this screen is migrated to React.
export async function start(loadScript) {

    (function () {
      "use strict";

      const canvas = document.getElementById("pfdCanvas");
      const ctx = canvas.getContext("2d");
      const gpsButton = document.getElementById("gpsButton");
      const demoButton = document.getElementById("demoButton");
      const gpxButton = document.getElementById("gpxButton");
      const gpxInput = document.getElementById("gpxInput");
      const attitudeButton = document.getElementById("attitudeButton");
      const resetButton = document.getElementById("resetButton");
      const copyButton = document.getElementById("copyButton");
      const crsInput = document.getElementById("crsInput");
      const sourcePill = document.getElementById("sourcePill");
      const statusMessage = document.getElementById("statusMessage");
      const latValue = document.getElementById("latValue");
      const lonValue = document.getElementById("lonValue");
      const accValue = document.getElementById("accValue");
      const ageValue = document.getElementById("ageValue");
      const utcValue = document.getElementById("utcValue");
      const gpxValue = document.getElementById("gpxValue");
      const legValue = document.getElementById("legValue");
      const dtkValue = document.getElementById("dtkValue");
      const disValue = document.getElementById("disValue");

      const FT_PER_M = 3.280839895;
      const KT_PER_MPS = 1.943844492;
      const MPS_PER_KT = 0.514444444;
      const EARTH_RADIUS_M = 6371000;
      const NM_PER_M = 1 / 1852;
      const LOGICAL_W = 1024;
      const LOGICAL_H = 768;
      const SOFTKEYS = ["GPS", "MAP", "BRG", "ALT", "TRK", "SENS", "DCLTR", "MENU"];
      const CDI_SENSITIVITIES_NM = [5, 1, 0.3];

      const state = {
        source: "OFF",
        message: "GPS OFF",
        gpsWatch: null,
        gpsActive: false,
        gpsError: false,
        demoActive: false,
        attitudeActive: false,
        lastFixTime: 0,
        lastDrawTime: performance.now(),
        lastGpsPoint: null,
        lat: null,
        lon: null,
        accuracy: null,
        altitudeFt: null,
        groundSpeedKt: 0,
        trackDeg: 0,
        verticalSpeedFpm: 0,
        turnRateDps: 0,
        pathPitchDeg: 0,
        pathBankDeg: 0,
        devicePitchDeg: 0,
        deviceRollDeg: 0,
        selectedCourseDeg: 0,
        gpsHeadingValid: false,
        simStart: performance.now(),
        softkeyHitboxes: [],
        mapVisible: false,
        brgPointerVisible: false,
        altitudeBugFt: null,
        cdiSensitivityIndex: 1,
        declutterLevel: 0,
        menuVisible: false,
        gpx: {
          loaded: false,
          active: false,
          name: "",
          points: [],
          cumulativeM: [],
          totalDistanceM: 0,
          activeLegIndex: 0,
          progressM: 0,
          desiredTrackDeg: null,
          crossTrackNm: null,
          distanceToNextNm: null,
          distanceToEndNm: null,
          eteMin: null,
          nextName: "",
          simStart: performance.now(),
          simDone: false,
          simLast: null
        }
      };

      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      function isFiniteNumber(value) {
        return typeof value === "number" && Number.isFinite(value);
      }

      function norm360(value) {
        return ((value % 360) + 360) % 360;
      }

      function shortestDelta(from, to) {
        return ((to - from + 540) % 360) - 180;
      }

      function smooth(current, target, factor) {
        if (!isFiniteNumber(current)) {
          return target;
        }
        return current + (target - current) * factor;
      }

      function smoothAngle(current, target, factor) {
        return norm360(current + shortestDelta(current, target) * factor);
      }

      function toRad(value) {
        return value * Math.PI / 180;
      }

      function toDeg(value) {
        return value * 180 / Math.PI;
      }

      function pad3(value) {
        return String(Math.round(norm360(value))).padStart(3, "0");
      }

      function format(value, digits) {
        if (!isFiniteNumber(value)) {
          return "--";
        }
        return value.toFixed(digits);
      }

      function formatFt(value) {
        if (!isFiniteNumber(value)) {
          return "---";
        }
        return String(Math.round(value));
      }

      function haversineMeters(aLat, aLon, bLat, bLon) {
        const dLat = toRad(bLat - aLat);
        const dLon = toRad(bLon - aLon);
        const lat1 = toRad(aLat);
        const lat2 = toRad(bLat);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1) * Math.cos(lat2) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }

      function bearingDeg(aLat, aLon, bLat, bLon) {
        const lat1 = toRad(aLat);
        const lat2 = toRad(bLat);
        const dLon = toRad(bLon - aLon);
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) -
          Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        return norm360(toDeg(Math.atan2(y, x)));
      }

      function projectFrom(originLat, originLon, lat, lon) {
        const x = toRad(lon - originLon) * Math.cos(toRad((originLat + lat) / 2)) * EARTH_RADIUS_M;
        const y = toRad(lat - originLat) * EARTH_RADIUS_M;
        return { x, y };
      }

      function childText(element, name) {
        const direct = element.getElementsByTagName(name)[0] ||
          element.getElementsByTagNameNS("*", name)[0];
        return direct ? direct.textContent.trim() : "";
      }

      function uniqueElements(elements) {
        const seen = new Set();
        return elements.filter((element) => {
          if (seen.has(element)) {
            return false;
          }
          seen.add(element);
          return true;
        });
      }

      function elementsByName(doc, name) {
        return uniqueElements([
          ...Array.from(doc.getElementsByTagName(name)),
          ...Array.from(doc.getElementsByTagNameNS("*", name))
        ]);
      }

      function parseGpxPoint(element, index) {
        const lat = Number(element.getAttribute("lat"));
        const lon = Number(element.getAttribute("lon"));
        const eleText = childText(element, "ele");
        const name = childText(element, "name") || "WP" + String(index + 1);
        const timeText = childText(element, "time");
        return {
          lat,
          lon,
          altFt: eleText ? Number(eleText) * FT_PER_M : null,
          name,
          time: timeText ? Date.parse(timeText) : null
        };
      }

      function compactRoutePoints(points) {
        const compact = [];
        points.forEach((point) => {
          if (!isFiniteNumber(point.lat) || !isFiniteNumber(point.lon)) {
            return;
          }
          const previous = compact[compact.length - 1];
          if (previous && haversineMeters(previous.lat, previous.lon, point.lat, point.lon) < 1) {
            return;
          }
          compact.push(point);
        });
        return compact;
      }

      function routeDisplayName(fileName) {
        return String(fileName || "ROUTE")
          .replace(/\.[^.]+$/, "")
          .slice(0, 18)
          .toUpperCase();
      }

      function loadGpxRoute(points, fileName) {
        const cleanPoints = compactRoutePoints(points);
        if (cleanPoints.length < 2) {
          throw new Error("GPX NEEDS AT LEAST 2 POINTS");
        }

        const cumulativeM = [0];
        let totalDistanceM = 0;
        for (let i = 1; i < cleanPoints.length; i += 1) {
          totalDistanceM += haversineMeters(
            cleanPoints[i - 1].lat,
            cleanPoints[i - 1].lon,
            cleanPoints[i].lat,
            cleanPoints[i].lon
          );
          cumulativeM.push(totalDistanceM);
        }

        if (totalDistanceM < 10) {
          throw new Error("GPX ROUTE TOO SHORT");
        }

        state.gpx.loaded = true;
        state.gpx.active = true;
        state.gpx.name = routeDisplayName(fileName);
        state.gpx.points = cleanPoints;
        state.gpx.cumulativeM = cumulativeM;
        state.gpx.totalDistanceM = totalDistanceM;
        state.gpx.activeLegIndex = 0;
        state.gpx.progressM = 0;
        state.gpx.desiredTrackDeg = bearingDeg(cleanPoints[0].lat, cleanPoints[0].lon, cleanPoints[1].lat, cleanPoints[1].lon);
        state.gpx.crossTrackNm = 0;
        state.gpx.distanceToNextNm = (cumulativeM[1] - cumulativeM[0]) * NM_PER_M;
        state.gpx.distanceToEndNm = totalDistanceM * NM_PER_M;
        state.gpx.eteMin = null;
        state.gpx.nextName = cleanPoints[1].name;
        state.gpx.simStart = performance.now();
        state.gpx.simDone = false;
        state.gpx.simLast = null;

        if (state.demoActive) {
          state.gpx.simStart = performance.now();
          setMessage("GPX SIM", state.gpx.name + " LOADED", "live");
        } else {
          setMessage("GPX READY", state.gpx.name + " " + cleanPoints.length + " PTS", "live");
        }
        updateSourcePill();
      }

      function parseGpxText(text, fileName) {
        const doc = new DOMParser().parseFromString(text, "application/xml");
        if (doc.getElementsByTagName("parsererror").length) {
          throw new Error("GPX PARSE ERROR");
        }

        let elements = elementsByName(doc, "trkpt");
        if (elements.length < 2) {
          elements = elementsByName(doc, "rtept");
        }
        if (elements.length < 2) {
          elements = elementsByName(doc, "wpt");
        }

        const points = elements.map(parseGpxPoint);
        loadGpxRoute(points, fileName);
      }

      function openGpxPicker() {
        gpxInput.value = "";
        gpxInput.click();
      }

      function handleGpxFile(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) {
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          try {
            parseGpxText(String(reader.result || ""), file.name);
          } catch (error) {
            const text = error && error.message ? error.message : "GPX LOAD FAILED";
            state.gpx.loaded = false;
            state.gpx.active = false;
            setMessage("GPX FAIL", text.toUpperCase(), "fail");
            updateSourcePill();
          }
        };
        reader.onerror = () => {
          setMessage("GPX FAIL", "FILE READ ERROR", "fail");
        };
        reader.readAsText(file);
      }

      function routePointAtDistance(distanceM) {
        const route = state.gpx;
        const points = route.points;
        if (!route.loaded || points.length < 2) {
          return null;
        }

        const distance = clamp(distanceM, 0, route.totalDistanceM);
        let leg = 0;
        while (leg < route.cumulativeM.length - 2 && route.cumulativeM[leg + 1] < distance) {
          leg += 1;
        }

        const from = points[leg];
        const to = points[leg + 1];
        const legStart = route.cumulativeM[leg];
        const legEnd = route.cumulativeM[leg + 1];
        const legLength = Math.max(1, legEnd - legStart);
        const ratio = clamp((distance - legStart) / legLength, 0, 1);
        const lat = from.lat + (to.lat - from.lat) * ratio;
        const lon = from.lon + (to.lon - from.lon) * ratio;
        const fromAlt = isFiniteNumber(from.altFt) ? from.altFt : null;
        const toAlt = isFiniteNumber(to.altFt) ? to.altFt : fromAlt;
        const altFt = isFiniteNumber(fromAlt) && isFiniteNumber(toAlt)
          ? fromAlt + (toAlt - fromAlt) * ratio
          : 2500;

        return {
          lat,
          lon,
          altFt,
          leg,
          trackDeg: bearingDeg(from.lat, from.lon, to.lat, to.lon),
          distanceM: distance
        };
      }

      function updateGpxNavigation() {
        const route = state.gpx;
        if (!route.loaded || !isFiniteNumber(state.lat) || !isFiniteNumber(state.lon)) {
          return;
        }

        const points = route.points;
        let best = null;
        for (let i = 0; i < points.length - 1; i += 1) {
          const from = points[i];
          const to = points[i + 1];
          const legVector = projectFrom(from.lat, from.lon, to.lat, to.lon);
          const posVector = projectFrom(from.lat, from.lon, state.lat, state.lon);
          const legLengthSq = Math.max(1, legVector.x * legVector.x + legVector.y * legVector.y);
          const legLength = Math.sqrt(legLengthSq);
          const alongM = clamp((posVector.x * legVector.x + posVector.y * legVector.y) / legLengthSq, 0, 1) * legLength;
          const crossM = (legVector.x * posVector.y - legVector.y * posVector.x) / legLength;
          const alongRatio = alongM / legLength;
          const closestLat = from.lat + (to.lat - from.lat) * alongRatio;
          const closestLon = from.lon + (to.lon - from.lon) * alongRatio;
          const distanceM = haversineMeters(state.lat, state.lon, closestLat, closestLon);
          const score = distanceM + Math.abs(i - route.activeLegIndex) * 8;

          if (!best || score < best.score) {
            best = {
              score,
              leg: i,
              alongM,
              crossM,
              legLength,
              desiredTrackDeg: bearingDeg(from.lat, from.lon, to.lat, to.lon)
            };
          }
        }

        if (!best) {
          return;
        }

        route.activeLegIndex = best.leg;
        route.progressM = clamp(route.cumulativeM[best.leg] + best.alongM, 0, route.totalDistanceM);
        route.desiredTrackDeg = best.desiredTrackDeg;
        route.crossTrackNm = best.crossM * NM_PER_M;
        route.distanceToNextNm = Math.max(0, best.legLength - best.alongM) * NM_PER_M;
        route.distanceToEndNm = Math.max(0, route.totalDistanceM - route.progressM) * NM_PER_M;
        route.nextName = points[Math.min(points.length - 1, best.leg + 1)].name;
        route.eteMin = state.groundSpeedKt > 5
          ? route.distanceToEndNm / state.groundSpeedKt * 60
          : null;
      }

      function setMessage(title, text, mode) {
        state.message = text;
        statusMessage.innerHTML = "<strong>" + title + "</strong><br>" + text;
        sourcePill.classList.toggle("live", mode === "live");
        sourcePill.classList.toggle("fail", mode === "fail");
      }

      function updateSourcePill() {
        sourcePill.textContent = state.source;
        gpsButton.classList.toggle("active", state.gpsActive);
        demoButton.classList.toggle("active", state.demoActive);
        gpxButton.classList.toggle("active", state.gpx.loaded && state.gpx.active);
        attitudeButton.classList.toggle("active", state.attitudeActive);
      }

      function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(320, Math.round(rect.width * ratio));
        const height = Math.max(240, Math.round(rect.height * ratio));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        ctx.setTransform(
          ratio * rect.width / LOGICAL_W,
          0,
          0,
          ratio * rect.height / LOGICAL_H,
          0,
          0
        );
      }

      function startGps() {
        if (!navigator.geolocation) {
          state.gpsError = true;
          state.source = state.demoActive ? "SIM" : "FAIL";
          setMessage("GPS FAIL", "GEOLOCATION NOT AVAILABLE", "fail");
          updateSourcePill();
          return;
        }

        if (state.gpsWatch !== null) {
          navigator.geolocation.clearWatch(state.gpsWatch);
          state.gpsWatch = null;
          state.gpsActive = false;
          if (!state.demoActive) {
            state.source = "OFF";
            setMessage("STBY", "GPS OFF", "");
          }
          updateSourcePill();
          return;
        }

        state.gpsActive = true;
        state.gpsError = false;
        state.source = state.demoActive ? "SIM" : "GPS";
        setMessage("GPS ARM", "WAITING FOR FIX", "");
        updateSourcePill();

        state.gpsWatch = navigator.geolocation.watchPosition(handleGpsFix, handleGpsError, {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 15000
        });
      }

      function handleGpsFix(position) {
        const coords = position.coords;
        const now = position.timestamp || Date.now();
        const previous = state.lastGpsPoint;
        const lat = coords.latitude;
        const lon = coords.longitude;
        const altFt = isFiniteNumber(coords.altitude) ? coords.altitude * FT_PER_M : state.altitudeFt;
        let speedKt = isFiniteNumber(coords.speed) && coords.speed >= 0 ? coords.speed * KT_PER_MPS : state.groundSpeedKt;
        let trackDeg = isFiniteNumber(coords.heading) && coords.heading >= 0 ? coords.heading : state.trackDeg;
        let vsFpm = state.verticalSpeedFpm;
        let turnRateDps = 0;
        let headingValid = isFiniteNumber(coords.heading) && coords.heading >= 0;

        if (previous) {
          const dt = Math.max(0.1, (now - previous.time) / 1000);
          const distanceM = haversineMeters(previous.lat, previous.lon, lat, lon);
          if ((!isFiniteNumber(coords.speed) || coords.speed < 0) && distanceM > 1.5) {
            speedKt = distanceM / dt * KT_PER_MPS;
          }
          if (!headingValid && distanceM > 2.5) {
            trackDeg = bearingDeg(previous.lat, previous.lon, lat, lon);
            headingValid = true;
          }
          if (isFiniteNumber(altFt) && isFiniteNumber(previous.altFt)) {
            vsFpm = clamp((altFt - previous.altFt) / dt * 60, -3000, 3000);
          }
          if (headingValid && isFiniteNumber(previous.trackDeg)) {
            turnRateDps = clamp(shortestDelta(previous.trackDeg, trackDeg) / dt, -12, 12);
          }
        }

        const speedMps = Math.max(0.5, speedKt * MPS_PER_KT);
        const vsMps = vsFpm / 196.850394;
        const pathPitch = clamp(toDeg(Math.atan2(vsMps, speedMps)), -20, 20);
        const pathBank = clamp(toDeg(Math.atan(speedMps * toRad(turnRateDps) / 9.80665)), -35, 35);

        state.lat = lat;
        state.lon = lon;
        state.accuracy = coords.accuracy;
        state.altitudeFt = isFiniteNumber(altFt) ? smooth(state.altitudeFt, altFt, 0.32) : null;
        state.groundSpeedKt = smooth(state.groundSpeedKt, speedKt, 0.28);
        state.trackDeg = smoothAngle(state.trackDeg, trackDeg, 0.3);
        state.verticalSpeedFpm = smooth(state.verticalSpeedFpm, vsFpm, 0.22);
        state.turnRateDps = smooth(state.turnRateDps, turnRateDps, 0.3);
        state.pathPitchDeg = smooth(state.pathPitchDeg, pathPitch, 0.25);
        state.pathBankDeg = smooth(state.pathBankDeg, pathBank, 0.25);
        state.lastFixTime = Date.now();
        state.gpsHeadingValid = headingValid;
        state.gpsError = false;
        state.lastGpsPoint = {
          lat,
          lon,
          altFt: isFiniteNumber(altFt) ? altFt : null,
          trackDeg,
          time: now
        };

        if (!state.demoActive) {
          state.source = "GPS";
          setMessage("GPS LIVE", "POSITION FIX RECEIVED", "live");
          updateSourcePill();
        }
      }

      function handleGpsError(error) {
        state.gpsError = true;
        state.gpsActive = false;
        if (state.gpsWatch !== null) {
          navigator.geolocation.clearWatch(state.gpsWatch);
          state.gpsWatch = null;
        }
        if (!state.demoActive) {
          state.source = "FAIL";
        }
        const message = error && error.message ? error.message.toUpperCase() : "POSITION UNAVAILABLE";
        setMessage("GPS FAIL", message, "fail");
        updateSourcePill();
      }

      function toggleDemo() {
        state.demoActive = !state.demoActive;
        if (state.demoActive) {
          state.simStart = performance.now();
          state.gpx.simStart = performance.now();
          state.gpx.simDone = false;
          state.gpx.simLast = null;
          state.source = "SIM";
          setMessage(state.gpx.loaded ? "GPX SIM" : "SIM LIVE", state.gpx.loaded ? state.gpx.name + " ACTIVE" : "DEMO DATA ACTIVE", "live");
        } else {
          state.source = state.gpsActive && state.lastFixTime ? "GPS" : "OFF";
          setMessage(state.source === "GPS" ? "GPS LIVE" : "STBY", state.source === "GPS" ? "POSITION FIX RECEIVED" : "GPS OFF", state.source === "GPS" ? "live" : "");
        }
        updateSourcePill();
      }

      function updateSimulation(now) {
        if (!state.demoActive) {
          return;
        }
        if (state.gpx.loaded) {
          updateGpxSimulation(now);
          return;
        }
        const t = (now - state.simStart) / 1000;
        const track = norm360(42 + t * 1.35 + Math.sin(t / 8) * 18);
        const speed = 112 + Math.sin(t / 5) * 8 + Math.cos(t / 17) * 5;
        const altitude = 2450 + Math.sin(t / 12) * 520 + Math.sin(t / 3.8) * 40;
        const vs = Math.cos(t / 12) * (520 / 12) * 60 + Math.cos(t / 3.8) * (40 / 3.8) * 60;
        const turnRate = 1.35 + Math.cos(t / 8) * 18 / 8;
        const speedMps = Math.max(0.5, speed * MPS_PER_KT);
        const vsMps = vs / 196.850394;
        const radius = 0.012;
        const orbit = toRad(track - 90);

        state.lat = 50.0777 + Math.cos(orbit) * radius;
        state.lon = 19.7848 + Math.sin(orbit) * radius * 1.55;
        state.accuracy = 4.5 + Math.abs(Math.sin(t / 6)) * 2;
        state.altitudeFt = altitude;
        state.groundSpeedKt = speed;
        state.trackDeg = track;
        state.verticalSpeedFpm = clamp(vs, -2200, 2200);
        state.turnRateDps = turnRate;
        state.pathPitchDeg = clamp(toDeg(Math.atan2(vsMps, speedMps)), -12, 12);
        state.pathBankDeg = clamp(toDeg(Math.atan(speedMps * toRad(turnRate) / 9.80665)), -30, 30);
        state.gpsHeadingValid = true;
        state.lastFixTime = Date.now();
      }

      function updateGpxSimulation(now) {
        const route = state.gpx;
        const cruiseKt = 105;
        const elapsed = Math.max(0, (now - route.simStart) / 1000);
        const rawDistanceM = elapsed * cruiseKt * MPS_PER_KT;
        const routeDistanceM = Math.min(rawDistanceM, route.totalDistanceM);
        const point = routePointAtDistance(routeDistanceM);
        if (!point) {
          return;
        }

        const previous = route.simLast;
        const dt = previous ? Math.max(0.1, (now - previous.time) / 1000) : 0.1;
        const turnRate = previous ? clamp(shortestDelta(previous.trackDeg, point.trackDeg) / dt, -12, 12) : 0;
        const vs = previous ? clamp((point.altFt - previous.altFt) / dt * 60, -3000, 3000) : 0;
        const speedKt = rawDistanceM >= route.totalDistanceM ? 0 : cruiseKt;
        const speedMps = Math.max(0.5, speedKt * MPS_PER_KT);
        const vsMps = vs / 196.850394;

        state.lat = point.lat;
        state.lon = point.lon;
        state.accuracy = 3;
        state.altitudeFt = point.altFt;
        state.groundSpeedKt = speedKt;
        state.trackDeg = point.trackDeg;
        state.verticalSpeedFpm = vs;
        state.turnRateDps = turnRate;
        state.pathPitchDeg = clamp(toDeg(Math.atan2(vsMps, speedMps)), -12, 12);
        state.pathBankDeg = clamp(toDeg(Math.atan(speedMps * toRad(turnRate) / 9.80665)), -30, 30);
        state.gpsHeadingValid = true;
        state.lastFixTime = Date.now();
        route.simDone = rawDistanceM >= route.totalDistanceM;
        route.simLast = {
          time: now,
          trackDeg: point.trackDeg,
          altFt: point.altFt
        };

        if (route.simDone) {
          setMessage("GPX END", route.name + " COMPLETE", "live");
        }
      }

      function restoreNavigationMessage() {
        if (state.demoActive) {
          setMessage(state.gpx.loaded ? "GPX SIM" : "SIM LIVE", state.gpx.loaded ? state.gpx.name + " ACTIVE" : "DEMO DATA ACTIVE", "live");
        } else if (state.gpsError) {
          setMessage("GPS FAIL", "POSITION UNAVAILABLE", "fail");
        } else if (state.gpsActive && state.lastFixTime) {
          setMessage("GPS LIVE", "POSITION FIX RECEIVED", "live");
        } else if (state.gpx.loaded) {
          setMessage("GPX READY", state.gpx.name + " LOADED", "live");
        } else {
          setMessage("ATT OFF", "GPS PATH ACTIVE", "");
        }
      }

      function disableAttitude() {
        window.removeEventListener("deviceorientation", handleDeviceOrientation, true);
        state.attitudeActive = false;
        state.devicePitchDeg = 0;
        state.deviceRollDeg = 0;
        restoreNavigationMessage();
        updateSourcePill();
      }

      async function toggleAttitude() {
        if (state.attitudeActive) {
          disableAttitude();
          return;
        }

        try {
          if (typeof DeviceOrientationEvent !== "undefined" &&
              typeof DeviceOrientationEvent.requestPermission === "function") {
            const result = await DeviceOrientationEvent.requestPermission();
            if (result !== "granted") {
              throw new Error("SENSOR PERMISSION DENIED");
            }
          }
          window.addEventListener("deviceorientation", handleDeviceOrientation, true);
          state.attitudeActive = true;
          setMessage("ATT LIVE", "DEVICE ATTITUDE ACTIVE", "live");
        } catch (error) {
          state.attitudeActive = false;
          const text = error && error.message ? error.message.toUpperCase() : "DEVICE ATTITUDE UNAVAILABLE";
          setMessage("ATT FAIL", text, "fail");
        }
        updateSourcePill();
      }

      function handleDeviceOrientation(event) {
        if (!state.attitudeActive) {
          return;
        }
        const beta = isFiniteNumber(event.beta) ? event.beta : 0;
        const gamma = isFiniteNumber(event.gamma) ? event.gamma : 0;
        state.devicePitchDeg = smooth(state.devicePitchDeg, clamp(beta, -25, 25), 0.18);
        state.deviceRollDeg = smooth(state.deviceRollDeg, clamp(gamma, -60, 60), 0.18);
      }

      function resetDisplay() {
        state.groundSpeedKt = 0;
        state.trackDeg = 0;
        state.verticalSpeedFpm = 0;
        state.turnRateDps = 0;
        state.pathPitchDeg = 0;
        state.pathBankDeg = 0;
        state.devicePitchDeg = 0;
        state.deviceRollDeg = 0;
        state.lastGpsPoint = null;
        state.gpx.simStart = performance.now();
        state.gpx.simDone = false;
        state.gpx.simLast = null;
        if (state.gpx.loaded) {
          state.gpx.activeLegIndex = 0;
          state.gpx.progressM = 0;
        }
        setMessage("RST", "DISPLAY RESET", "");
      }

      function copyPosition() {
        if (!isFiniteNumber(state.lat) || !isFiniteNumber(state.lon)) {
          setMessage("COPY", "NO POSITION", "fail");
          return;
        }
        const text = state.lat.toFixed(6) + ", " + state.lon.toFixed(6);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text)
            .then(() => setMessage("COPY", text, "live"))
            .catch(() => setMessage("COPY", text, ""));
        } else {
          setMessage("COPY", text, "");
        }
      }

      function updateControls() {
        const age = state.lastFixTime ? (Date.now() - state.lastFixTime) / 1000 : null;
        const route = state.gpx;
        latValue.textContent = isFiniteNumber(state.lat) ? state.lat.toFixed(6) : "--";
        lonValue.textContent = isFiniteNumber(state.lon) ? state.lon.toFixed(6) : "--";
        accValue.textContent = isFiniteNumber(state.accuracy) ? Math.round(state.accuracy) + " m" : "--";
        ageValue.textContent = isFiniteNumber(age) ? age.toFixed(1) + " s" : "--";
        utcValue.textContent = new Date().toISOString().slice(11, 19);
        gpxValue.textContent = route.loaded ? route.name : "--";
        legValue.textContent = route.loaded ? String(route.activeLegIndex + 1) + "/" + String(Math.max(1, route.points.length - 1)) : "--";
        dtkValue.textContent = route.loaded && isFiniteNumber(route.desiredTrackDeg) ? pad3(route.desiredTrackDeg) + " DEG" : "--";
        disValue.textContent = route.loaded && isFiniteNumber(route.distanceToEndNm) ? route.distanceToEndNm.toFixed(1) + " NM" : "--";
      }

      function parseCourse() {
        const value = Number(crsInput.value);
        state.selectedCourseDeg = norm360(Number.isFinite(value) ? value : 0);
        if (state.gpx.loaded) {
          state.gpx.active = false;
        }
        crsInput.value = pad3(state.selectedCourseDeg);
        updateSourcePill();
      }

      function currentCdiSensitivityNm() {
        return CDI_SENSITIVITIES_NM[state.cdiSensitivityIndex] || 1;
      }

      function syncCourseInput() {
        crsInput.value = pad3(state.selectedCourseDeg);
      }

      function activateGpsSoftkey() {
        if (state.gpx.loaded) {
          state.gpx.active = true;
          setMessage("CDI GPS", state.gpx.name + " ACTIVE", "live");
          updateSourcePill();
          return;
        }
        startGps();
      }

      function toggleMapSoftkey() {
        state.mapVisible = !state.mapVisible;
        setMessage("MAP", state.mapVisible ? "MAP ON" : "MAP OFF", state.mapVisible ? "live" : "");
      }

      function toggleBrgSoftkey() {
        state.brgPointerVisible = !state.brgPointerVisible;
        setMessage("BRG", state.brgPointerVisible ? "BRG PTR ON" : "BRG PTR OFF", state.brgPointerVisible ? "live" : "");
      }

      function toggleAltSoftkey() {
        if (isFiniteNumber(state.altitudeBugFt)) {
          state.altitudeBugFt = null;
          setMessage("ALT", "ALT BUG OFF", "");
          return;
        }
        if (!isFiniteNumber(state.altitudeFt)) {
          setMessage("ALT FAIL", "NO GPS ALT", "fail");
          return;
        }
        state.altitudeBugFt = Math.round(state.altitudeFt / 100) * 100;
        setMessage("ALT BUG", formatFt(state.altitudeBugFt) + " FT", "live");
      }

      function syncTrackSoftkey() {
        state.gpx.active = false;
        state.selectedCourseDeg = norm360(state.trackDeg);
        syncCourseInput();
        setMessage("TRK SYNC", pad3(state.selectedCourseDeg) + " DEG", "live");
        updateSourcePill();
      }

      function cycleSensitivitySoftkey() {
        state.cdiSensitivityIndex = (state.cdiSensitivityIndex + 1) % CDI_SENSITIVITIES_NM.length;
        setMessage("SENS", currentCdiSensitivityNm().toFixed(1) + " NM", "live");
      }

      function cycleDeclutterSoftkey() {
        state.declutterLevel = (state.declutterLevel + 1) % 3;
        setMessage("DCLTR", "LEVEL " + state.declutterLevel, state.declutterLevel ? "live" : "");
      }

      function toggleMenuSoftkey() {
        state.menuVisible = !state.menuVisible;
        setMessage("MENU", state.menuVisible ? "MENU ON" : "MENU OFF", state.menuVisible ? "live" : "");
      }

      function handleSoftkey(label) {
        switch (label) {
          case "GPS":
            activateGpsSoftkey();
            break;
          case "MAP":
            toggleMapSoftkey();
            break;
          case "BRG":
            toggleBrgSoftkey();
            break;
          case "ALT":
            toggleAltSoftkey();
            break;
          case "TRK":
            syncTrackSoftkey();
            break;
          case "SENS":
            cycleSensitivitySoftkey();
            break;
          case "DCLTR":
            cycleDeclutterSoftkey();
            break;
          case "MENU":
            toggleMenuSoftkey();
            break;
          default:
            break;
        }
      }

      function canvasPointFromEvent(event) {
        const rect = canvas.getBoundingClientRect();
        return {
          x: (event.clientX - rect.left) * LOGICAL_W / rect.width,
          y: (event.clientY - rect.top) * LOGICAL_H / rect.height
        };
      }

      function softkeyAt(point) {
        return state.softkeyHitboxes.find((box) =>
          point.x >= box.x &&
          point.x <= box.x + box.w &&
          point.y >= box.y &&
          point.y <= box.y + box.h
        );
      }

      function handleCanvasPointerDown(event) {
        const hit = softkeyAt(canvasPointFromEvent(event));
        if (!hit) {
          return;
        }
        event.preventDefault();
        handleSoftkey(hit.label);
      }

      function handleCanvasPointerMove(event) {
        canvas.style.cursor = softkeyAt(canvasPointFromEvent(event)) ? "pointer" : "default";
      }

      function clearRectPath(x, y, w, h) {
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
      }

      function drawRoundedRect(x, y, w, h, r) {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
      }

      function fillTextCentered(text, x, y) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x, y);
      }

      function drawTopBar(w) {
        ctx.fillStyle = "#050608";
        ctx.fillRect(0, 0, w, 54);
        ctx.strokeStyle = "#2d3741";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 54.5);
        ctx.lineTo(w, 54.5);
        ctx.stroke();

        ctx.font = "700 18px Segoe UI, Arial, sans-serif";
        ctx.fillStyle = "#eef5ff";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText("GPS PFD", 20, 27);

        if (state.declutterLevel < 2) {
          drawTopCell(w * 0.19, 0, 125, "GS", Math.round(state.groundSpeedKt) + " KT", "#23d8ff");
          drawTopCell(w * 0.36, 0, 140, "TRK", pad3(state.trackDeg) + " DEG", "#ff40ff");
          drawTopCell(w * 0.54, 0, 140, "ALT", formatFt(state.altitudeFt) + " FT", "#39ff7d");
          drawTopCell(w * 0.73, 0, 135, "VS", Math.round(state.verticalSpeedFpm) + " FPM", "#ffd24d");
        }

        ctx.textAlign = "right";
        ctx.font = "700 14px Segoe UI, Arial, sans-serif";
        ctx.fillStyle = state.source === "GPS" || state.source === "SIM" ? "#39ff7d" : "#ffd24d";
        ctx.fillText(state.source, w - 20, 20);
        ctx.font = "700 11px Segoe UI, Arial, sans-serif";
        ctx.fillStyle = "#9facba";
        ctx.fillText("NOT FOR NAV", w - 20, 38);
      }

      function drawTopCell(x, y, width, label, value, color) {
        ctx.fillStyle = "#080d12";
        ctx.fillRect(x, y + 7, width, 40);
        ctx.strokeStyle = "#26313b";
        ctx.strokeRect(x + 0.5, y + 7.5, width, 40);
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = "700 10px Segoe UI, Arial, sans-serif";
        ctx.fillStyle = "#9facba";
        ctx.fillText(label, x + 8, y + 20);
        ctx.font = "800 17px Segoe UI, Arial, sans-serif";
        ctx.fillStyle = color;
        ctx.fillText(value, x + 8, y + 36);
      }

      function drawAttitude(w, h, layout) {
        const pitch = state.attitudeActive ? state.devicePitchDeg : state.pathPitchDeg;
        const bank = state.attitudeActive ? state.deviceRollDeg : state.pathBankDeg;
        const cx = w / 2;
        const rect = layout.attitude;
        const cy = layout.horizonY + layout.horizonH * 0.46;
        const pxPerDeg = layout.horizonH / 42;
        const big = Math.max(rect.w, rect.h) * 2.4;

        ctx.save();
        clearRectPath(rect.x, rect.y, rect.w, rect.h);
        ctx.fillStyle = "#12161a";
        ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.translate(cx, cy);
        ctx.rotate(toRad(-bank));
        ctx.translate(0, pitch * pxPerDeg);

        ctx.fillStyle = "#1684d7";
        ctx.fillRect(-big, -big, big * 2, big);
        const skyGrad = ctx.createLinearGradient(0, -big, 0, 0);
        skyGrad.addColorStop(0, "#0f5fb0");
        skyGrad.addColorStop(1, "#26a7f5");
        ctx.fillStyle = skyGrad;
        ctx.fillRect(-big, -big, big * 2, big);

        const groundGrad = ctx.createLinearGradient(0, 0, 0, big);
        groundGrad.addColorStop(0, "#9b5f28");
        groundGrad.addColorStop(1, "#5a2f13");
        ctx.fillStyle = groundGrad;
        ctx.fillRect(-big, 0, big * 2, big);

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-big, 0);
        ctx.lineTo(big, 0);
        ctx.stroke();

        drawPitchLadder(pxPerDeg);
        ctx.restore();

        drawRollArc(cx, layout.horizonY + 164, Math.min(112, layout.horizonW * 0.2), bank);
        drawFlightDirector(cx, cy);

        ctx.fillStyle = "#050608";
        drawRoundedRect(cx - 82, layout.horizonY + 10, 164, 28, 4);
        ctx.fill();
        ctx.strokeStyle = "#3c4854";
        ctx.stroke();
        ctx.font = "800 14px Segoe UI, Arial, sans-serif";
        ctx.fillStyle = state.attitudeActive ? "#39ff7d" : "#ffd24d";
        fillTextCentered(state.attitudeActive ? "DEVICE ATT" : "GPS PATH", cx, layout.horizonY + 25);
      }

      function drawPitchLadder(pxPerDeg) {
        ctx.font = "700 13px Segoe UI, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let deg = -30; deg <= 30; deg += 5) {
          if (deg === 0) {
            continue;
          }
          const y = -deg * pxPerDeg;
          const major = deg % 10 === 0;
          const half = major ? 54 : 30;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = major ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(-half - 22, y);
          ctx.lineTo(-22, y);
          ctx.moveTo(22, y);
          ctx.lineTo(half + 22, y);
          ctx.stroke();
          if (major) {
            ctx.fillStyle = "#ffffff";
            ctx.fillText(String(Math.abs(deg)), -half - 42, y + 1);
            ctx.fillText(String(Math.abs(deg)), half + 42, y + 1);
          }
        }
      }

      function drawRollArc(cx, y, radius, bank) {
        ctx.save();
        ctx.translate(cx, y);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius, toRad(210), toRad(330));
        ctx.stroke();

        [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60].forEach((deg) => {
          const a = toRad(270 + deg);
          const len = deg % 30 === 0 ? 15 : 9;
          const x1 = Math.cos(a) * radius;
          const y1 = Math.sin(a) * radius;
          const x2 = Math.cos(a) * (radius - len);
          const y2 = Math.sin(a) * (radius - len);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        });

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(0, -radius - 5);
        ctx.lineTo(-9, -radius - 22);
        ctx.lineTo(9, -radius - 22);
        ctx.closePath();
        ctx.fill();

        ctx.rotate(toRad(-bank));
        ctx.strokeStyle = "#ffd24d";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -radius + 8);
        ctx.lineTo(0, -radius - 12);
        ctx.stroke();
        ctx.restore();
      }

      function drawFlightDirector(cx, cy) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = "#ffd24d";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-118, 0);
        ctx.lineTo(-34, 0);
        ctx.moveTo(34, 0);
        ctx.lineTo(118, 0);
        ctx.moveTo(0, -12);
        ctx.lineTo(0, 28);
        ctx.stroke();

        ctx.fillStyle = "#050608";
        ctx.strokeStyle = "#ffd24d";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.lineTo(0, 15);
        ctx.lineTo(15, 0);
        ctx.lineTo(0, -15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      function drawSpeedTape(layout) {
        const x = layout.speedX;
        const y = layout.tapeY;
        const width = layout.tapeW;
        const height = layout.tapeH;
        const centerY = y + height / 2;
        const value = Math.max(0, state.groundSpeedKt);
        const pxPerKt = height / 72;

        ctx.fillStyle = "#080d12";
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = "#66717d";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
        ctx.save();
        clearRectPath(x, y, width, height);

        const start = Math.floor((value - 45) / 5) * 5;
        const end = value + 45;
        for (let tick = start; tick <= end; tick += 5) {
          if (tick < 0) {
            continue;
          }
          const yy = centerY - (tick - value) * pxPerKt;
          if (yy < y - 15 || yy > y + height + 15) {
            continue;
          }
          const major = tick % 10 === 0;
          ctx.strokeStyle = "#dfefff";
          ctx.lineWidth = major ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(x + width - 34, yy);
          ctx.lineTo(x + width - 8, yy);
          ctx.stroke();
          if (major) {
            ctx.font = "800 15px Segoe UI, Arial, sans-serif";
            ctx.fillStyle = "#eef5ff";
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillText(String(Math.round(tick)), x + width - 42, yy);
          }
        }
        ctx.restore();

        drawReadoutBox(x - 5, centerY - 31, width + 20, 62, Math.round(value), "#23d8ff");
        ctx.font = "800 14px Segoe UI, Arial, sans-serif";
        ctx.fillStyle = "#9facba";
        fillTextCentered("GS KT", x + width / 2, y - 16);
      }

      function drawAltitudeTape(layout) {
        const x = layout.altX;
        const y = layout.tapeY;
        const width = layout.tapeW;
        const height = layout.tapeH;
        const centerY = y + height / 2;
        const value = isFiniteNumber(state.altitudeFt) ? state.altitudeFt : 0;
        const pxPerFt = height / 1400;

        ctx.fillStyle = "#080d12";
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = "#66717d";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
        ctx.save();
        clearRectPath(x, y, width, height);

        const start = Math.floor((value - 850) / 100) * 100;
        const end = value + 850;
        for (let tick = start; tick <= end; tick += 100) {
          const yy = centerY - (tick - value) * pxPerFt;
          if (yy < y - 15 || yy > y + height + 15) {
            continue;
          }
          const major = tick % 500 === 0;
          ctx.strokeStyle = "#dfefff";
          ctx.lineWidth = major ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(x + 8, yy);
          ctx.lineTo(x + (major ? 39 : 27), yy);
          ctx.stroke();
          ctx.font = "800 15px Segoe UI, Arial, sans-serif";
          ctx.fillStyle = "#eef5ff";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(String(Math.round(tick)), x + 45, yy);
        }
        ctx.restore();

        if (isFiniteNumber(state.altitudeBugFt)) {
          const bugY = centerY - (state.altitudeBugFt - value) * pxPerFt;
          if (bugY >= y && bugY <= y + height) {
            ctx.fillStyle = "#39ff7d";
            ctx.strokeStyle = "#04170a";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + 2, bugY);
            ctx.lineTo(x + 22, bugY - 11);
            ctx.lineTo(x + 22, bugY + 11);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }

        drawReadoutBox(x - 15, centerY - 31, width + 20, 62, formatFt(state.altitudeFt), "#39ff7d");
        ctx.font = "800 14px Segoe UI, Arial, sans-serif";
        ctx.fillStyle = "#9facba";
        fillTextCentered("GPS ALT FT", x + width / 2, y - 16);
        drawVsi(x + width + 10, y + 18, 46, height - 36);
      }

      function drawReadoutBox(x, y, w, h, value, color) {
        ctx.fillStyle = "#050608";
        drawRoundedRect(x, y, w, h, 5);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = "900 30px Segoe UI, Arial, sans-serif";
        fillTextCentered(String(value), x + w / 2, y + h / 2 + 1);
      }

      function drawVsi(x, y, w, h) {
        const centerY = y + h / 2;
        ctx.fillStyle = "#070a0e";
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = "#5b6672";
        ctx.strokeRect(x + 0.5, y + 0.5, w, h);
        ctx.strokeStyle = "#eef5ff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 6, centerY);
        ctx.lineTo(x + w - 6, centerY);
        ctx.stroke();

        [-2000, -1000, 1000, 2000].forEach((tick) => {
          const yy = centerY - tick / 2200 * (h / 2 - 10);
          ctx.beginPath();
          ctx.moveTo(x + 8, yy);
          ctx.lineTo(x + 25, yy);
          ctx.stroke();
          ctx.font = "700 10px Segoe UI, Arial, sans-serif";
          ctx.fillStyle = "#eef5ff";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(String(Math.abs(tick / 1000)), x + 29, yy);
        });

        const pointerY = centerY - clamp(state.verticalSpeedFpm, -2200, 2200) / 2200 * (h / 2 - 10);
        ctx.fillStyle = "#ffd24d";
        ctx.beginPath();
        ctx.moveTo(x + 6, pointerY);
        ctx.lineTo(x + w - 10, pointerY - 8);
        ctx.lineTo(x + w - 10, pointerY + 8);
        ctx.closePath();
        ctx.fill();
        ctx.font = "800 10px Segoe UI, Arial, sans-serif";
        ctx.fillStyle = "#9facba";
        fillTextCentered("VSI", x + w / 2, y - 10);
      }

      function drawHsi(w, h, layout) {
        const cx = w / 2;
        const cy = h - 170;
        const radius = Math.min(104, w * 0.15, h * 0.15);
        const track = state.trackDeg;
        const gpxCourseActive = state.gpx.loaded && state.gpx.active && isFiniteNumber(state.gpx.desiredTrackDeg);
        const course = gpxCourseActive ? state.gpx.desiredTrackDeg : state.selectedCourseDeg;
        const diff = shortestDelta(track, course);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = "#080d12";
        ctx.beginPath();
        ctx.arc(0, 0, radius + 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#65717e";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.save();
        ctx.rotate(toRad(-track));
        for (let deg = 0; deg < 360; deg += 5) {
          const a = toRad(deg - 90);
          const major = deg % 30 === 0;
          const mid = deg % 10 === 0;
          const len = major ? 16 : mid ? 11 : 7;
          const r1 = radius;
          const r2 = radius - len;
          ctx.strokeStyle = "#eef5ff";
          ctx.lineWidth = major ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
          ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
          ctx.stroke();
        }

        const labels = [
          [0, "N"], [30, "3"], [60, "6"], [90, "E"],
          [120, "12"], [150, "15"], [180, "S"], [210, "21"],
          [240, "24"], [270, "W"], [300, "30"], [330, "33"]
        ];
        labels.forEach(([deg, label]) => {
          const a = toRad(deg - 90);
          ctx.save();
          ctx.translate(Math.cos(a) * (radius - 32), Math.sin(a) * (radius - 32));
          ctx.rotate(toRad(track));
          ctx.fillStyle = "#eef5ff";
          ctx.font = "900 15px Segoe UI, Arial, sans-serif";
          fillTextCentered(label, 0, 0);
          ctx.restore();
        });
        ctx.restore();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(0, -radius - 21);
        ctx.lineTo(-10, -radius - 4);
        ctx.lineTo(10, -radius - 4);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#ff40ff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, -radius + 17);
        ctx.lineTo(0, -18);
        ctx.moveTo(0, 18);
        ctx.lineTo(0, radius - 16);
        ctx.stroke();

        if (state.brgPointerVisible) {
          const next = state.gpx.loaded
            ? state.gpx.points[Math.min(state.gpx.points.length - 1, state.gpx.activeLegIndex + 1)]
            : null;
          const brg = next && isFiniteNumber(state.lat) && isFiniteNumber(state.lon)
            ? bearingDeg(state.lat, state.lon, next.lat, next.lon)
            : state.trackDeg;
          const angle = toRad(brg - track - 90);
          ctx.strokeStyle = "#23d8ff";
          ctx.fillStyle = "#23d8ff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
          ctx.lineTo(Math.cos(angle) * (radius - 15), Math.sin(angle) * (radius - 15));
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * (radius - 7), Math.sin(angle) * (radius - 7));
          ctx.lineTo(Math.cos(angle + 0.18) * (radius - 25), Math.sin(angle + 0.18) * (radius - 25));
          ctx.lineTo(Math.cos(angle - 0.18) * (radius - 25), Math.sin(angle - 0.18) * (radius - 25));
          ctx.closePath();
          ctx.fill();
        }

        const cdi = gpxCourseActive && isFiniteNumber(state.gpx.crossTrackNm)
          ? clamp(-state.gpx.crossTrackNm / currentCdiSensitivityNm(), -1, 1) * 46
          : clamp(diff / 10, -1, 1) * 46;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        for (let i = -2; i <= 2; i += 1) {
          ctx.beginPath();
          ctx.arc(i * 23, 0, 2.8, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.strokeStyle = "#ff40ff";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(cdi, -62);
        ctx.lineTo(cdi, 62);
        ctx.stroke();

        ctx.fillStyle = "#050608";
        drawRoundedRect(-48, radius + 7, 96, 32, 4);
        ctx.fill();
        ctx.strokeStyle = "#66717d";
        ctx.stroke();
        ctx.font = "900 18px Segoe UI, Arial, sans-serif";
        ctx.fillStyle = "#eef5ff";
        fillTextCentered(pad3(track), 0, radius + 23);

        ctx.font = "800 12px Segoe UI, Arial, sans-serif";
        ctx.fillStyle = "#ff40ff";
        fillTextCentered((gpxCourseActive ? "GPX " : "CRS ") + pad3(course), 0, -radius - 37);
        ctx.fillStyle = "#9facba";
        fillTextCentered("SENS " + currentCdiSensitivityNm().toFixed(1), 0, radius + 52);
        ctx.restore();

        ctx.font = "800 13px Segoe UI, Arial, sans-serif";
        ctx.fillStyle = "#9facba";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const leftText = gpxCourseActive && isFiniteNumber(state.gpx.crossTrackNm)
          ? "XTK " + Math.abs(state.gpx.crossTrackNm).toFixed(2) + " " + (state.gpx.crossTrackNm >= 0 ? "L" : "R")
          : "TURN " + state.turnRateDps.toFixed(1) + " DEG/S";
        ctx.fillText(leftText, layout.horizonX, h - 40);

        ctx.textAlign = "right";
        const age = state.lastFixTime ? ((Date.now() - state.lastFixTime) / 1000).toFixed(1) : "--";
        const rightText = gpxCourseActive && isFiniteNumber(state.gpx.distanceToEndNm)
          ? "GPX DIS " + state.gpx.distanceToEndNm.toFixed(1) + " NM"
          : "GPS AGE " + age + " S";
        ctx.fillText(rightText, layout.horizonX + layout.horizonW, h - 40);
      }

      function drawDataBlocks(w, h, layout) {
        const y = h - 72;
        const blockW = 145;
        const blockH = 44;
        const labels = state.gpx.loaded ? [
          ["DTK", isFiniteNumber(state.gpx.desiredTrackDeg) ? pad3(state.gpx.desiredTrackDeg) + " DEG" : "--"],
          ["NEXT", state.gpx.nextName || "--"],
          ["ETE", isFiniteNumber(state.gpx.eteMin) ? Math.round(state.gpx.eteMin) + " MIN" : "--"]
        ] : [
          ["LAT", isFiniteNumber(state.lat) ? state.lat.toFixed(5) : "--"],
          ["LON", isFiniteNumber(state.lon) ? state.lon.toFixed(5) : "--"],
          ["ACC", isFiniteNumber(state.accuracy) ? Math.round(state.accuracy) + " M" : "--"]
        ];

        labels.forEach((item, index) => {
          const x = index === 0 ? 18 : index === 1 ? w - blockW - 18 : w - blockW - 18;
          const yy = index === 2 ? y - blockH - 8 : y;
          ctx.fillStyle = "#080d12";
          ctx.fillRect(x, yy, blockW, blockH);
          ctx.strokeStyle = "#26313b";
          ctx.strokeRect(x + 0.5, yy + 0.5, blockW, blockH);
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.font = "700 10px Segoe UI, Arial, sans-serif";
          ctx.fillStyle = "#9facba";
          ctx.fillText(item[0], x + 8, yy + 14);
          ctx.font = "800 15px Segoe UI, Arial, sans-serif";
          ctx.fillStyle = "#eef5ff";
          ctx.fillText(item[1], x + 8, yy + 31);
        });
      }

      function drawMapOverlay(w, h, layout) {
        if (!state.mapVisible || state.declutterLevel >= 2) {
          return;
        }

        const x = layout.horizonX + 18;
        const y = layout.horizonY + 62;
        const boxW = 198;
        const boxH = 148;
        ctx.fillStyle = "rgba(5, 8, 12, 0.82)";
        drawRoundedRect(x, y, boxW, boxH, 4);
        ctx.fill();
        ctx.strokeStyle = "#23d8ff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = "800 11px Segoe UI, Arial, sans-serif";
        ctx.fillStyle = "#23d8ff";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("MAP", x + 10, y + 14);

        const pad = 18;
        const left = x + pad;
        const top = y + 28;
        const width = boxW - pad * 2;
        const height = boxH - 42;

        if (state.gpx.loaded && state.gpx.points.length > 1) {
          const points = state.gpx.points;
          let minLat = Math.min(...points.map((point) => point.lat));
          let maxLat = Math.max(...points.map((point) => point.lat));
          let minLon = Math.min(...points.map((point) => point.lon));
          let maxLon = Math.max(...points.map((point) => point.lon));
          if (isFiniteNumber(state.lat) && isFiniteNumber(state.lon)) {
            minLat = Math.min(minLat, state.lat);
            maxLat = Math.max(maxLat, state.lat);
            minLon = Math.min(minLon, state.lon);
            maxLon = Math.max(maxLon, state.lon);
          }
          const latSpan = Math.max(0.0001, maxLat - minLat);
          const lonSpan = Math.max(0.0001, maxLon - minLon);
          const plot = (point) => ({
            x: left + (point.lon - minLon) / lonSpan * width,
            y: top + height - (point.lat - minLat) / latSpan * height
          });

          ctx.save();
          clearRectPath(left, top, width, height);
          ctx.strokeStyle = "rgba(238,245,255,0.72)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          points.forEach((point, index) => {
            const p = plot(point);
            if (index === 0) {
              ctx.moveTo(p.x, p.y);
            } else {
              ctx.lineTo(p.x, p.y);
            }
          });
          ctx.stroke();

          if (state.gpx.activeLegIndex < points.length - 1) {
            const from = plot(points[state.gpx.activeLegIndex]);
            const to = plot(points[state.gpx.activeLegIndex + 1]);
            ctx.strokeStyle = "#ff40ff";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
          }

          if (isFiniteNumber(state.lat) && isFiniteNumber(state.lon)) {
            const own = plot({ lat: state.lat, lon: state.lon });
            ctx.fillStyle = "#ffd24d";
            ctx.beginPath();
            ctx.arc(own.x, own.y, 5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        } else {
          const cx = left + width / 2;
          const cy = top + height / 2;
          ctx.strokeStyle = "#627181";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, 38, 0, Math.PI * 2);
          ctx.stroke();
          const angle = toRad(state.trackDeg - 90);
          ctx.strokeStyle = "#ffd24d";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(angle) * 45, cy + Math.sin(angle) * 45);
          ctx.stroke();
          ctx.fillStyle = "#ffd24d";
          ctx.beginPath();
          ctx.arc(cx, cy, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      function drawMenuOverlay(w, h, layout) {
        if (!state.menuVisible) {
          return;
        }

        const x = w / 2 - 138;
        const y = layout.horizonY + 52;
        const boxW = 276;
        const boxH = 184;
        const rows = [
          ["CDI", state.gpx.loaded && state.gpx.active ? "GPX" : "CRS"],
          ["MAP", state.mapVisible ? "ON" : "OFF"],
          ["BRG", state.brgPointerVisible ? "ON" : "OFF"],
          ["ALT", isFiniteNumber(state.altitudeBugFt) ? formatFt(state.altitudeBugFt) : "OFF"],
          ["SENS", currentCdiSensitivityNm().toFixed(1) + " NM"],
          ["DCLTR", String(state.declutterLevel)]
        ];

        ctx.fillStyle = "rgba(5, 8, 12, 0.9)";
        drawRoundedRect(x, y, boxW, boxH, 5);
        ctx.fill();
        ctx.strokeStyle = "#7e8c9b";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = "900 16px Segoe UI, Arial, sans-serif";
        ctx.fillStyle = "#eef5ff";
        fillTextCentered("MENU", x + boxW / 2, y + 22);

        rows.forEach((row, index) => {
          const yy = y + 50 + index * 20;
          ctx.font = "800 12px Segoe UI, Arial, sans-serif";
          ctx.textBaseline = "middle";
          ctx.textAlign = "left";
          ctx.fillStyle = "#9facba";
          ctx.fillText(row[0], x + 26, yy);
          ctx.textAlign = "right";
          ctx.fillStyle = "#eef5ff";
          ctx.fillText(row[1], x + boxW - 26, yy);
        });
      }

      function drawAlerts(w, h, layout) {
        const age = state.lastFixTime ? (Date.now() - state.lastFixTime) / 1000 : Infinity;
        let alert = "";
        let color = "#ffd24d";
        if (state.source === "FAIL") {
          alert = "GPS FAIL";
          color = "#ff4646";
        } else if (state.source === "OFF") {
          alert = "NO GPS";
        } else if (age > 5 && !state.demoActive) {
          alert = "GPS DATA OLD";
          color = "#ff4646";
        } else if (isFiniteNumber(state.accuracy) && state.accuracy > 50) {
          alert = "GPS ACC LOW";
        } else if (!state.gpsHeadingValid && !state.demoActive) {
          alert = "TRK EST";
        }

        if (!alert) {
          return;
        }
        const x = layout.horizonX + layout.horizonW / 2 - 105;
        const y = layout.horizonY + layout.horizonH - 60;
        ctx.fillStyle = color === "#ff4646" ? "rgba(130,0,0,0.92)" : "rgba(125,84,0,0.92)";
        drawRoundedRect(x, y, 210, 38, 4);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 20px Segoe UI, Arial, sans-serif";
        fillTextCentered(alert, x + 105, y + 20);
      }

      function drawSoftkeys(w, h) {
        const count = SOFTKEYS.length;
        const gap = 4;
        const keyW = (w - gap * (count + 1)) / count;
        const y = h - 24;
        state.softkeyHitboxes = [];
        ctx.fillStyle = "#030405";
        ctx.fillRect(0, h - 30, w, 30);
        SOFTKEYS.forEach((label, index) => {
          const x = gap + index * (keyW + gap);
          const active = isSoftkeyActive(label);
          state.softkeyHitboxes.push({ label, x, y, w: keyW, h: 20 });
          ctx.fillStyle = active ? "#39ff7d" : "#10161d";
          ctx.fillRect(x, y, keyW, 20);
          ctx.strokeStyle = active ? "#96ffb5" : "#33404b";
          ctx.strokeRect(x + 0.5, y + 0.5, keyW, 20);
          ctx.font = "800 10px Segoe UI, Arial, sans-serif";
          ctx.fillStyle = active ? "#001808" : "#9facba";
          fillTextCentered(softkeyDisplayLabel(label), x + keyW / 2, y + 10);
        });
      }

      function isSoftkeyActive(label) {
        switch (label) {
          case "GPS":
            return state.gpx.loaded ? state.gpx.active : state.gpsActive;
          case "MAP":
            return state.mapVisible;
          case "BRG":
            return state.brgPointerVisible;
          case "ALT":
            return isFiniteNumber(state.altitudeBugFt);
          case "SENS":
            return state.cdiSensitivityIndex !== 1;
          case "DCLTR":
            return state.declutterLevel > 0;
          case "MENU":
            return state.menuVisible;
          default:
            return false;
        }
      }

      function softkeyDisplayLabel(label) {
        if (label === "SENS") {
          return "SENS " + currentCdiSensitivityNm().toFixed(1);
        }
        if (label === "DCLTR" && state.declutterLevel > 0) {
          return "DCLTR " + state.declutterLevel;
        }
        return label;
      }

      function drawPfd() {
        resizeCanvas();
        const w = LOGICAL_W;
        const h = LOGICAL_H;
        const layout = {
          tapeY: 86,
          tapeH: h - 250,
          tapeW: 104,
          speedX: 34,
          altX: w - 168,
          horizonX: 156,
          horizonY: 66,
          horizonW: w - 312,
          horizonH: h - 244,
          attitude: {
            x: 0,
            y: 54,
            w,
            h: h - 84
          }
        };

        ctx.clearRect(0, 0, w, h);
        drawAttitude(w, h, layout);
        drawTopBar(w);
        drawSpeedTape(layout);
        drawAltitudeTape(layout);
        drawHsi(w, h, layout);
        if (state.declutterLevel < 1) {
          drawDataBlocks(w, h, layout);
        }
        drawMapOverlay(w, h, layout);
        drawAlerts(w, h, layout);
        drawMenuOverlay(w, h, layout);
        drawSoftkeys(w, h);
      }

      function tick(now) {
        updateSimulation(now);
        updateGpxNavigation();
        updateControls();
        drawPfd();
        requestAnimationFrame(tick);
      }

      gpsButton.addEventListener("click", startGps);
      demoButton.addEventListener("click", toggleDemo);
      gpxButton.addEventListener("click", openGpxPicker);
      gpxInput.addEventListener("change", handleGpxFile);
      attitudeButton.addEventListener("click", toggleAttitude);
      resetButton.addEventListener("click", resetDisplay);
      copyButton.addEventListener("click", copyPosition);
      crsInput.addEventListener("change", parseCourse);
      crsInput.addEventListener("blur", parseCourse);
      canvas.addEventListener("pointerdown", handleCanvasPointerDown);
      canvas.addEventListener("pointermove", handleCanvasPointerMove);
      canvas.addEventListener("pointerleave", () => {
        canvas.style.cursor = "default";
      });
      window.addEventListener("resize", resizeCanvas);

      setMessage("STBY", "GPS OFF", "");
      updateSourcePill();
      requestAnimationFrame(tick);
    }());
  
}
