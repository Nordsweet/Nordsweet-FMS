window.NORDSWEET_AIRCRAFT_DATA.register({
  checklists: [],
  dataFileBaseName: "C172M data",
  displayName: "Cessna 172M",
  icaoType: "C172",
  order: 4.6,
  performance: null,
  performanceStatus: "pending",
  powerplant: "reciprocating",
  source: "C172M W&B data loaded. Performance tables not loaded yet",
  type: "C172M",
  weightBalance: {
    armsM: {
      baggage: 2.413,
      coPilot: 0.9398,
      firstPassenger: 1.8542,
      fuel: 1.214298,
      pilot: 0.9398,
      secondPassenger: 1.8542
    },
    defaults: {
      coPilotWeightKg: "0",
      emptyArmM: "0.985012",
      emptyWeightKg: "670.591757",
      firstPassengerWeightKg: "0",
      fuelRequiredLiters: "27",
      pilotWeightKg: "77",
      secondPassengerWeightKg: "0",
      usableFuelLiters: "100"
    },
    envelope: {
      maxMomentKgm: 2888.38,
      maxWeightKg: 1043.264,
      minMomentKgm: 898.658,
      minWeightKg: 680.389,
      points: [
        { momentKgm: 898.658, weightKg: 680.389 },
        { momentKgm: 1527.719, weightKg: 884.506 },
        { momentKgm: 2331.903, weightKg: 1043.264 },
        { momentKgm: 2888.38, weightKg: 1043.264 },
        { momentKgm: 1227.014, weightKg: 680.389 }
      ]
    },
    fuelArmM: 1.214298,
    fuelDensityKgPerL: 0.721,
    mtowKg: 1043.264,
    source: "SP-ATW W&B XLSX converted from kg, liters, inches, pounds and lb-in/1000 to kg, meters and kgm.",
    sourceUnits: {
      baggageArmIn: 95,
      defaultCoPilotWeightKg: 0,
      defaultFirstPassengerWeightKg: 0,
      defaultFuelLandingLiters: 73,
      defaultFuelRequiredLiters: 27,
      defaultFuelTakeoffLiters: 100,
      defaultPilotWeightKg: 77,
      defaultSecondPassengerWeightKg: 0,
      emptyAircraftArmIn: 38.78,
      emptyAircraftWeightKg: 670.591757,
      fuelArmIn: 47.807018,
      fuelDensityKgPerL: 0.721,
      frontSeatArmIn: 37,
      mtowLb: 2300,
      oilArmIn: 0,
      oilWeightKg: 8.5,
      rearSeatArmIn: 73,
      weightBalanceEnvelope: "CG inches / weight lb points: 52/1500, 68/1950, 88/2300, 109/2300, 71/1500"
    }
  }
});
