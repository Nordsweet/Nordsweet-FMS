window.NORDSWEET_AIRCRAFT_DATA.register({
  checklists: [],
  dataFileBaseName: "C172.SP-ANT-data",
  displayName: "Reims-Cessna FR172H Reims Rocket",
  fuelTankCapacityLiters: 197,
  icaoType: "C172",
  order: 7,
  powerplant: "reciprocating",
  registration: "SP-ANT",
  source: "SP-ANT registration-specific W&B data",
  type: "FR172H",
  usableFuelCapacityLiters: 174,
  weightBalance: {
    armsM: {
      baggage: 2.413,
      coPilot: 0.9398,
      firstPassenger: 1.8542,
      fuel: 1.2192,
      pilot: 0.9398,
      secondPassenger: 1.8542
    },
    defaults: {
      emptyArmM: "0.927742",
      emptyWeightKg: "773.13"
    },
    envelope: {
      maxMomentKgm: 3540.195,
      maxWeightKg: 1156.662,
      minMomentKgm: 898.658,
      minWeightKg: 680.389,
      points: [
        { momentKgm: 898.658, weightKg: 680.389 },
        { momentKgm: 1527.719, weightKg: 884.506 },
        { momentKgm: 3070.128, weightKg: 1156.662 },
        { momentKgm: 3540.195, weightKg: 1156.662 },
        { momentKgm: 1227.014, weightKg: 680.389 }
      ]
    },
    fuelArmM: 1.2192,
    fuelDensityKgPerL: 0.721,
    mtowKg: 1156.662,
    source: "SP-ANT W&B XLSX converted from kg, liters, inches, pounds and lb-in/1000 to kg, meters and kgm.",
    sourceUnits: {
      baggageArmIn: 95,
      emptyAircraftArmIn: 37.24,
      emptyAircraftWeightKg: 764.63,
      emptyWeightIncludesOil: true,
      fuelArmIn: 48,
      fuelDensityKgPerL: 0.721,
      fuelTankCapacityLiters: 197,
      frontSeatArmIn: 37,
      mtowLb: 2550,
      oilArmIn: -27.77,
      oilWeightKg: 8.5,
      rearSeatArmIn: 73,
      usableFuelCapacityLiters: 174,
      weightBalanceEnvelope: "CG inches / weight lb points: 52/1500, 68/1950, 104.5/2550, 120.5/2550, 71/1500"
    }
  }
});
