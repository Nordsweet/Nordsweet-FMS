(function () {
  const root = window.NORDSWEET_AIRCRAFT_DATA || {};
  const profiles = root.profiles && typeof root.profiles === "object" ? root.profiles : {};
  const loadedFiles = root.loadedFiles && typeof root.loadedFiles === "object" ? root.loadedFiles : {};

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeType(value) {
    const normalized = clean(value).toUpperCase();
    return normalized === "C172K" ? "R172K" : normalized;
  }

  function normalizeRegistration(value) {
    return clean(value).toUpperCase().replace(/[^A-Z0-9]+/g, "");
  }

  function normalizePowerplant(value) {
    const normalized = clean(value).toLowerCase().replace(/[^a-z]+/g, "");
    if (normalized === "turbine") {
      return "turbine";
    }
    if (normalized === "jet") {
      return "jet";
    }
    return "reciprocating";
  }

  function normalizeEngineCount(value, fallback = null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= 4 ? Math.round(parsed) : fallback;
  }

  function mergePerformanceData(basePerformance, overridePerformance) {
    if (!overridePerformance) {
      return basePerformance || null;
    }
    if (!basePerformance || typeof basePerformance !== "object" || typeof overridePerformance !== "object") {
      return overridePerformance;
    }
    return {
      ...basePerformance,
      ...overridePerformance,
      basic: {
        ...(basePerformance.basic || {}),
        ...(overridePerformance.basic || {})
      }
    };
  }

  function mergeWeightBalanceData(baseWeightBalance, overrideWeightBalance) {
    if (!overrideWeightBalance) {
      return baseWeightBalance || null;
    }
    if (!baseWeightBalance || typeof baseWeightBalance !== "object" || typeof overrideWeightBalance !== "object") {
      return overrideWeightBalance;
    }
    return {
      ...baseWeightBalance,
      ...overrideWeightBalance,
      armsM: {
        ...(baseWeightBalance.armsM || {}),
        ...(overrideWeightBalance.armsM || {})
      },
      defaults: {
        ...(baseWeightBalance.defaults || {}),
        ...(overrideWeightBalance.defaults || {})
      },
      envelope: overrideWeightBalance.envelope || baseWeightBalance.envelope || null,
      sourceUnits: {
        ...(baseWeightBalance.sourceUnits || {}),
        ...(overrideWeightBalance.sourceUnits || {})
      }
    };
  }

  function getProfileKey(type, registration) {
    const normalizedType = normalizeType(type);
    const normalizedRegistration = normalizeRegistration(registration);
    return normalizedRegistration ? normalizedType + "|" + normalizedRegistration : normalizedType;
  }

  function register(profile) {
    if (!profile || !profile.type) {
      return null;
    }

    const normalizedType = normalizeType(profile.type);
    const normalizedRegistration = normalizeRegistration(profile.registration);
    const key = getProfileKey(normalizedType, normalizedRegistration);
    const baseProfile = normalizedRegistration ? profiles[getProfileKey(normalizedType, "")] || {} : {};
    const existing = profiles[key] || {};
    const incomingChecklists = Array.isArray(profile.checklists) ? profile.checklists : [];
    const baseChecklists = Array.isArray(baseProfile.checklists) ? baseProfile.checklists : [];
    const existingChecklists = Array.isArray(existing.checklists) && existing.checklists.length ? existing.checklists : baseChecklists;
    const incomingPerformance = profile.performance || null;
    const inheritedPerformance = existing.performance || baseProfile.performance || null;
    const mergedPerformance = mergePerformanceData(inheritedPerformance, incomingPerformance);
    const incomingWeightBalance = profile.weightBalance || null;
    const inheritedWeightBalance = existing.weightBalance || baseProfile.weightBalance || null;
    const mergedWeightBalance = mergeWeightBalanceData(inheritedWeightBalance, incomingWeightBalance);
    const incomingPerformanceStatus = clean(profile.performanceStatus);
    const existingPerformanceStatus = clean(existing.performanceStatus || baseProfile.performanceStatus);
    const performanceStatus = incomingPerformance
      ? (incomingPerformanceStatus && incomingPerformanceStatus !== "pending" ? incomingPerformanceStatus : existingPerformanceStatus && existingPerformanceStatus !== "pending" ? existingPerformanceStatus : "available")
      : mergedPerformance
        ? (existingPerformanceStatus && existingPerformanceStatus !== "pending" ? existingPerformanceStatus : "available")
        : (incomingPerformanceStatus || existingPerformanceStatus || "pending");
    profiles[key] = {
      checklists: incomingChecklists.length ? incomingChecklists : existingChecklists,
      dataFileBaseName: clean(profile.dataFileBaseName || existing.dataFileBaseName),
      displayName: clean(profile.displayName || existing.displayName || normalizedType),
      displayType: clean(profile.type || existing.displayType || normalizedType),
      engineCount: normalizeEngineCount(profile.engineCount, normalizeEngineCount(existing.engineCount, normalizeEngineCount(baseProfile.engineCount, null))),
      fuelCapacityLiters: Number.isFinite(Number(profile.fuelCapacityLiters)) ? Number(profile.fuelCapacityLiters) : existing.fuelCapacityLiters || null,
      fuelTankCapacityLiters: Number.isFinite(Number(profile.fuelTankCapacityLiters)) ? Number(profile.fuelTankCapacityLiters) : existing.fuelTankCapacityLiters || null,
      icaoType: clean(profile.icaoType || normalizedType).toUpperCase(),
      isRegistrationSpecific: Boolean(normalizedRegistration),
      limitations: profile.limitations || existing.limitations || null,
      metadata: profile.metadata || existing.metadata || null,
      order: Number.isFinite(Number(profile.order)) ? Number(profile.order) : Number.isFinite(Number(existing.order)) ? Number(existing.order) : 999,
      performance: mergedPerformance,
      performanceStatus,
      powerplant: normalizePowerplant(profile.powerplant || existing.powerplant),
      registration: normalizedRegistration,
      source: clean(profile.source || existing.source),
      type: normalizedType,
      usableFuelCapacityLiters: Number.isFinite(Number(profile.usableFuelCapacityLiters)) ? Number(profile.usableFuelCapacityLiters) : existing.usableFuelCapacityLiters || null,
      weightBalance: mergedWeightBalance
    };
    return profiles[key];
  }

  function getProfile(type, registration) {
    const normalizedRegistration = normalizeRegistration(registration);
    const exact = profiles[getProfileKey(type, registration)];
    const base = profiles[getProfileKey(type, "")] || null;
    if (exact && base && normalizedRegistration) {
      const exactChecklists = Array.isArray(exact.checklists) ? exact.checklists : [];
      const baseChecklists = Array.isArray(base.checklists) ? base.checklists : [];
      const performance = mergePerformanceData(base.performance || null, exact.performance || null);
      const weightBalance = mergeWeightBalanceData(base.weightBalance || null, exact.weightBalance || null);
      const exactPerformanceStatus = clean(exact.performanceStatus);
      const basePerformanceStatus = clean(base.performanceStatus);
      return {
        ...base,
        ...exact,
        checklists: exactChecklists.length ? exactChecklists : baseChecklists,
        performance,
        performanceStatus: performance
          ? (exact.performance
            ? (exactPerformanceStatus && exactPerformanceStatus !== "pending" ? exactPerformanceStatus : basePerformanceStatus && basePerformanceStatus !== "pending" ? basePerformanceStatus : "available")
            : (exactPerformanceStatus && exactPerformanceStatus !== "pending" ? exactPerformanceStatus : basePerformanceStatus && basePerformanceStatus !== "pending" ? basePerformanceStatus : "available"))
          : (exactPerformanceStatus || basePerformanceStatus || "pending"),
        weightBalance
      };
    }
    if (exact) {
      return exact;
    }
    return base;
  }

  function getDefaultProfiles() {
    return Object.keys(profiles)
      .map((key) => profiles[key])
      .filter((profile) => profile && !profile.isRegistrationSpecific)
      .sort((left, right) => (left.order - right.order) || left.type.localeCompare(right.type));
  }

  window.NORDSWEET_AIRCRAFT_DATA = {
    getDefaultProfiles,
    getProfile,
    getProfileKey,
    loadedFiles,
    normalizeEngineCount,
    normalizePowerplant,
    normalizeRegistration,
    normalizeType,
    profiles,
    register
  };
})();
