window.NORDSWEET_AIRCRAFT_DATA.register({
  checklists: [],
  dataFileBaseName: "C152 data",
  displayName: "Cessna 152",
  fuelTankCapacityLiters: 92.5,
  icaoType: "C152",
  order: 5,
  performance: null,
  performanceStatus: "pending",
  powerplant: "reciprocating",
  source: "C152 W&B data loaded. Performance tables not loaded yet",
  type: "C152",
  usableFuelCapacityLiters: 92.5,
  weightBalance: {
    armsM: {
      baggage: 1.6002,
      coPilot: 0.9906,
      firstPassenger: 0,
      fuel: 1.2192,
      pilot: 0.9906,
      secondPassenger: 0
    },
    defaults: {
      coPilotWeightKg: "60",
      emptyArmM: "0.79133",
      emptyWeightKg: "544",
      firstPassengerWeightKg: "0",
      fuelRequiredLiters: "25",
      pilotWeightKg: "80",
      secondPassengerWeightKg: "0",
      usableFuelLiters: "70"
    },
    envelope: {
      maxMomentKgm: 1173.671,
      maxWeightKg: 757.5,
      minMomentKgm: 357.159,
      minWeightKg: 453.593,
      points: [
        { momentKgm: 357.159, weightKg: 453.593 },
        { momentKgm: 650.922, weightKg: 612.35 },
        { momentKgm: 1048.607, weightKg: 757.5 },
        { momentKgm: 1173.671, weightKg: 757.5 },
        { momentKgm: 420.526, weightKg: 453.593 }
      ]
    },
    fuelArmM: 1.2192,
    fuelDensityKgPerL: 0.721,
    mtowKg: 757.5,
    source: "SP-KER W&B XLSX converted from kg, liters, inches, pounds and lb-in/1000 to kg, meters and kgm.",
    sourceUnits: {
      baggageArmIn: 63,
      defaultBaggageWeightKg: 0,
      defaultCoPilotWeightKg: 60,
      defaultFirstPassengerWeightKg: 0,
      defaultFuelLandingLiters: 45,
      defaultFuelRequiredLiters: 25,
      defaultFuelTakeoffLiters: 70,
      defaultPilotWeightKg: 80,
      defaultSecondPassengerWeightKg: 0,
      emptyAircraftArmIn: 31.154724,
      emptyAircraftWeightKg: 544,
      fuelArmIn: 48,
      fuelDensityKgPerL: 0.721,
      fuelTankCapacityLiters: 92.5,
      frontSeatArmIn: 39,
      mtowLb: 1670,
      oilArmIn: -27.77,
      oilWeightKg: 8.5,
      rearSeatArmIn: 0,
      weightBalanceEnvelope: "CG inches / weight lb points: 31/1000, 41.85/1350, 54.5/1670, 61/1670, 36.5/1000"
    }
  }
});
