(function () {
  "use strict";

  const NM_PER_DEG = 60;
  const EARTH_RADIUS_NM = 3440.065;
  const DEFAULT_BOUNDS = {
    minLat: 48.65,
    maxLat: 55.15,
    minLon: 13.75,
    maxLon: 24.45
  };
  const FREQUENCY_DRAFT_KEY = "nordsweet.frequencyEditorDraft.v1";
  const frequencyDraftCache = {
    raw: undefined,
    payload: null
  };

  const POLAND_OUTLINE = [
    [54.83, 18.35], [54.72, 19.65], [54.36, 22.75], [53.95, 23.55],
    [52.95, 23.95], [52.10, 23.70], [51.32, 24.08], [50.40, 23.62],
    [49.56, 22.86], [49.04, 22.45], [49.05, 20.02], [49.42, 18.72],
    [49.52, 17.06], [50.10, 16.30], [50.82, 14.82], [51.20, 14.62],
    [52.02, 14.72], [53.00, 14.18], [53.88, 14.22], [54.38, 16.10],
    [54.66, 17.05], [54.83, 18.35]
  ].map(([lat, lon]) => ({ lat, lon }));

  const AIRSPACE_TYPES = [
    "ATZ", "CTR", "MCTR", "TMA", "MTMA", "MATZ", "TRA", "TSA",
    "P", "R", "D", "ADIZ", "FIS", "RMZ", "TMZ", "OTHER"
  ];

  const TYPE_STYLE = {
    ATZ: { stroke: "#b35a00", fill: "rgba(255, 156, 45, 0.13)" },
    CTR: { stroke: "#682f9d", fill: "rgba(137, 82, 188, 0.12)" },
    MCTR: { stroke: "#6134b6", fill: "rgba(110, 92, 210, 0.12)" },
    TMA: { stroke: "#8540a8", fill: "rgba(173, 101, 214, 0.09)" },
    MTMA: { stroke: "#6a47b8", fill: "rgba(132, 119, 220, 0.1)" },
    MATZ: { stroke: "#80612a", fill: "rgba(201, 157, 70, 0.11)" },
    TRA: { stroke: "#20839b", fill: "rgba(73, 178, 207, 0.12)" },
    TSA: { stroke: "#22935f", fill: "rgba(72, 188, 118, 0.11)" },
    P: { stroke: "#bb2e42", fill: "rgba(225, 54, 80, 0.16)" },
    R: { stroke: "#d4576f", fill: "rgba(221, 85, 114, 0.12)" },
    D: { stroke: "#c06c00", fill: "rgba(222, 142, 31, 0.12)" },
    ADIZ: { stroke: "#354e92", fill: "rgba(77, 99, 168, 0.08)" },
    FIS: { stroke: "#307b4a", fill: "rgba(105, 180, 116, 0.05)" },
    RMZ: { stroke: "#7b6b1a", fill: "rgba(180, 168, 84, 0.10)" },
    TMZ: { stroke: "#896125", fill: "rgba(185, 137, 68, 0.10)" },
    OTHER: { stroke: "#68717f", fill: "rgba(104, 113, 127, 0.08)" }
  };

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function slug(value) {
    return clean(value)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "ZONE";
  }

  function searchKey(value) {
    return clean(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function toNumber(value, fallback = 0) {
    const number = Number(String(value == null ? "" : value).replace(",", "."));
    return Number.isFinite(number) ? number : fallback;
  }

  function decimalFromDms(deg, min, sec, hemi) {
    const sign = /[SW]/i.test(hemi) ? -1 : 1;
    return sign * (Number(deg) + Number(min) / 60 + Number(sec || 0) / 3600);
  }

  function decimalFromCup(value, isLon) {
    const match = clean(value).match(isLon
      ? /^(\d{3})(\d{2}(?:\.\d+)?)([EW])$/i
      : /^(\d{2})(\d{2}(?:\.\d+)?)([NS])$/i);
    if (!match) {
      return NaN;
    }
    const sign = /[SW]/i.test(match[3]) ? -1 : 1;
    return sign * (Number(match[1]) + Number(match[2]) / 60);
  }

  function parseCoordPair(raw) {
    let text = clean(raw)
      .replace(/^DP\s+/i, "")
      .replace(/^V\s+X\s*=\s*/i, "")
      .replace(/^X\s*=\s*/i, "")
      .replace(/[()]/g, " ");

    const openAir = text.match(/(\d{1,2})[: ](\d{1,2})[: ](\d{1,2}(?:\.\d+)?)\s*([NS])\s+(\d{1,3})[: ](\d{1,2})[: ](\d{1,2}(?:\.\d+)?)\s*([EW])/i);
    if (openAir) {
      return {
        lat: decimalFromDms(openAir[1], openAir[2], openAir[3], openAir[4]),
        lon: decimalFromDms(openAir[5], openAir[6], openAir[7], openAir[8])
      };
    }

    const cup = text.match(/(\d{2}\d{2}(?:\.\d+)?[NS])\s*[,;\s]\s*(\d{3}\d{2}(?:\.\d+)?[EW])/i);
    if (cup) {
      return {
        lat: decimalFromCup(cup[1], false),
        lon: decimalFromCup(cup[2], true)
      };
    }

    const decimal = text.match(/(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)/);
    if (decimal) {
      const lat = Number(decimal[1]);
      const lon = Number(decimal[2]);
      if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        return { lat, lon };
      }
    }

    return null;
  }

  function normalizeRouteCoordinateToken(value) {
    return clean(value).toUpperCase().replace(/[^0-9NSEW]/g, "");
  }

  function getRouteCanonicalCoordinateToken(value, axis) {
    const token = normalizeRouteCoordinateToken(value);
    const isLatitude = axis === "lat";
    const suffixMatch = token.match(isLatitude ? /^(\d{6})([NS])$/ : /^(\d{7})([EW])$/);
    if (suffixMatch) {
      return suffixMatch[1] + suffixMatch[2];
    }

    const prefixMatch = token.match(isLatitude ? /^([NS])(\d{6})$/ : /^([EW])(\d{7})$/);
    if (prefixMatch) {
      return prefixMatch[2] + prefixMatch[1];
    }

    return token;
  }

  function parseRouteCompactDmsToken(value, axis) {
    const token = getRouteCanonicalCoordinateToken(value, axis);
    const isLatitude = axis === "lat";
    const match = token.match(isLatitude ? /^(\d{2})(\d{2})(\d{2})([NS])$/ : /^(\d{3})(\d{2})(\d{2})([EW])$/);
    if (!match) {
      return null;
    }

    const degrees = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const hemisphere = match[4];
    const maxDegrees = isLatitude ? 90 : 180;
    if (
      degrees > maxDegrees ||
      minutes > 59 ||
      seconds > 59 ||
      (degrees === maxDegrees && (minutes > 0 || seconds > 0))
    ) {
      return null;
    }

    const decimal = degrees + minutes / 60 + seconds / 3600;
    return hemisphere === "S" || hemisphere === "W" ? -decimal : decimal;
  }

  function parseRouteCoordinatePair(latToken, lonToken) {
    const normalizedLat = getRouteCanonicalCoordinateToken(latToken, "lat");
    const normalizedLon = getRouteCanonicalCoordinateToken(lonToken, "lon");
    const lat = parseRouteCompactDmsToken(normalizedLat, "lat");
    const lon = parseRouteCompactDmsToken(normalizedLon, "lon");
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    return {
      id: normalizedLat + normalizedLon,
      label: normalizedLat + " " + normalizedLon,
      lat,
      lon
    };
  }

  function createRouteCoordinateToken(latToken, lonToken) {
    const coordinate = parseRouteCoordinatePair(latToken, lonToken);
    return coordinate ? "COORD_" + coordinate.id : "";
  }

  function parseRouteCoordinateToken(token) {
    const match = clean(token).toUpperCase().match(/^COORD_(\d{6}[NS])(\d{7}[EW])$/);
    return match ? parseRouteCoordinatePair(match[1], match[2]) : null;
  }

  function createRoutePointFromCoordinateToken(token) {
    const coordinate = parseRouteCoordinateToken(token);
    if (!coordinate) {
      return null;
    }

    return {
      id: coordinate.id,
      key: coordinate.id,
      kind: "coordinate",
      mapKind: "coordinate",
      label: coordinate.label,
      lat: coordinate.lat,
      lon: coordinate.lon,
      name: coordinate.label
    };
  }

  function apiConfig() {
    return window.NORDSWEET_AIRSPACE_API || {};
  }

  async function fetchTextWithTimeout(url, timeoutMs) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs || 12000) : null;
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller ? controller.signal : undefined
      });
      if (!response.ok) {
        throw new Error(response.status + " " + response.statusText);
      }
      return await response.text();
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  async function fetchConfiguredSource(key, options) {
    const opts = options || {};
    const entry = apiConfig()[key];
    if (!entry) {
      throw new Error("Unknown airspace API key: " + key);
    }

    const attempts = [];
    if (opts.preferProxy !== false) {
      attempts.push({ label: "proxy", url: "api/source/" + encodeURIComponent(key) });
    }
    if (opts.direct !== false && entry.direct !== false && entry.url) {
      attempts.push({ label: "api", url: entry.url });
    }
    if (entry.local) {
      attempts.push({ label: "local", url: entry.local });
    }
    if (entry.path) {
      attempts.push({ label: "import", url: entry.path });
    }
    const staticStore = window.NORDSWEET_STATIC_AIRSPACE_TEXT || {};
    const staticKey = entry.staticKey || key;
    if (typeof staticStore[staticKey] === "string" && staticStore[staticKey]) {
      attempts.push({ label: "static", text: staticStore[staticKey] });
    }

    const errors = [];
    for (const attempt of attempts) {
      try {
        if (typeof attempt.text === "string") {
          return {
            key,
            entry,
            text: attempt.text,
            source: attempt.label,
            url: ""
          };
        }
        const text = await fetchTextWithTimeout(attempt.url, opts.timeoutMs || 14000);
        return {
          key,
          entry,
          text,
          source: attempt.label,
          url: attempt.url
        };
      } catch (error) {
        errors.push(attempt.label + ": " + (error && error.message ? error.message : String(error)));
      }
    }
    throw new Error(errors.join(" | "));
  }

  function parseCsvLine(line) {
    const cells = [];
    let cell = "";
    let quoted = false;
    const text = String(line || "");
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (char === "\"" && quoted && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        cells.push(cell);
        cell = "";
      } else {
        cell += char;
      }
    }
    cells.push(cell);
    return cells.map(clean);
  }

  function parseCup(text, sourceName) {
    const lines = String(text || "").split(/\r?\n/).filter((line) => clean(line));
    if (!lines.length) {
      return { source: sourceName || "CUP", rows: [], airports: [], points: [] };
    }
    const header = parseCsvLine(lines[0]).map((name) => searchKey(name).toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const cells = parseCsvLine(line);
      const row = {};
      header.forEach((key, index) => {
        row[key] = cells[index] || "";
      });
      const lat = decimalFromCup(row.lat, false);
      const lon = decimalFromCup(row.lon, true);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
      }
      const style = Number(row.style);
      const name = row.name || row.code || "";
      const code = row.code || row.name || "";
      const isVfr = style === 1 || /Punkt VFR|VFR/i.test(row.desc || "");
      return {
        id: searchKey(code || name).slice(0, 8),
        key: searchKey(code || name).slice(0, 8),
        icao: /^[A-Z]{4}$/.test(searchKey(code)) ? searchKey(code) : "",
        code,
        name,
        lat,
        lon,
        elevationM: toNumber(row.elev, 0),
        style,
        kind: isVfr ? "vfr-reporting-point" : "aerodrome",
        rules: isVfr ? "VFR" : "",
        ruleSet: isVfr ? "VFR" : "",
        cup: {
          importFile: sourceName || "Nasze_Trawniki_PunktyVFR_PL.cup",
          name,
          code,
          country: row.country || "",
          style,
          kind: isVfr ? "vfr-reporting-point" : "aerodrome",
          elevationM: toNumber(row.elev, 0),
          runwayDirection: toNumber(row.rwdir, 0),
          runwayLengthM: toNumber(row.rwlen, 0),
          frequency: row.freq || "",
          description: row.desc || ""
        },
        frequency: row.freq || "",
        source: sourceName || "CUP API",
        sourceDescription: row.desc || "",
        mapKind: isVfr ? "vfr" : "airport"
      };
    }).filter(Boolean);
    return {
      source: sourceName || "CUP",
      rows,
      airports: rows.filter((row) => row.kind !== "vfr-reporting-point"),
      points: rows.filter((row) => row.kind === "vfr-reporting-point")
    };
  }

  function formatDms(value, isLon) {
    const hemi = value < 0 ? (isLon ? "W" : "S") : (isLon ? "E" : "N");
    let abs = Math.abs(Number(value) || 0);
    let deg = Math.floor(abs);
    abs = (abs - deg) * 60;
    let min = Math.floor(abs);
    let sec = Math.round((abs - min) * 60);
    if (sec >= 60) {
      sec = 0;
      min += 1;
    }
    if (min >= 60) {
      min = 0;
      deg += 1;
    }
    const degWidth = isLon ? 3 : 2;
    return String(deg).padStart(degWidth, "0") + ":" +
      String(min).padStart(2, "0") + ":" +
      String(sec).padStart(2, "0") + " " + hemi;
  }

  function formatOpenAirCoord(point) {
    return formatDms(point.lat, false) + " " + formatDms(point.lon, true);
  }

  function inferAirspaceKind(name, classType) {
    const text = searchKey(name + " " + classType);
    if (/^EPTR/.test(text) || /TRA/.test(text)) return "TRA";
    if (/^EPTS/.test(text) || /TSA/.test(text)) return "TSA";
    if (/^EPP/.test(text) || /\bP\b/.test(clean(name).toUpperCase())) return "P";
    if (/^EPR/.test(text) || /\bR\b/.test(clean(name).toUpperCase())) return "R";
    const ordered = ["MCTR", "MTMA", "MATZ", "ATZ", "CTR", "TMA", "ADIZ", "RMZ", "TMZ", "FIS", "D"];
    return ordered.find((type) => text.includes(type)) || "OTHER";
  }

  function parseOpenAir(text, sourceName) {
    const zones = [];
    let current = null;
    const source = clean(sourceName) || "OpenAir";

    function pushCurrent() {
      if (!current) {
        return;
      }
      const hasCircle = current.circle && current.circle.center && Number.isFinite(current.circle.radiusNm);
      const hasPolygon = current.points && current.points.length >= 2;
      if (!hasCircle && !hasPolygon) {
        current = null;
        return;
      }
      current.shape = hasCircle ? "circle" : "polygon";
      current.kind = current.kind || inferAirspaceKind(current.name, current.classType);
      current.designator = getDesignator(current.name);
      current.id = current.id || [
        slug(source),
        String(zones.length + 1).padStart(4, "0"),
        slug(current.name)
      ].join("-");
      zones.push(current);
      current = null;
    }

    String(text || "").split(/\r?\n/).forEach((rawLine) => {
      const line = clean(rawLine);
      if (!line || line.startsWith("*")) {
        return;
      }
      if (/^AC\s+/i.test(line)) {
        pushCurrent();
        const classType = clean(line.replace(/^AC\s+/i, ""));
        current = {
          id: "",
          name: "",
          designator: "",
          classType,
          kind: inferAirspaceKind("", classType),
          lower: "",
          upper: "",
          shape: "polygon",
          points: [],
          circle: null,
          frequencies: [],
          source
        };
        return;
      }
      if (!current) {
        return;
      }
      if (/^AN\s+/i.test(line)) {
        current.name = clean(line.replace(/^AN\s+/i, ""));
        current.kind = inferAirspaceKind(current.name, current.classType);
        current.designator = getDesignator(current.name);
      } else if (/^AL\s+/i.test(line)) {
        current.lower = clean(line.replace(/^AL\s+/i, ""));
      } else if (/^AH\s+/i.test(line)) {
        current.upper = clean(line.replace(/^AH\s+/i, ""));
      } else if (/^DP\s+/i.test(line)) {
        const point = parseCoordPair(line);
        if (point) {
          current.points.push(point);
        }
      } else if (/^V\s+X\s*=/i.test(line)) {
        const center = parseCoordPair(line);
        if (center) {
          current.circle = current.circle || {};
          current.circle.center = center;
        }
      } else if (/^DC\s+/i.test(line)) {
        current.circle = current.circle || {};
        current.circle.radiusNm = toNumber(line.replace(/^DC\s+/i, ""), NaN);
      }
    });
    pushCurrent();
    return zones;
  }

  function exportOpenAir(zones) {
    return (Array.isArray(zones) ? zones : []).map((zone) => {
      const lines = [
        "AC " + clean(zone.classType || zone.kind || "G"),
        "AN " + clean(zone.name || zone.designator || "AIRSPACE"),
        "AL " + clean(zone.lower || "GND"),
        "AH " + clean(zone.upper || "FL95")
      ];
      if (Array.isArray(zone.frequencies) && zone.frequencies.length) {
        lines.push("* Frequencies: " + zone.frequencies.map(formatFrequencyShort).join("; "));
      }
      if (zone.shape === "circle" && zone.circle && zone.circle.center) {
        lines.push("V X=" + formatOpenAirCoord(zone.circle.center));
        lines.push("DC " + (Number(zone.circle.radiusNm) || 0).toFixed(3));
      } else {
        (zone.points || []).forEach((point) => {
          lines.push("DP " + formatOpenAirCoord(point));
        });
      }
      return lines.join("\n");
    }).join("\n\n") + "\n";
  }

  function getDesignator(name) {
    const text = clean(name).toUpperCase();
    const match = text.match(/[A-Z]{2,5}[A-Z0-9-]*/);
    return match ? match[0] : "";
  }

  function parsePansaAup(html, label) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    const bodyText = doc.body ? doc.body.textContent || "" : String(html || "");
    const lastUpdate = (bodyText.match(/lastUpdate[^\d]*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/i) || [])[1] || "";
    const validityMatch = bodyText.match(/validity[^\d]*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*-\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/i);
    const rows = [];
    doc.querySelectorAll("tr").forEach((row) => {
      const cells = Array.from(row.querySelectorAll("td")).map((cell) => clean(cell.textContent).replace(/\s+/g, " "));
      if (cells.length < 6 || !/^\d+$/.test(cells[0]) || !/^[A-Z]{2,5}[A-Z0-9-]+$/.test(cells[1] || "")) {
        return;
      }
      rows.push({
        no: cells[0],
        designator: cells[1],
        lower: cells[2] || "",
        upper: cells[3] || "",
        start: cells[4] || "",
        end: cells[5] || "",
        unit: cells[6] || "",
        fuaStatus: cells[7] || "",
        remarks: cells.slice(8).join(" "),
        source: clean(label) || "PANSA AUP"
      });
    });
    return {
      label: clean(label) || "PANSA AUP",
      lastUpdate,
      validityStart: validityMatch ? validityMatch[1] : "",
      validityEnd: validityMatch ? validityMatch[2] : "",
      rows
    };
  }

  function czechAupBodyText(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    return (doc.body ? doc.body.textContent || "" : String(html || ""))
      .replace(/\u00a0/g, " ")
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ");
  }

  function parseCzechAupDocument(html, label) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    const bodyText = czechAupBodyText(html);
    const validity = bodyText.match(/from\s+(\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\s+\d{2}:\d{2})\s+until\s+(\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\s+\d{2}:\d{2})/i);
    const rows = [];
    const seen = new Set();
    doc.querySelectorAll("tr").forEach((row) => {
      const cells = Array.from(row.querySelectorAll("td,th"))
        .map((cell) => clean(cell.textContent).replace(/\s+/g, " "));
      if (cells.length < 6 || !/^\d+\.?$/.test(cells[0] || "") || !/^[A-Z][A-Z0-9-]{1,}$/.test(cells[1] || "")) {
        return;
      }
      const designator = clean(cells[1]).toUpperCase();
      const details = cells.slice(2).join("|");
      if (!designator || seen.has(designator + "|" + details)) return;
      seen.add(designator + "|" + details);
      rows.push({
        no: cells[0].replace(/\.$/, ""),
        designator,
        lower: cells[2] || "",
        upper: cells[3] || "",
        start: cells[4] || "",
        end: cells[5] || "",
        unit: cells[6] || "",
        remarks: cells.slice(7).join(" "),
        cancelled: /\bCNL\b/i.test(cells.slice(6).join(" ")),
        source: clean(label) || "ANS CR AUP/UUP"
      });
    });
    return {
      label: clean(label) || "ANS CR AUP/UUP",
      validityStart: validity ? validity[1].replace(/\s+/g, " ") : "",
      validityEnd: validity ? validity[2].replace(/\s+/g, " ") : "",
      rows
    };
  }

  function parseCzechAupPackage(value, label) {
    let payload = value;
    try {
      if (typeof value === "string") payload = JSON.parse(value);
    } catch (error) {
      payload = { documents: [{ kind: "AUP", label, html: value }] };
    }
    const documents = Array.isArray(payload && payload.documents) ? payload.documents : [];
    const parsed = documents.map((document, index) => parseCzechAupDocument(
      document && document.html,
      clean(document && document.label) || clean(label) || "ANS CR AUP/UUP " + (index + 1)
    ));
    // A valid UUP amends the preceding AUP. CNL entries remove the matching
    // AUP area; later non-cancelled rows replace its activation details.
    const activeRows = new Map();
    parsed.forEach((plan) => plan.rows.forEach((row) => {
      const key = searchKey(row.designator);
      if (!key) return;
      if (row.cancelled) {
        activeRows.delete(key);
      } else {
        activeRows.set(key, row);
      }
    }));
    const rows = Array.from(activeRows.values());
    return {
      label: clean(label) || "ANS CR AUP/UUP",
      validityStart: parsed.map((plan) => plan.validityStart).find(Boolean) || "",
      validityEnd: parsed.map((plan) => plan.validityEnd).find(Boolean) || "",
      lastUpdate: clean(payload && payload.fetchedAt),
      rows
    };
  }

  function czechProperty(properties, keys) {
    const source = properties && typeof properties === "object" ? properties : {};
    const lookup = Object.keys(source).reduce((result, key) => {
      result[String(key).replace(/[^A-Z0-9]/gi, "").toUpperCase()] = source[key];
      return result;
    }, {});
    for (const key of keys) {
      const value = lookup[String(key).replace(/[^A-Z0-9]/gi, "").toUpperCase()];
      if (value != null && clean(typeof value === "object" ? value.value || value.name : value)) {
        return clean(typeof value === "object" ? value.value || value.name : value);
      }
    }
    return "";
  }

  function czechZoneKind(value) {
    const token = clean(value).toUpperCase();
    if (/\bTSA\b/.test(token)) return "TSA";
    if (/\bTRA\b/.test(token)) return "TRA";
    if (/\bTMA\b/.test(token)) return "TMA";
    if (/\bRMZ\b/.test(token)) return "RMZ";
    if (/\bTMZ\b/.test(token)) return "TMZ";
    if (/\bCTR\b/.test(token)) return "CTR";
    if (/\bLKD\b|\bD\d/.test(token)) return "D";
    if (/\bLKP\b|\bP\d/.test(token)) return "P";
    return "OTHER";
  }

  function czechGeoJsonRings(geometry) {
    if (!geometry || !Array.isArray(geometry.coordinates)) return [];
    if (geometry.type === "Polygon") return [geometry.coordinates[0]];
    if (geometry.type === "MultiPolygon") return geometry.coordinates.map((polygon) => polygon[0]);
    return [];
  }

  function parseCzechLkr320a(value, label) {
    let geoJson = value;
    if (typeof value === "string") geoJson = JSON.parse(value);
    const zones = [];
    (geoJson && Array.isArray(geoJson.features) ? geoJson.features : []).forEach((feature, featureIndex) => {
      const properties = Object.assign({}, feature && feature.properties, feature && feature.properties && feature.properties.zoneProperties);
      const text = [
        czechProperty(properties, ["identifier", "designator", "ident", "name", "title", "zoneName", "id"]),
        czechProperty(properties, ["type", "class", "category", "zoneType"])
      ].filter(Boolean).join(" ");
      const designator = (text.match(/\b(?:LKP|LKD)[A-Z0-9-]*\b|\b(?:TSA|TRA|TMA|RMZ|TMZ)[A-Z0-9-]*\b/i) || [czechProperty(properties, ["identifier", "designator", "ident", "name", "title", "id"])])[0];
      const name = czechProperty(properties, ["name", "title", "zoneName", "identifier", "designator"]) || designator || "LKR320A " + (featureIndex + 1);
      const kind = czechZoneKind(text || name || designator);
      const lower = czechProperty(properties, ["lowerLimit", "lower", "lowerLimitValue", "lowerAltitude", "lowerAltitudeLimit"]);
      const upper = czechProperty(properties, ["upperLimit", "upper", "upperLimitValue", "upperAltitude", "upperAltitudeLimit"]);
      czechGeoJsonRings(feature && feature.geometry).forEach((ring, partIndex) => {
        const points = (Array.isArray(ring) ? ring : []).map((coordinate) => ({ lat: Number(coordinate[1]), lon: Number(coordinate[0]) }))
          .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
        if (points.length < 3) return;
        zones.push({
          id: "CZECH-LKR320A-" + (featureIndex + 1) + "-" + (partIndex + 1),
          name,
          designator: clean(designator).toUpperCase() || name,
          classType: czechProperty(properties, ["type", "class", "category", "zoneType"]),
          kind,
          lower,
          upper,
          shape: "polygon",
          points,
          circle: null,
          frequencies: [],
          source: "ANS CR LKR320A",
          sourceDescription: clean(label) || "Official Czech LKR320A geometry. Operational activation is read separately from ANS CR AUP/UUP.",
          country: "CZ"
        });
      });
    });
    return zones;
  }

  function aupDesignatorSet(aup) {
    return new Set((aup && Array.isArray(aup.rows) ? aup.rows : []).map((row) => searchKey(row.designator)).filter(Boolean));
  }

  function zoneMatchesAup(zone, aupSet) {
    if (!aupSet || !aupSet.size || !zone) {
      return false;
    }
    const keys = [zone.designator, zone.name].map(searchKey).filter(Boolean);
    return keys.some((key) => {
      if (aupSet.has(key)) return true;
      for (const designator of aupSet) {
        if (key.includes(designator) || designator.includes(key)) return true;
      }
      return false;
    });
  }

  function mercY(lat) {
    const clamped = Math.max(-85, Math.min(85, Number(lat) || 0));
    const rad = clamped * Math.PI / 180;
    return Math.log(Math.tan(Math.PI / 4 + rad / 2)) * 180 / Math.PI;
  }

  function inverseMercY(y) {
    return (Math.atan(Math.exp(y * Math.PI / 180)) * 2 - Math.PI / 2) * 180 / Math.PI;
  }

  function normalizeBounds(bounds) {
    const b = bounds || DEFAULT_BOUNDS;
    return {
      minLat: Number.isFinite(b.minLat) ? b.minLat : DEFAULT_BOUNDS.minLat,
      maxLat: Number.isFinite(b.maxLat) ? b.maxLat : DEFAULT_BOUNDS.maxLat,
      minLon: Number.isFinite(b.minLon) ? b.minLon : DEFAULT_BOUNDS.minLon,
      maxLon: Number.isFinite(b.maxLon) ? b.maxLon : DEFAULT_BOUNDS.maxLon
    };
  }

  function createViewport(bounds, width, height, padding) {
    const b = normalizeBounds(bounds);
    const pad = Number.isFinite(padding) ? padding : 24;
    const minY = mercY(b.minLat);
    const maxY = mercY(b.maxLat);
    const spanX = Math.max(0.01, b.maxLon - b.minLon);
    const spanY = Math.max(0.01, maxY - minY);
    const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
    const usedW = spanX * scale;
    const usedH = spanY * scale;
    const offX = (width - usedW) / 2;
    const offY = (height - usedH) / 2;

    function project(point) {
      return {
        x: offX + (point.lon - b.minLon) * scale,
        y: height - offY - (mercY(point.lat) - minY) * scale
      };
    }

    function unproject(x, y) {
      const lon = b.minLon + (x - offX) / scale;
      const my = minY + (height - offY - y) / scale;
      return { lat: inverseMercY(my), lon };
    }

    return { bounds: b, width, height, padding: pad, scale, project, unproject };
  }

  function boundsFromZones(zones, fallback) {
    const points = [];
    (Array.isArray(zones) ? zones : []).forEach((zone) => {
      if (zone.shape === "circle" && zone.circle && zone.circle.center) {
        const c = zone.circle.center;
        const rDeg = (Number(zone.circle.radiusNm) || 0) / NM_PER_DEG;
        points.push({ lat: c.lat - rDeg, lon: c.lon - rDeg });
        points.push({ lat: c.lat + rDeg, lon: c.lon + rDeg });
      } else {
        (zone.points || []).forEach((point) => points.push(point));
      }
    });
    if (!points.length) {
      return normalizeBounds(fallback || DEFAULT_BOUNDS);
    }
    const lats = points.map((point) => point.lat);
    const lons = points.map((point) => point.lon);
    return expandBounds({
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons)
    }, 0.35);
  }

  function expandBounds(bounds, amount) {
    const b = normalizeBounds(bounds);
    const latPad = Math.max(0.05, (b.maxLat - b.minLat) * (amount || 0.1));
    const lonPad = Math.max(0.05, (b.maxLon - b.minLon) * (amount || 0.1));
    return {
      minLat: b.minLat - latPad,
      maxLat: b.maxLat + latPad,
      minLon: b.minLon - lonPad,
      maxLon: b.maxLon + lonPad
    };
  }

  function destinationPoint(point, bearingDeg, distanceNm) {
    const delta = Number(distanceNm || 0) / EARTH_RADIUS_NM;
    const theta = Number(bearingDeg || 0) * Math.PI / 180;
    const phi1 = point.lat * Math.PI / 180;
    const lambda1 = point.lon * Math.PI / 180;
    const sinPhi2 = Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta);
    const phi2 = Math.asin(sinPhi2);
    const y = Math.sin(theta) * Math.sin(delta) * Math.cos(phi1);
    const x = Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2);
    const lambda2 = lambda1 + Math.atan2(y, x);
    return {
      lat: phi2 * 180 / Math.PI,
      lon: ((lambda2 * 180 / Math.PI + 540) % 360) - 180
    };
  }

  function circlePoints(circle, steps) {
    if (!circle || !circle.center) {
      return [];
    }
    const count = Math.max(16, Number(steps) || 72);
    const radius = Number(circle.radiusNm) || 0;
    return Array.from({ length: count }, (_, index) => destinationPoint(circle.center, index * 360 / count, radius));
  }

  function haversineNm(a, b) {
    if (!a || !b) {
      return Infinity;
    }
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function bearingDeg(a, b) {
    const phi1 = a.lat * Math.PI / 180;
    const phi2 = b.lat * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    const pts = polygon || [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].lon;
      const yi = pts[i].lat;
      const xj = pts[j].lon;
      const yj = pts[j].lat;
      const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
        (point.lon < (xj - xi) * (point.lat - yi) / ((yj - yi) || 1e-9) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function distancePointToSegmentNm(point, a, b) {
    const ab = haversineNm(a, b);
    if (!Number.isFinite(ab) || ab <= 0.001) {
      return haversineNm(point, a);
    }
    const d13 = haversineNm(a, point) / EARTH_RADIUS_NM;
    const theta13 = bearingDeg(a, point) * Math.PI / 180;
    const theta12 = bearingDeg(a, b) * Math.PI / 180;
    const crossTrack = Math.asin(Math.sin(d13) * Math.sin(theta13 - theta12)) * EARTH_RADIUS_NM;
    const alongTrack = Math.acos(Math.min(1, Math.max(-1, Math.cos(d13) / Math.cos(crossTrack / EARTH_RADIUS_NM)))) * EARTH_RADIUS_NM;
    if (!Number.isFinite(alongTrack) || alongTrack < 0) return haversineNm(point, a);
    if (alongTrack > ab) return haversineNm(point, b);
    return Math.abs(crossTrack);
  }

  function cross2d(a, b, c) {
    return (b.lon - a.lon) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lon - a.lon);
  }

  function pointOnSegment2d(point, a, b) {
    const epsilon = 1e-10;
    return Math.abs(cross2d(a, b, point)) <= epsilon &&
      point.lon >= Math.min(a.lon, b.lon) - epsilon &&
      point.lon <= Math.max(a.lon, b.lon) + epsilon &&
      point.lat >= Math.min(a.lat, b.lat) - epsilon &&
      point.lat <= Math.max(a.lat, b.lat) + epsilon;
  }

  function segmentsIntersect2d(a, b, c, d) {
    const epsilon = 1e-10;
    const abC = cross2d(a, b, c);
    const abD = cross2d(a, b, d);
    const cdA = cross2d(c, d, a);
    const cdB = cross2d(c, d, b);

    if (Math.abs(abC) <= epsilon && pointOnSegment2d(c, a, b)) return true;
    if (Math.abs(abD) <= epsilon && pointOnSegment2d(d, a, b)) return true;
    if (Math.abs(cdA) <= epsilon && pointOnSegment2d(a, c, d)) return true;
    if (Math.abs(cdB) <= epsilon && pointOnSegment2d(b, c, d)) return true;

    return (abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0);
  }

  function routeIntersectsZone(routePoints, zone) {
    const route = Array.isArray(routePoints) ? routePoints : [];
    if (!route.length || !zone) {
      return false;
    }
    const polygon = zone.shape === "circle" ? circlePoints(zone.circle, 72) : (zone.points || []);
    const radius = zone.shape === "circle" && zone.circle ? Number(zone.circle.radiusNm) || 0 : 0;
    if (zone.shape === "circle" && zone.circle && zone.circle.center) {
      if (route.some((point) => haversineNm(point, zone.circle.center) <= radius)) {
        return true;
      }
      for (let i = 1; i < route.length; i += 1) {
        if (distancePointToSegmentNm(zone.circle.center, route[i - 1], route[i]) <= radius) {
          return true;
        }
      }
      return false;
    }
    if (polygon.length >= 3 && route.some((point) => pointInPolygon(point, polygon))) {
      return true;
    }
    for (let i = 1; i < route.length; i += 1) {
      const midpoint = {
        lat: (route[i - 1].lat + route[i].lat) / 2,
        lon: (route[i - 1].lon + route[i].lon) / 2
      };
      if (polygon.length >= 3 && pointInPolygon(midpoint, polygon)) {
        return true;
      }
      for (let edge = 0; edge < polygon.length; edge += 1) {
        const current = polygon[edge];
        const next = polygon[(edge + 1) % polygon.length];
        if (current && next && segmentsIntersect2d(route[i - 1], route[i], current, next)) {
          return true;
        }
      }
    }
    return false;
  }

  function zoneContainsPoint(zone, point) {
    if (!zone || !point || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lon))) {
      return false;
    }
    if (zone.shape === "circle" && zone.circle && zone.circle.center) {
      const radius = Number(zone.circle.radiusNm) || 0;
      return radius > 0 && haversineNm(point, zone.circle.center) <= radius;
    }
    const polygon = zone.points || [];
    return polygon.length >= 3 && pointInPolygon(point, polygon);
  }

  function drawBaseMap(ctx, viewport, options) {
    const opts = options || {};
    ctx.save();
    ctx.fillStyle = opts.background || "#faf9f4";
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    ctx.lineWidth = 1;
    ctx.strokeStyle = "#dfded6";
    ctx.fillStyle = "#9a988f";
    ctx.font = "11px system-ui, sans-serif";
    for (let lat = Math.ceil(viewport.bounds.minLat); lat <= viewport.bounds.maxLat; lat += 1) {
      const p1 = viewport.project({ lat, lon: viewport.bounds.minLon });
      const p2 = viewport.project({ lat, lon: viewport.bounds.maxLon });
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.fillText(lat + "N", 8, p1.y - 4);
    }
    for (let lon = Math.ceil(viewport.bounds.minLon); lon <= viewport.bounds.maxLon; lon += 1) {
      const p1 = viewport.project({ lat: viewport.bounds.minLat, lon });
      const p2 = viewport.project({ lat: viewport.bounds.maxLat, lon });
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.fillText(lon + "E", p2.x + 4, 16);
    }

    ctx.beginPath();
    POLAND_OUTLINE.forEach((point, index) => {
      const p = viewport.project(point);
      if (index) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.strokeStyle = "#b8b7af";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  function drawZonePath(ctx, viewport, zone) {
    const points = zone.shape === "circle" ? circlePoints(zone.circle, 96) : (zone.points || []);
    if (!points.length) {
      return false;
    }
    ctx.beginPath();
    points.forEach((point, index) => {
      const p = viewport.project(point);
      if (index) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
    });
    ctx.closePath();
    return true;
  }

  function drawAirspaces(ctx, viewport, zones, options) {
    const opts = options || {};
    const activeSet = opts.activeSet || null;
    (Array.isArray(zones) ? zones : []).forEach((zone) => {
      const style = TYPE_STYLE[zone.kind] || TYPE_STYLE.OTHER;
      const isActive = zoneMatchesAup(zone, activeSet);
      ctx.save();
      if (drawZonePath(ctx, viewport, zone)) {
        ctx.fillStyle = isActive ? "rgba(221, 54, 84, 0.22)" : style.fill;
        ctx.strokeStyle = isActive ? "#d92947" : style.stroke;
        ctx.lineWidth = isActive ? 2.2 : 1.2;
        if (opts.fill !== false) ctx.fill();
        ctx.stroke();
        if (opts.labels !== false) {
          const labelPoint = getZoneLabelPoint(zone);
          if (labelPoint) {
            const p = viewport.project(labelPoint);
            ctx.font = isActive ? "700 11px system-ui, sans-serif" : "600 10px system-ui, sans-serif";
            ctx.fillStyle = isActive ? "#b41532" : style.stroke;
            ctx.fillText(zone.designator || zone.name || zone.kind, p.x + 3, p.y - 3);
          }
        }
      }
      ctx.restore();
    });
  }

  function getZoneLabelPoint(zone) {
    if (zone.shape === "circle" && zone.circle) {
      return zone.circle.center;
    }
    const points = zone.points || [];
    if (!points.length) {
      return null;
    }
    return points.reduce((sum, point) => ({ lat: sum.lat + point.lat / points.length, lon: sum.lon + point.lon / points.length }), { lat: 0, lon: 0 });
  }

  function getAirports() {
    const data = window.TECNAM_DATA || {};
    const base = Array.isArray(data.airports) ? data.airports : [];
    const apiCup = window.NORDSWEET_CUP_API_DATA || {};
    const extras = Array.isArray(apiCup.airports) ? apiCup.airports : [];
    if (!extras.length) {
      return base;
    }
    const seen = new Set();
    return base.concat(extras).filter((airport) => {
      const key = searchKey(airport.icao || airport.code || airport.name);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function getPrivateWaypoints() {
    const store = window.NORDSWEET_PRIVATE_WAYPOINTS || {};
    const base = Object.keys(store).flatMap((key) => {
      const pack = store[key] || {};
      return Object.values(pack.waypoints || {});
    });
    const apiCup = window.NORDSWEET_CUP_API_DATA || {};
    const extras = Array.isArray(apiCup.points) ? apiCup.points : [];
    return base.concat(extras);
  }

  function waypointIdentityKeys(point) {
    return [point && point.key, point && point.id, point && point.name]
      .map(searchKey)
      .filter(Boolean);
  }

  function isIfrWaypoint(point) {
    return clean(point && (point.rules || point.ruleSet)).toUpperCase() === "IFR";
  }

  function getIfrWaypoints() {
    const data = window.NORDSWEET_NAVDATA || {};
    const base = Object.values(data.waypoints || {});
    const seen = new Set();
    base.forEach((point) => waypointIdentityKeys(point).forEach((key) => seen.add(key)));
    const privateIfr = getPrivateWaypoints().filter((point) => {
      if (!point || point.navaid || !isIfrWaypoint(point)) {
        return false;
      }
      const keys = waypointIdentityKeys(point);
      if (!keys.length || keys.some((key) => seen.has(key))) {
        return false;
      }
      keys.forEach((key) => seen.add(key));
      return true;
    });
    return base.concat(privateIfr);
  }

  function buildPointIndex() {
    const index = new Map();
    function add(point, aliases, kind) {
      const lat = Number(point && point.lat);
      const lon = Number(point && point.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return;
      }
      const entry = Object.assign({}, point, { lat, lon, mapKind: kind || point.mapKind || "point" });
      (aliases || []).forEach((alias) => {
        const key = searchKey(alias);
        if (!key) return;
        if (!index.has(key) || index.get(key).mapKind !== "airport") {
          index.set(key, entry);
        }
      });
    }
    getAirports().forEach((airport) => {
      add(airport, [airport.icao, airport.cupCode, airport.name], "airport");
    });
    getIfrWaypoints().forEach((point) => {
      add(point, [point.key, point.id, point.name], "ifr");
    });
    getPrivateWaypoints().forEach((point) => {
      const kind = point.navaid ? "navaid" : isIfrWaypoint(point) ? "ifr" : "vfr";
      add(point, [point.key, point.id, point.name, point.cup && point.cup.shortCode, point.navaid && point.navaid.code], kind);
    });
    return index;
  }

  function routeTokens(text) {
    const rawTokens = clean(text)
      .replace(/->/g, " ")
      .replace(/[,:;]/g, " ")
      .split(/\s+/)
      .map((token) => clean(token).toUpperCase())
      .filter(Boolean);
    const tokens = [];
    for (let index = 0; index < rawTokens.length; index += 1) {
      const token = rawTokens[index];
      const nextToken = rawTokens[index + 1] || "";
      const coordinateToken = createRouteCoordinateToken(token, nextToken);
      if (coordinateToken) {
        tokens.push(coordinateToken);
        index += 1;
        continue;
      }
      if (["DCT", "VFR", "IFR", "NIL"].includes(token) || /^[NK]\d{3,4}[AF]\d{2,3}$/.test(token)) {
        continue;
      }
      tokens.push(token);
    }
    return tokens;
  }

  function resolveRoute(text, pointIndex) {
    const index = pointIndex || buildPointIndex();
    const unresolved = [];
    const points = routeTokens(text).map((token) => {
      const coordinatePoint = createRoutePointFromCoordinateToken(token);
      if (coordinatePoint) {
        return Object.assign({}, coordinatePoint, {
          routeToken: token
        });
      }
      const key = searchKey(token);
      const point = index.get(key);
      if (!point) {
        unresolved.push(token);
        return null;
      }
      return Object.assign({}, point, {
        routeToken: token,
        label: point.icao || point.key || point.id || point.name || token
      });
    }).filter(Boolean);
    return { points, unresolved };
  }

  function parseGpx(text) {
    const doc = new DOMParser().parseFromString(String(text || ""), "application/xml");
    const nodes = Array.from(doc.querySelectorAll("trkpt, rtept, wpt"));
    return nodes.map((node, index) => {
      const lat = Number(node.getAttribute("lat"));
      const lon = Number(node.getAttribute("lon"));
      const nameNode = node.querySelector("name");
      return Number.isFinite(lat) && Number.isFinite(lon)
        ? { lat, lon, label: clean(nameNode && nameNode.textContent) || "GPX " + (index + 1), mapKind: "gpx" }
        : null;
    }).filter(Boolean);
  }

  function frequencyRowsFromPayload(data) {
    data = data || {};
    if (Array.isArray(data.frequencies)) {
      return data.frequencies;
    }
    return Array.isArray(data.entries) ? data.entries : [];
  }

  function getFrequencyEditorDraft() {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      if (!window.localStorage) {
        return null;
      }
      const raw = window.localStorage.getItem(FREQUENCY_DRAFT_KEY);
      if (raw === frequencyDraftCache.raw) {
        return frequencyDraftCache.payload;
      }
      frequencyDraftCache.raw = raw;
      frequencyDraftCache.payload = null;
      if (!raw) {
        return null;
      }
      const payload = JSON.parse(raw);
      if (payload && frequencyRowsFromPayload(payload).length) {
        frequencyDraftCache.payload = payload;
      }
      return frequencyDraftCache.payload;
    } catch (error) {
      frequencyDraftCache.raw = undefined;
      frequencyDraftCache.payload = null;
      return null;
    }
  }

  function getFrequencyPayload() {
    return getFrequencyEditorDraft() || window.NORDSWEET_FREQUENCIES || {};
  }

  function getFrequencyRows() {
    return frequencyRowsFromPayload(getFrequencyPayload());
  }

  function getFrequencySourceInfo() {
    const draft = getFrequencyEditorDraft();
    const payload = draft || window.NORDSWEET_FREQUENCIES || {};
    const rows = frequencyRowsFromPayload(payload);
    return {
      source: draft ? "airport-frequencies-editor draft" : clean(payload.source || "airport-frequencies-data.js"),
      count: rows.length,
      isDraft: Boolean(draft)
    };
  }

  function reloadFrequencyEditorDraft() {
    frequencyDraftCache.raw = undefined;
    frequencyDraftCache.payload = null;
    return getFrequencySourceInfo();
  }

  function formatFrequencyShort(row) {
    if (!row) return "";
    return [
      clean(row.callsign || row.serviceLabel || row.serviceShortLabel),
      clean(row.frequencyMhz)
    ].filter(Boolean).join(" ");
  }

  function airportFrequencyRows(icao) {
    const key = searchKey(icao);
    return getFrequencyRows().filter((row) => searchKey(row.airportIcao) === key);
  }

  function serviceRank(row, order) {
    const service = searchKey(row && row.serviceId);
    const idx = order.map(searchKey).indexOf(service);
    return idx >= 0 ? idx : 999;
  }

  function uniqueFrequencies(rows) {
    const seen = new Set();
    return rows.filter((row) => {
      const key = [row.serviceId, row.frequencyMhz, row.callsign, row.sector].map(searchKey).join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function routeDistanceToPoint(route, point) {
    if (!route || route.length < 2) {
      return route && route[0] ? haversineNm(route[0], point) : Infinity;
    }
    let best = Infinity;
    for (let i = 1; i < route.length; i += 1) {
      best = Math.min(best, distancePointToSegmentNm(point, route[i - 1], route[i]));
    }
    return best;
  }

  function buildRadioSequence(routePoints) {
    const route = Array.isArray(routePoints) ? routePoints : [];
    const airports = getAirports();
    const byIcao = new Map(airports.map((airport) => [searchKey(airport.icao), airport]));
    const sequence = [];
    const first = route[0];
    const last = route[route.length - 1];
    const depIcao = searchKey(first && (first.icao || first.airportIcao || first.id || first.label));
    const arrIcao = searchKey(last && (last.icao || last.airportIcao || last.id || last.label));

    function addPhase(phase, rows, missing) {
      sequence.push({
        phase,
        rows: uniqueFrequencies(rows || []),
        missing: missing || ""
      });
    }

    if (depIcao && byIcao.has(depIcao)) {
      const depRows = airportFrequencyRows(depIcao)
        .filter((row) => ["DELIVERY", "GROUND", "TOWER", "RADIO"].includes(searchKey(row.serviceId)))
        .sort((a, b) => serviceRank(a, ["delivery", "ground", "tower", "radio"]) - serviceRank(b, ["delivery", "ground", "tower", "radio"]));
      addPhase("Start: " + depIcao, depRows, depRows.length ? "" : "Brak lokalnej czestotliwosci startowej w danych.");
    }

    const enrouteCandidates = getFrequencyRows()
      .filter((row) => ["FISS", "INFORMACJA"].includes(searchKey(row.serviceId)))
      .map((row) => {
        const airport = byIcao.get(searchKey(row.airportIcao));
        return Object.assign({}, row, {
          routeDistanceNm: airport ? routeDistanceToPoint(route, airport) : Infinity
        });
      })
      .filter((row) => row.routeDistanceNm <= 160)
      .sort((a, b) => a.routeDistanceNm - b.routeDistanceNm);
    const trueFisRows = enrouteCandidates.filter((row) => searchKey(row.serviceId) === "FISS");
    const closeTrueFisRows = trueFisRows.filter((row) => row.routeDistanceNm <= 100);
    const fisRows = closeTrueFisRows.length
      ? closeTrueFisRows
      : trueFisRows.length
        ? trueFisRows.slice(0, 2)
      : enrouteCandidates.filter((row) => row.routeDistanceNm <= 80);
    addPhase("Przelot / FIS", fisRows.slice(0, 4), fisRows.length ? "" : "Nie znaleziono FIS blisko trasy.");

    if (arrIcao && byIcao.has(arrIcao)) {
      const arrivalOrder = ["atis", "zblizanie", "tower", "ground", "radio"];
      const arrRows = airportFrequencyRows(arrIcao)
        .filter((row) => arrivalOrder.map(searchKey).includes(searchKey(row.serviceId)))
        .sort((a, b) => serviceRank(a, arrivalOrder) - serviceRank(b, arrivalOrder));
      const hasGround = arrRows.some((row) => searchKey(row.serviceId) === "GROUND");
      addPhase("Dolot i ladowanie: " + arrIcao, arrRows, hasGround ? "" : "Ground nie wystepuje w lokalnych danych dla tego lotniska.");
    }

    return sequence;
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([String(text || "")], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  window.AirspaceTools = {
    AIRSPACE_TYPES,
    DEFAULT_BOUNDS,
    TYPE_STYLE,
    POLAND_OUTLINE,
    clean,
    slug,
    searchKey,
    toNumber,
    parseCoordPair,
    parseRouteCoordinatePair,
    createRouteCoordinateToken,
    parseRouteCoordinateToken,
    createRoutePointFromCoordinateToken,
    apiConfig,
    fetchConfiguredSource,
    parseCsvLine,
    parseCup,
    formatOpenAirCoord,
    inferAirspaceKind,
    parseOpenAir,
    exportOpenAir,
    getDesignator,
    parsePansaAup,
    parseCzechAupPackage,
    parseCzechLkr320a,
    aupDesignatorSet,
    zoneMatchesAup,
    createViewport,
    boundsFromZones,
    expandBounds,
    destinationPoint,
    circlePoints,
    haversineNm,
    distancePointToSegmentNm,
    routeIntersectsZone,
    zoneContainsPoint,
    drawBaseMap,
    drawAirspaces,
    drawZonePath,
    getZoneLabelPoint,
    getAirports,
    getPrivateWaypoints,
    getIfrWaypoints,
    buildPointIndex,
    routeTokens,
    resolveRoute,
    parseGpx,
    getFrequencyRows,
    getFrequencySourceInfo,
    reloadFrequencyEditorDraft,
    airportFrequencyRows,
    formatFrequencyShort,
    routeDistanceToPoint,
    buildRadioSequence,
    downloadText
  };
}());
