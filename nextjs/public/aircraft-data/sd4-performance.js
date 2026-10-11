(function () {
  const climbDensityAltitudesFt = [0, 2000, 4000, 6000, 8000, 10000, 12000];
  const climbToAltitudesFt = [0, 2000, 4000, 6000, 8000, 10000, 12000, 14000];
  const cruiseAltitudesFt = [0, 3000, 6000, 9000, 12000];
  const cruiseRpms = [3500, 4000, 4500, 5000, 5500];
  const cruisePowerPct = {
    3500: 40,
    4000: 52,
    4500: 64,
    5000: 76,
    5500: 88
  };
  const ktasByAltitude = {
    0: { 3500: 81, 4000: 91, 4500: 101, 5000: 110, 5500: 116 },
    3000: { 3500: 80, 4000: 90, 4500: 100, 5000: 109, 5500: 115 },
    6000: { 3500: 79, 4000: 90, 4500: 100, 5000: 108, 5500: 114 },
    9000: { 3500: 77, 4000: 87, 4500: 98, 5000: 106, 5500: 112 },
    12000: { 3500: 73, 4000: 84, 4500: 95, 5000: 105, 5500: 111 }
  };
  const kiasByAltitude = {
    0: { 3500: 79, 4000: 90, 4500: 100, 5000: 108, 5500: 113 },
    3000: { 3500: 75, 4000: 85, 4500: 94, 5000: 102, 5500: 108 },
    6000: { 3500: 71, 4000: 80, 4500: 89, 5000: 97, 5500: 102 },
    9000: { 3500: 66, 4000: 75, 4500: 84, 5000: 91, 5500: 95 },
    12000: { 3500: 59, 4000: 68, 4500: 78, 5000: 85, 5500: 89 }
  };
  const fuelFlowByAltitude = {
    0: { 3500: 8.6, 4000: 11.5, 4500: 15.2, 5000: 19.8, 5500: 25.0 },
    3000: { 3500: 7.8, 4000: 10.6, 4500: 14.0, 5000: 18.3, 5500: 23.5 },
    6000: { 3500: 7.2, 4000: 9.8, 4500: 13.0, 5000: 16.8, 5500: 22.0 },
    9000: { 3500: 6.6, 4000: 8.9, 4500: 11.8, 5000: 15.3, 5500: 20.2 },
    12000: { 3500: 6.2, 4000: 8.2, 4500: 10.8, 5000: 14.0, 5500: 18.5 }
  };
  const rangeByAltitude = {
    0: { 3500: 810, 4000: 690, 4500: 560, 5000: 455, 5500: 365 },
    3000: { 3500: 845, 4000: 735, 4500: 615, 5000: 505, 5500: 405 },
    6000: { 3500: 900, 4000: 810, 4500: 670, 5000: 555, 5500: 445 },
    9000: { 3500: 1020, 4000: 890, 4500: 730, 5000: 600, 5500: 480 },
    12000: { 3500: 1110, 4000: 965, 4500: 790, 5000: 645, 5500: 520 }
  };
  const enduranceByAltitude = {
    0: { 3500: 10.4, 4000: 7.8, 4500: 5.9, 5000: 4.6, 5500: 3.6 },
    3000: { 3500: 11.1, 4000: 8.4, 4500: 6.4, 5000: 5.0, 5500: 3.9 },
    6000: { 3500: 11.9, 4000: 9.1, 4500: 6.9, 5000: 5.5, 5500: 4.3 },
    9000: { 3500: 13.5, 4000: 10.0, 4500: 7.6, 5000: 6.1, 5500: 4.7 },
    12000: { 3500: 14.8, 4000: 11.0, 4500: 8.5, 5000: 6.6, 5500: 5.1 }
  };

  function makeCruiseTable(altitudeFt) {
    return cruiseRpms.map(function (rpm) {
      return {
        mapInHg: NaN,
        rpm: rpm,
        values: [{
          enduranceHours: enduranceByAltitude[altitudeFt][rpm],
          fuelTotalLph: fuelFlowByAltitude[altitudeFt][rpm],
          fuelPerEngineLph: fuelFlowByAltitude[altitudeFt][rpm],
          kias: kiasByAltitude[altitudeFt][rpm],
          ktas: ktasByAltitude[altitudeFt][rpm],
          pwrPct: cruisePowerPct[rpm],
          rangeNm: rangeByAltitude[altitudeFt][rpm]
        }]
      };
    });
  }

  window.SD4_PERFORMANCE = {
    aircraftType: "SD-4",
    icaoType: "SD4",
    source: "SD-4 performance tables and charts provided by user.",
    status: "partial",
    limitations: {
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
    glide: {
      airspeedKias: 64,
      bestGlideKias: 64,
      ratio: 8,
      ratioText: "1:8",
      source: "SD-4 glide ratio data provided by user.",
      title: "Glide ratio"
    },
    takeoff: {
      conditions: [
        "Level runway",
        "Flaps Position I",
        "Speed over 50 ft: 59 KIAS"
      ],
      defaultSurface: "tarmacConcrete",
      flaps: "Position I",
      notes: [
        "Grass data not tested.",
        "AC91-3 suggests take-off and landing distances of concrete multiplied by 1.14 for grass.",
        "Distance over 50 ft obstacle for grass is linearly extrapolated."
      ],
      source: "SD-4 POH take-off distance, flaps Position I.",
      speedOver50ftKias: 59,
      surfaces: {
        tarmacConcrete: {
          groundRollFt: 653,
          groundRollM: 199,
          label: "Tarmac/Concrete",
          obstacle50ftFt: 1201,
          obstacle50ftM: 366
        },
        grass: {
          groundRollFt: 745,
          groundRollM: 227,
          label: "Grass",
          obstacle50ftFt: 1369,
          obstacle50ftM: 417
        }
      }
    },
    landing: {
      conditions: [
        "Power at 50 ft: IDLE",
        "Runway surface: see table"
      ],
      defaultVariant: "flapII",
      notes: [
        "Grass data not tested.",
        "AC91-3 suggests landing distances of concrete multiplied by 1.18 for grass.",
        "Distance over 50 ft obstacle for grass is linearly extrapolated."
      ],
      source: "SD-4 landing distance tables, flaps II and III.",
      variants: {
        flapII: {
          flaps: "Flap II",
          label: "Normal landing",
          speedOver50ftKias: 56,
          surfaces: {
            tarmacConcrete: { groundRollFt: 676, groundRollM: 206, label: "Tarmac/Concrete", obstacle50ftFt: 1253, obstacle50ftM: 382 },
            grass: { groundRollFt: 798, groundRollM: 243, label: "Grass", obstacle50ftFt: 1479, obstacle50ftM: 451 }
          }
        },
        flapIII: {
          flaps: "Flap III",
          label: "Precautionary short field landing",
          speedOver50ftKias: 53,
          surfaces: {
            tarmacConcrete: { groundRollFt: 584, groundRollM: 178, label: "Tarmac/Concrete", obstacle50ftFt: 1158, obstacle50ftM: 353 },
            grass: { groundRollFt: 689, groundRollM: 210, label: "Grass", obstacle50ftFt: 1367, obstacle50ftM: 417 }
          }
        }
      }
    },
    climb: {
      densityAltitudesFt: climbDensityAltitudesFt.slice(),
      digitizedFromChart: true,
      powerSetting: "Max Power",
      source: "SD-4 climb performance charts, density altitude, 600 kg.",
      weightKg: 600,
      cleanConditions: {
        appliesAtAnyAltitude: true,
        bestAngleOfClimb: { seaLevelKcas: 51, seaLevelKias: 50, speedLabel: "Vx" },
        bestRateOfClimb: { seaLevelKcas: 70, seaLevelKias: 68, speedLabel: "Vy" },
        flaps: "Retracted",
        throttle: "Max Power"
      },
      flappedConditions: {
        appliesAtAnyAltitude: true,
        bestAngleOfClimb: { seaLevelKcas: 50, seaLevelKias: 49, speedLabel: "Vx" },
        bestRateOfClimb: { seaLevelKcas: 63, seaLevelKias: 61, speedLabel: "Vy" },
        flaps: "Position I",
        throttle: "Max Power"
      },
      profiles: {
        cleanVy: {
          conditionsKey: "cleanConditions",
          flaps: "Retracted",
          rateOfClimbFpm: [910, 805, 710, 610, 520, 425, 330],
          speedKcas: 70,
          speedKias: [68, 68, 68, 68, 68, 68, 68],
          speedLabel: "Vy"
        },
        cleanVx: {
          conditionsKey: "cleanConditions",
          flaps: "Retracted",
          rateOfClimbFpm: [760, 690, 610, 520, 430, 330, 235],
          speedKcas: 51,
          speedKias: [50, 50, 51, 52, 54, 56, 58],
          speedLabel: "Vx"
        },
        flapsVy: {
          conditionsKey: "flappedConditions",
          flaps: "Position I",
          rateOfClimbFpm: [810, 710, 610, 515, 425, 325, 240],
          speedKcas: 63,
          speedKias: [61, 61, 61, 61, 61, 61, 61],
          speedLabel: "Vy"
        },
        flapsVx: {
          conditionsKey: "flappedConditions",
          flaps: "Position I",
          rateOfClimbFpm: [700, 640, 540, 460, 375, 300, 220],
          speedKcas: 50,
          speedKias: [49, 49, 50, 51, 52, 54, 56],
          speedLabel: "Vx"
        }
      }
    },
    climbToAltitude: {
      altitudesFt: climbToAltitudesFt.slice(),
      digitizedFromChart: true,
      fuelChart: {
        airspeedsKias: [60, 70, 80],
        title: "Fuel to Climb, ISA, 600 kg TOW",
        unit: "litres"
      },
      distanceChart: {
        airspeedsKias: [60, 70, 80],
        title: "Distance to Climb, ISA, 600 kg TOW",
        unit: "NM"
      },
      timeChart: {
        airspeedsKias: [60, 70, 80],
        title: "Time to Climb, ISA, 600 kg TOW",
        unit: "minutes"
      },
      source: "SD-4 fuel, time and distance to climb charts, ISA, 600 kg TOW.",
      profiles: {
        "60": {
          distanceNm: [0, 2.5, 5.3, 8.8, 13.2, 18.5, 24.8, 34.0],
          fuelLiters: [0, 0.8, 1.8, 2.7, 3.7, 4.8, 6.0, 7.5],
          speedKias: 60,
          timeMinutes: [0, 2.4, 5.0, 8.2, 12.0, 16.2, 21.0, 27.5]
        },
        "70": {
          distanceNm: [0, 2.6, 5.8, 10.0, 15.0, 21.0, 29.0, 39.0],
          fuelLiters: [0, 0.9, 1.8, 2.7, 3.8, 4.9, 6.1, 8.0],
          speedKias: 70,
          timeMinutes: [0, 2.4, 5.0, 8.3, 12.0, 16.2, 21.0, 29.0]
        },
        "80": {
          distanceNm: [0, 2.9, 6.7, 11.5, 18.0, 26.0, 37.0, 51.0],
          fuelLiters: [0, 1.0, 2.1, 3.1, 4.3, 5.7, 7.8, 10.0],
          speedKias: 80,
          timeMinutes: [0, 2.5, 5.2, 8.8, 13.0, 18.2, 25.0, 34.0]
        }
      }
    },
    cruise: {
      digitizedFromChart: true,
      engineCount: 1,
      cruiseSpeedProfile: {
        densityAltitudesFt: cruiseAltitudesFt.slice(),
        engineRpms: cruiseRpms.slice(),
        kiasByAltitude: kiasByAltitude,
        title: "Cruise Performance, ISA, 600 kg",
        unit: "KIAS"
      },
      trueAirspeedProfile: {
        densityAltitudesFt: cruiseAltitudesFt.slice(),
        engineRpms: cruiseRpms.slice(),
        ktasByAltitude: ktasByAltitude,
        title: "True Airspeed, ISA, 600 kg",
        unit: "KTAS"
      },
      enduranceProfile: {
        densityAltitudesFt: cruiseAltitudesFt.slice(),
        enduranceByAltitudeHours: enduranceByAltitude,
        engineRpms: cruiseRpms.slice(),
        title: "Endurance, ISA, 600 kg",
        unit: "hours"
      },
      fuelFlowProfile: {
        densityAltitudesFt: cruiseAltitudesFt.slice(),
        engineRpms: cruiseRpms.slice(),
        fuelFlowByAltitudeLph: fuelFlowByAltitude,
        title: "Fuel Flow, ISA, 600 kg",
        unit: "litres/hour"
      },
      isaDeltaC: [0],
      pressureAltitudesFt: cruiseAltitudesFt.slice(),
      rangeProfile: {
        densityAltitudesFt: cruiseAltitudesFt.slice(),
        engineRpms: cruiseRpms.slice(),
        rangeByAltitudeNm: rangeByAltitude,
        title: "Range, ISA, 600 kg",
        unit: "NM"
      },
      source: "SD-4 cruise, true airspeed, fuel flow, range and endurance charts, ISA, 600 kg.",
      tables: cruiseAltitudesFt.reduce(function (tables, altitudeFt) {
        tables[String(altitudeFt)] = makeCruiseTable(altitudeFt);
        return tables;
      }, {}),
      usesMap: false,
      weightKg: 600
    }
  };
})();
