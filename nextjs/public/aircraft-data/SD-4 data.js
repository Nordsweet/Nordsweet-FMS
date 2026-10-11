window.NORDSWEET_AIRCRAFT_DATA.register({
  checklists: [],
  dataFileBaseName: "SD-4 data",
  displayName: "Tomark Viper SD-4",
  icaoType: "SD4",
  limitations: window.SD4_PERFORMANCE && window.SD4_PERFORMANCE.limitations
    ? window.SD4_PERFORMANCE.limitations
    : {
      baggageMaxKg: 15,
      serviceCeiling: {
        approved: true,
        feet: 15500,
        meters: 4725,
        title: "Service Ceiling (Approved)"
      },
      serviceCeilingFt: 15500,
      serviceCeilingM: 4725,
      wind: {
        crosswindOperation: "take-off and landing",
        headwindOperation: "airplane operation",
        maxDemonstratedHeadwindKt: 25,
        maxDemonstratedCrosswindKt: 15,
        maxDemonstratedTailwindKt: 5,
        source: "SD-4 maximum demonstrated speed of wind data provided by user.",
        tailwindOperation: "take-off and landing",
        title: "Maximum demonstrated speed of wind",
        unit: "kts"
      }
    },
  metadata: {
    glide: window.SD4_PERFORMANCE && window.SD4_PERFORMANCE.glide
      ? window.SD4_PERFORMANCE.glide
      : {
        airspeedKias: 64,
        bestGlideKias: 64,
        ratio: 8,
        ratioText: "1:8",
        source: "SD-4 glide ratio data provided by user.",
        title: "Glide ratio"
      }
  },
  order: 9,
  performance: window.SD4_PERFORMANCE || null,
  performanceStatus: window.SD4_PERFORMANCE ? "partial" : "pending",
  powerplant: "reciprocating",
  source: window.SD4_PERFORMANCE ? "SD-4 take-off, climb, cruise, landing and W&B data loaded" : "SD-4 W&B data loaded. Performance tables not loaded yet",
  type: "SD-4",
  weightBalance: {
    armsM: {
      baggage: 1.248,
      coPilot: 0.57,
      firstPassenger: 0.57,
      fuel: 0.201,
      pilot: 0.57,
      secondPassenger: 0.57
    },
    defaults: {
      emptyArmM: "0.311",
      emptyWeightKg: "378.2"
    },
    envelope: {
      maxMomentKgm: 247.68,
      maxWeightKg: 600,
      minMomentKgm: 117.091,
      minWeightKg: 378.2,
      points: [
        { momentKgm: 117.091, weightKg: 378.2 },
        { momentKgm: 156.121, weightKg: 378.2 },
        { momentKgm: 247.68, weightKg: 600 },
        { momentKgm: 185.76, weightKg: 600 }
      ]
    },
    fuelArmM: 0.201,
    fuelDensityKgPerL: 0.72,
    mtowKg: 600,
    source: "SD-4 W&B data converted from kg/mm to kg, meters and kgm.",
    sourceUnits: {
      baggageArmMm: 1248,
      baggageMaxKg: 15,
      cgRangeAftDatumMm: [309.6, 412.8],
      cgRangeMacPct: [24, 32],
      emptyArmMm: 311,
      emptyWeightKg: 378.2,
      fuelArmMm: 201,
      fuelDensityKgPerL: 0.72,
      mtowKg: 600,
      occupantArmMm: 570
    }
  }
});
