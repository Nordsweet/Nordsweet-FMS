window.NORDSWEET_AIRCRAFT_DATA.register({
  checklists: [],
  dataFileBaseName: "R172K data",
  displayName: "Cessna R172K",
  icaoType: "C172",
  limitations: window.R172K_PERFORMANCE && window.R172K_PERFORMANCE.limitations
    ? window.R172K_PERFORMANCE.limitations
    : {
      wind: {
        crosswindOperation: "take-off and landing",
        maxDemonstratedCrosswindKt: 15,
        maxTailwindKt: 10,
        maxTailwindTakeoffLandingKt: 10,
        notes: [
          "Maximum demonstrated crosswind velocity.",
          "Take-off and landing performance tables provide tailwind corrections up to 10 kt."
        ],
        source: "R172K POH demonstrated crosswind velocity and take-off/landing tailwind correction notes.",
        tailwindOperation: "take-off and landing",
        title: "Wind limitations",
        unit: "kts"
      }
    },
  metadata: {
    glide: window.R172K_PERFORMANCE && window.R172K_PERFORMANCE.glide
      ? window.R172K_PERFORMANCE.glide
      : {
        bestGlideSpeedByWeight: [
          { speedKias: 75, weightLb: 2550 },
          { speedKias: 69, weightLb: 2150 },
          { speedKias: 62, weightLb: 1750 }
        ],
        distanceProfile: {
          groundDistanceNm: [0, 3.33, 6.67, 10, 13.33, 16.67, 20],
          heightAboveTerrainFt: [0, 2000, 4000, 6000, 8000, 10000, 12000],
          ratio: 10.1,
          ratioText: "1:10.1"
        },
        source: "R172K POH glide chart.",
        title: "Glide distance"
      }
  },
  order: 8,
  performance: window.R172K_PERFORMANCE || null,
  performanceStatus: window.R172K_PERFORMANCE ? "partial" : "pending",
  powerplant: "reciprocating",
  source: window.R172K_PERFORMANCE ? "R172K take-off, climb, cruise, landing and W&B data loaded" : "R172K W&B data loaded. Performance tables not loaded yet",
  type: "R172K",
  weightBalance: {
    armsM: {
      baggage: 2.413,
      coPilot: 0.9398,
      firstPassenger: 1.8542,
      fuel: 1.218163,
      pilot: 0.9398,
      secondPassenger: 1.8542
    },
    defaults: {
      coPilotWeightKg: "100",
      emptyArmM: "0.941",
      emptyWeightKg: "757",
      firstPassengerWeightKg: "70",
      fuelRequiredLiters: "27",
      pilotWeightKg: "70",
      secondPassengerWeightKg: "70",
      usableFuelLiters: "72"
    },
    envelope: {
      maxMomentKgm: 1388.31,
      maxWeightKg: 1156.661,
      minMomentKgm: 645.19,
      minWeightKg: 725.748,
      points: [
        { momentKgm: 645.19, weightKg: 725.748 },
        { momentKgm: 783.445, weightKg: 884.505 },
        { momentKgm: 1203.97, weightKg: 1156.661 },
        { momentKgm: 1388.31, weightKg: 1156.661 },
        { momentKgm: 864.093, weightKg: 725.748 }
      ]
    },
    fuelArmM: 1.218163,
    fuelDensityKgPerL: 0.721,
    mtowKg: 1156.661,
    source: "R172K W&B XLSX converted from kg, liters, inches, pounds and lb-in/1000 to kg, meters and kgm.",
    sourceUnits: {
      baggageArmIn: 95,
      emptyAircraftArmIn: 37.047244,
      emptyAircraftWeightKg: 757,
      defaultCoPilotWeightKg: 100,
      defaultFirstPassengerWeightKg: 70,
      defaultFuelLandingLiters: 45,
      defaultFuelRequiredLiters: 27,
      defaultFuelTakeoffLiters: 72,
      defaultPilotWeightKg: 70,
      defaultSecondPassengerWeightKg: 70,
      fuelArmIn: 47.959184,
      fuelDensityKgPerL: 0.721,
      frontSeatArmIn: 37,
      mtowLb: 2550,
      oilArmIn: 0,
      oilWeightKg: 8.5,
      rearSeatArmIn: 73,
      moment1000LbInToKgm: 11.521246,
      weightBalanceEnvelope: "Moment/1000 lb-in / weight lb points: 56/1600, 68/1950, 104.5/2550, 120.5/2550, 75/1600"
    }
  }
});
