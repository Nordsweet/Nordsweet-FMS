(function () {
  const FT_TO_M = 0.3048;
  const GAL_TO_L = 3.785411784;
  const LB_TO_KG = 0.45359237;

  function round(value, digits) {
    const factor = Math.pow(10, digits);
    return Math.round(value * factor) / factor;
  }

  function buildDistanceTable(rows) {
    return {
      groundRoll: rows.map(function (row) {
        return row.map(function (pair) {
          return round(pair[0] * FT_TO_M, 3);
        });
      }),
      obstacle50ft: rows.map(function (row) {
        return row.map(function (pair) {
          return round(pair[1] * FT_TO_M, 3);
        });
      })
    };
  }

  function buildWeightTable(weightLb, liftoffSpeedKias, obstacle50ftSpeedKias, rows) {
    return {
      flapsDeg: 10,
      liftoffSpeedKias: liftoffSpeedKias,
      obstacle50ftSpeedKias: obstacle50ftSpeedKias,
      pressureAltitudesFt: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000],
      runway: "Paved, level, dry",
      temperaturesC: [0, 10, 20, 30, 40],
      weightKg: round(weightLb * LB_TO_KG, 3),
      weightLb: weightLb,
      distanceFt: {
        groundRoll: rows.map(function (row) {
          return row.map(function (pair) {
            return pair[0];
          });
        }),
        obstacle50ft: rows.map(function (row) {
          return row.map(function (pair) {
            return pair[1];
          });
        })
      },
      distanceM: buildDistanceTable(rows)
    };
  }

  function buildLandingWeightTable(weightLb, approachSpeedKias, rows) {
    return {
      flapsDeg: 40,
      pressureAltitudesFt: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000],
      runway: "Paved, level, dry",
      shortFinalApproachSpeedKias: approachSpeedKias,
      temperaturesC: [0, 10, 20, 30, 40],
      throttle: "Power off",
      weightKg: round(weightLb * LB_TO_KG, 3),
      weightLb: weightLb,
      distanceFt: {
        groundRoll: rows.map(function (row) {
          return row.map(function (pair) {
            return pair[0];
          });
        }),
        obstacle50ft: rows.map(function (row) {
          return row.map(function (pair) {
            return pair[1];
          });
        })
      },
      distanceM: buildDistanceTable(rows)
    };
  }

  function buildMaxRateClimbWeightTable(weightLb, rows) {
    return {
      climbSpeedKias: rows.map(function (row) {
        return row[1];
      }),
      pressureAltitudesFt: rows.map(function (row) {
        return row[0];
      }),
      rateOfClimbFpm: rows.map(function (row) {
        return row.slice(2);
      }),
      temperaturesC: [-20, 0, 20, 40],
      weightKg: round(weightLb * LB_TO_KG, 3),
      weightLb: weightLb
    };
  }

  function buildTimeFuelDistanceRows(rows, fixedClimbSpeedKias) {
    return rows.map(function (row) {
      return {
        pressureAltitudeFt: row[0],
        temperatureC: row[1],
        climbSpeedKias: fixedClimbSpeedKias || row[2],
        rateOfClimbFpm: fixedClimbSpeedKias ? row[2] : row[3],
        timeMinFromSeaLevel: fixedClimbSpeedKias ? row[3] : row[4],
        fuelUsedGallonsFromSeaLevel: fixedClimbSpeedKias ? row[4] : row[5],
        distanceNmFromSeaLevel: fixedClimbSpeedKias ? row[5] : row[6]
      };
    });
  }

  function buildCruiseValue(value) {
    if (!Array.isArray(value)) {
      return null;
    }

    return {
      fuelGph: value[2],
      fuelPerEngineLph: round(value[2] * GAL_TO_L, 3),
      ktas: value[1],
      pwrPct: value[0]
    };
  }

  function buildCruiseSetting(rpm, mapInHg, values) {
    return {
      mapInHg: mapInHg,
      rpm: rpm,
      values: values.map(buildCruiseValue)
    };
  }

  window.R172K_PERFORMANCE = {
    aircraftType: "R172K",
    icaoType: "C172",
    source: "R172K take-off, climb, cruise and landing performance tables.",
    status: "partial",
    limitations: {
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
    climb: {
      source: "R172K POH rate of climb, maximum, weight 2550 lb.",
      conditions: [
        "Flaps up.",
        "2600 RPM.",
        "Full throttle.",
        "Mixture set at placard fuel flow.",
        "Cowl flap open."
      ],
      flaps: "Up",
      fuelFlowBasis: "R172K climb fuel flow",
      fuelFlowGph: round(65 / GAL_TO_L, 3),
      fuelFlowLph: 65,
      landingGear: "Fixed",
      mixtureGphByPressureAltitudeFt: [
        { pressureAltitudeFt: 0, fuelFlowGph: 16 },
        { pressureAltitudeFt: 4000, fuelFlowGph: 14 },
        { pressureAltitudeFt: 8000, fuelFlowGph: 12 },
        { pressureAltitudeFt: 12000, fuelFlowGph: 10 }
      ],
      powerSetting: "2600 RPM, full throttle",
      speedLabel: "Max ROC",
      speedKey: "climbSpeedKias",
      temperaturesC: [-20, 0, 20, 40],
      weightsLb: {
        "2550": buildMaxRateClimbWeightTable(2550, [
          [0, 81, 1040, 945, 845, 750],
          [2000, 80, 925, 830, 740, 650],
          [4000, 79, 810, 720, 635, 545],
          [6000, 78, 695, 615, 530, 445],
          [8000, 77, 585, 505, 425, 345],
          [10000, 76, 480, 400, 320, null],
          [12000, 75, 370, 295, 220, null]
        ])
      }
    },
    timeFuelDistanceToClimb: {
      notes: [
        "Add 1.4 gallon of fuel for engine start, taxi and takeoff allowance.",
        "Increase time, fuel and distance by 10% for each 10 deg C above standard temperature.",
        "Distances shown are based on zero wind."
      ],
      profiles: {
        maxRate: {
          source: "R172K POH time, fuel and distance to climb, maximum rate of climb.",
          climbSpeedMode: "maximumRate",
          rows: buildTimeFuelDistanceRows([
            [0, 15, 81, 870, 0, 0, 0],
            [1000, 13, 80, 825, 1, 0.3, 2],
            [2000, 11, 80, 780, 2, 0.6, 3],
            [3000, 9, 79, 735, 4, 1.0, 5],
            [4000, 7, 79, 690, 5, 1.3, 7],
            [5000, 5, 79, 645, 7, 1.6, 9],
            [6000, 3, 78, 600, 8, 2.0, 11],
            [7000, 1, 78, 555, 10, 2.4, 14],
            [8000, -1, 77, 510, 12, 2.7, 16],
            [9000, -3, 77, 465, 14, 3.2, 19],
            [10000, -5, 76, 420, 16, 3.6, 23],
            [11000, -7, 76, 375, 19, 4.0, 26],
            [12000, -9, 75, 330, 22, 4.5, 31]
          ])
        },
        normal90Kias: {
          source: "R172K POH time, fuel and distance to climb, normal climb 90 KIAS.",
          climbSpeedKias: 90,
          climbSpeedMode: "normal90Kias",
          rows: buildTimeFuelDistanceRows([
            [0, 15, 860, 0, 0, 0],
            [1000, 13, 805, 1, 0.3, 2],
            [2000, 11, 755, 3, 0.6, 4],
            [3000, 9, 700, 4, 1.0, 6],
            [4000, 7, 645, 5, 1.3, 8],
            [5000, 5, 595, 7, 1.7, 11],
            [6000, 3, 540, 9, 2.1, 14],
            [7000, 1, 485, 11, 2.5, 17],
            [8000, -1, 435, 13, 3.0, 20],
            [9000, -3, 380, 16, 3.5, 25],
            [10000, -5, 325, 18, 4.0, 30],
            [11000, -7, 275, 22, 4.6, 36],
            [12000, -9, 220, 26, 5.3, 43]
          ], 90)
        }
      }
    },
    glide: {
      source: "R172K POH glide chart.",
      title: "Glide distance",
      conditions: [
        "Propeller windmilling.",
        "Flaps up.",
        "Zero wind."
      ],
      bestGlideSpeedByWeight: [
        { weightLb: 2550, weightKg: round(2550 * LB_TO_KG, 3), speedKias: 75 },
        { weightLb: 2150, weightKg: round(2150 * LB_TO_KG, 3), speedKias: 69 },
        { weightLb: 1750, weightKg: round(1750 * LB_TO_KG, 3), speedKias: 62 }
      ],
      distanceProfile: {
        heightAboveTerrainFt: [0, 2000, 4000, 6000, 8000, 10000, 12000],
        groundDistanceNm: [0, 3.33, 6.67, 10, 13.33, 16.67, 20],
        ratio: round((20 * 6076.12) / 12000, 2),
        ratioText: "1:10.1"
      }
    },
    cruise: {
      source: "R172K POH cruise performance tables, Figure 5-7.",
      conditions: [
        "2550 pounds.",
        "Recommended lean mixture.",
        "Cowl flap closed."
      ],
      engineCount: 1,
      fuelConsumptionBasis: "Fuel consumption for one engine.",
      isaDeltaC: [-20, 0, 20],
      note: "For best fuel economy at 70% power or less, operate at 1 GPH leaner than shown in this chart or at peak EGT if an EGT indicator is installed.",
      powerSetting: "Cruise",
      pressureAltitudesFt: [2000, 4000, 6000, 8000, 10000, 12000],
      standardTemperatureCByAltitudeFt: {
        "2000": 11,
        "4000": 7,
        "6000": 3,
        "8000": -1,
        "10000": -5,
        "12000": -9
      },
      weightKg: round(2550 * LB_TO_KG, 3),
      weightLb: 2550,
      tables: {
        "2000": [
          buildCruiseSetting(2600, 24, [null, [81, 126, 11.4], [78, 127, 11.0]]),
          buildCruiseSetting(2600, 23, [[78, 122, 11.1], [76, 122, 10.7], [73, 123, 10.3]]),
          buildCruiseSetting(2600, 22, [[73, 118, 10.3], [71, 119, 10.0], [68, 119, 9.6]]),
          buildCruiseSetting(2600, 21, [[70, 114, 9.6], [66, 114, 9.3], [63, 114, 9.0]]),
          buildCruiseSetting(2500, 25, [null, [81, 126, 11.5], [78, 127, 11.1]]),
          buildCruiseSetting(2500, 24, [[80, 122, 11.2], [77, 123, 10.8], [74, 124, 10.5]]),
          buildCruiseSetting(2500, 23, [[76, 119, 10.6], [72, 120, 10.2], [70, 120, 9.9]]),
          buildCruiseSetting(2500, 22, [[70, 116, 9.9], [67, 116, 9.5], [65, 116, 9.2]]),
          buildCruiseSetting(2400, 25, [[79, 122, 11.2], [76, 123, 10.8], [74, 123, 10.4]]),
          buildCruiseSetting(2400, 24, [[74, 119, 10.5], [72, 120, 10.2], [69, 120, 9.8]]),
          buildCruiseSetting(2400, 23, [[70, 116, 9.9], [67, 116, 9.5], [65, 116, 9.2]]),
          buildCruiseSetting(2400, 22, [[65, 112, 9.2], [63, 112, 8.9], [61, 112, 8.6]]),
          buildCruiseSetting(2300, 25, [[74, 119, 10.5], [72, 119, 10.1], [69, 120, 9.8]]),
          buildCruiseSetting(2300, 24, [[70, 116, 9.9], [67, 116, 9.5], [65, 116, 9.2]]),
          buildCruiseSetting(2300, 23, [[65, 112, 9.2], [63, 112, 8.9], [61, 112, 8.7]]),
          buildCruiseSetting(2300, 22, [[61, 108, 8.6], [59, 108, 8.4], [57, 107, 8.1]]),
          buildCruiseSetting(2200, 25, [[69, 115, 9.8], [67, 115, 9.4], [64, 115, 9.1]]),
          buildCruiseSetting(2200, 24, [[65, 112, 9.2], [63, 112, 8.9], [61, 111, 8.6]]),
          buildCruiseSetting(2200, 23, [[61, 108, 8.6], [59, 108, 8.3], [57, 107, 8.1]]),
          buildCruiseSetting(2200, 22, [[57, 104, 8.1], [55, 103, 7.8], [53, 102, 7.6]]),
          buildCruiseSetting(2200, 21, [[52, 99, 7.6], [51, 98, 7.3], [49, 97, 7.1]]),
          buildCruiseSetting(2200, 20, [[48, 94, 7.0], [47, 93, 6.8], [45, 91, 6.6]]),
          buildCruiseSetting(2200, 19, [[44, 88, 6.5], [43, 87, 6.3], [41, 86, 6.2]])
        ],
        "4000": [
          buildCruiseSetting(2600, 23, [[81, 126, 11.5], [79, 127, 11.1], [76, 127, 10.7]]),
          buildCruiseSetting(2600, 22, [[76, 122, 10.8], [73, 123, 10.4], [71, 123, 10.0]]),
          buildCruiseSetting(2600, 21, [[71, 119, 10.0], [68, 119, 9.7], [66, 119, 9.3]]),
          buildCruiseSetting(2600, 20, [[66, 114, 9.3], [63, 114, 9.0], [61, 113, 8.7]]),
          buildCruiseSetting(2500, 24, [[82, 126, 11.6], [79, 127, 11.2], [77, 128, 10.8]]),
          buildCruiseSetting(2500, 23, [[77, 123, 11.0], [75, 124, 10.6], [72, 124, 10.2]]),
          buildCruiseSetting(2500, 22, [[73, 120, 10.3], [70, 120, 9.9], [68, 120, 9.6]]),
          buildCruiseSetting(2500, 21, [[68, 116, 9.6], [65, 116, 9.3], [63, 116, 9.0]]),
          buildCruiseSetting(2400, 24, [[77, 123, 10.9], [74, 124, 10.5], [72, 124, 10.2]]),
          buildCruiseSetting(2400, 23, [[72, 120, 10.2], [70, 120, 9.9], [68, 120, 9.5]]),
          buildCruiseSetting(2400, 22, [[68, 116, 9.6], [65, 116, 9.2], [63, 116, 9.0]]),
          buildCruiseSetting(2400, 21, [[63, 112, 8.9], [61, 111, 8.6], [59, 110, 8.4]]),
          buildCruiseSetting(2300, 24, [[72, 120, 10.2], [70, 120, 9.9], [67, 120, 9.5]]),
          buildCruiseSetting(2300, 23, [[68, 116, 9.6], [65, 116, 9.3], [63, 116, 9.0]]),
          buildCruiseSetting(2300, 22, [[63, 112, 9.0], [61, 112, 8.7], [59, 111, 8.4]]),
          buildCruiseSetting(2300, 21, [[59, 108, 8.4], [57, 107, 8.1], [55, 106, 7.9]]),
          buildCruiseSetting(2200, 24, [[68, 116, 9.6], [65, 116, 9.2], [63, 115, 8.9]]),
          buildCruiseSetting(2200, 23, [[63, 112, 9.0], [61, 112, 8.7], [59, 111, 8.4]]),
          buildCruiseSetting(2200, 22, [[59, 108, 8.4], [57, 107, 8.1], [55, 106, 7.9]]),
          buildCruiseSetting(2200, 21, [[55, 103, 7.9], [53, 102, 7.6], [51, 101, 7.4]]),
          buildCruiseSetting(2200, 20, [[51, 98, 7.3], [49, 97, 7.1], [47, 95, 6.9]]),
          buildCruiseSetting(2200, 19, [[46, 92, 6.8], [45, 91, 6.6], [43, 89, 6.4]])
        ],
        "6000": [
          buildCruiseSetting(2600, 23, [null, [81, 131, 11.5], [79, 131, 11.1]]),
          buildCruiseSetting(2600, 22, [[79, 126, 11.2], [76, 127, 10.8], [74, 127, 10.4]]),
          buildCruiseSetting(2600, 21, [[74, 123, 10.5], [71, 123, 10.1], [69, 123, 9.7]]),
          buildCruiseSetting(2600, 20, [[69, 119, 9.7], [66, 118, 9.3], [64, 118, 9.1]]),
          buildCruiseSetting(2500, 23, [[80, 127, 11.3], [77, 128, 10.9], [75, 128, 10.6]]),
          buildCruiseSetting(2500, 22, [[76, 124, 10.7], [73, 124, 10.3], [70, 124, 9.9]]),
          buildCruiseSetting(2500, 21, [[71, 120, 10.0], [68, 120, 9.6], [66, 120, 9.3]]),
          buildCruiseSetting(2500, 20, [[66, 116, 9.3], [63, 116, 9.0], [61, 115, 8.7]]),
          buildCruiseSetting(2400, 23, [[75, 124, 10.6], [72, 124, 10.2], [70, 124, 9.9]]),
          buildCruiseSetting(2400, 22, [[70, 120, 9.9], [68, 120, 9.6], [65, 120, 9.3]]),
          buildCruiseSetting(2400, 21, [[65, 116, 9.3], [63, 115, 9.0], [61, 114, 8.7]]),
          buildCruiseSetting(2400, 20, [[61, 111, 8.6], [59, 110, 8.4], [57, 109, 8.1]]),
          buildCruiseSetting(2300, 23, [[71, 120, 10.0], [68, 120, 9.6], [66, 120, 9.3]]),
          buildCruiseSetting(2300, 22, [[66, 116, 9.3], [64, 116, 9.0], [61, 115, 8.7]]),
          buildCruiseSetting(2300, 21, [[61, 112, 8.7], [59, 111, 8.4], [57, 110, 8.2]]),
          buildCruiseSetting(2300, 20, [[57, 107, 8.1], [55, 105, 7.9], [53, 105, 7.6]]),
          buildCruiseSetting(2200, 23, [[66, 116, 9.3], [63, 116, 9.0], [61, 115, 8.7]]),
          buildCruiseSetting(2200, 22, [[62, 112, 8.7], [59, 111, 8.4], [57, 110, 8.2]]),
          buildCruiseSetting(2200, 21, [[57, 107, 8.2], [56, 106, 7.9], [53, 105, 7.7]]),
          buildCruiseSetting(2200, 20, [[53, 102, 7.6], [51, 101, 7.4], [49, 99, 7.2]]),
          buildCruiseSetting(2200, 19, [[49, 96, 7.1], [47, 95, 6.8], [46, 93, 6.7]]),
          buildCruiseSetting(2200, 18, [[44, 90, 6.6], [43, 89, 6.4], [41, 87, 6.2]])
        ],
        "8000": [
          buildCruiseSetting(2600, 21, [[77, 127, 10.9], [74, 128, 10.5], [72, 127, 10.1]]),
          buildCruiseSetting(2600, 20, [[72, 123, 10.1], [69, 123, 9.8], [67, 122, 9.4]]),
          buildCruiseSetting(2600, 19, [[66, 118, 9.4], [64, 118, 9.0], [62, 116, 8.8]]),
          buildCruiseSetting(2600, 18, [[61, 113, 8.6], [59, 111, 8.3], [57, 110, 8.1]]),
          buildCruiseSetting(2500, 21, [[74, 125, 10.4], [71, 125, 10.0], [69, 124, 9.7]]),
          buildCruiseSetting(2500, 20, [[69, 120, 9.7], [66, 120, 9.4], [64, 119, 9.1]]),
          buildCruiseSetting(2500, 19, [[64, 116, 9.0], [61, 115, 8.7], [59, 113, 8.4]]),
          buildCruiseSetting(2500, 18, [[59, 110, 8.4], [56, 109, 8.1], [54, 108, 7.8]]),
          buildCruiseSetting(2400, 21, [[68, 120, 9.6], [65, 119, 9.3], [63, 118, 9.0]]),
          buildCruiseSetting(2400, 20, [[63, 115, 9.0], [61, 114, 8.6], [59, 113, 8.4]]),
          buildCruiseSetting(2400, 19, [[58, 110, 8.3], [56, 108, 8.0], [54, 107, 7.8]]),
          buildCruiseSetting(2400, 18, [[54, 104, 7.7], [52, 103, 7.5], [50, 101, 7.2]]),
          buildCruiseSetting(2300, 21, [[64, 116, 9.1], [62, 115, 8.7], [59, 114, 8.5]]),
          buildCruiseSetting(2300, 20, [[59, 111, 8.5], [57, 109, 8.2], [55, 109, 7.9]]),
          buildCruiseSetting(2300, 19, [[55, 105, 7.9], [53, 104, 7.6], [51, 103, 7.4]]),
          buildCruiseSetting(2300, 18, [[50, 100, 7.3], [48, 99, 7.0], [47, 97, 6.8]]),
          buildCruiseSetting(2200, 21, [[60, 111, 8.5], [57, 110, 8.2], [55, 109, 7.9]]),
          buildCruiseSetting(2200, 20, [[55, 106, 7.9], [53, 105, 7.7], [51, 103, 7.4]]),
          buildCruiseSetting(2200, 19, [[51, 100, 7.4], [50, 99, 7.1], [47, 97, 6.9]]),
          buildCruiseSetting(2200, 18, [[47, 94, 6.8], [45, 93, 6.6], [43, 91, 6.4]])
        ],
        "10000": [
          buildCruiseSetting(2600, 19, [[69, 123, 9.8], [67, 122, 9.4], [64, 121, 9.1]]),
          buildCruiseSetting(2600, 18, [[64, 117, 9.0], [61, 116, 8.7], [59, 115, 8.4]]),
          buildCruiseSetting(2600, 17, [[58, 110, 8.3], [56, 109, 8.0], [54, 108, 7.8]]),
          buildCruiseSetting(2600, 16, [[53, 104, 7.6], [51, 102, 7.3], [49, 100, 7.1]]),
          buildCruiseSetting(2500, 19, [[67, 120, 9.4], [64, 119, 9.1], [62, 118, 8.8]]),
          buildCruiseSetting(2500, 18, [[62, 115, 8.7], [59, 113, 8.4], [57, 112, 8.2]]),
          buildCruiseSetting(2500, 17, [[56, 108, 8.0], [54, 107, 7.7], [52, 105, 7.5]]),
          buildCruiseSetting(2500, 16, [[50, 101, 7.3], [49, 99, 7.1], [47, 97, 6.8]]),
          buildCruiseSetting(2400, 19, [[61, 114, 8.6], [59, 112, 8.3], [56, 111, 8.1]]),
          buildCruiseSetting(2400, 18, [[56, 108, 8.0], [54, 107, 7.8], [52, 105, 7.5]]),
          buildCruiseSetting(2400, 17, [[51, 102, 7.4], [49, 100, 7.2], [48, 99, 7.0]]),
          buildCruiseSetting(2400, 16, [[47, 95, 6.8], [45, 94, 6.6], [43, 91, 6.4]]),
          buildCruiseSetting(2300, 19, [[57, 109, 8.2], [55, 108, 7.9], [53, 107, 7.7]]),
          buildCruiseSetting(2300, 18, [[53, 104, 7.6], [51, 102, 7.3], [49, 100, 7.1]]),
          buildCruiseSetting(2300, 17, [[48, 97, 7.0], [46, 95, 6.8], [45, 94, 6.6]]),
          buildCruiseSetting(2200, 19, [[53, 104, 7.7], [51, 103, 7.4], [49, 101, 7.2]]),
          buildCruiseSetting(2200, 18, [[49, 98, 7.1], [47, 97, 6.9], [45, 95, 6.7]]),
          buildCruiseSetting(2200, 17, [[45, 92, 6.6], [43, 90, 6.4], [42, 88, 6.2]])
        ],
        "12000": [
          buildCruiseSetting(2600, 18, [[67, 122, 9.4], [64, 121, 9.1], [62, 120, 8.8]]),
          buildCruiseSetting(2600, 17, [[61, 115, 8.7], [59, 114, 8.4], [57, 113, 8.1]]),
          buildCruiseSetting(2600, 16, [[55, 108, 7.9], [53, 107, 7.7], [51, 105, 7.4]]),
          buildCruiseSetting(2600, 15, [[50, 100, 7.2], [48, 99, 7.0], [46, 97, 6.7]]),
          buildCruiseSetting(2500, 18, [[64, 119, 9.1], [62, 118, 8.8], [60, 117, 8.5]]),
          buildCruiseSetting(2500, 17, [[59, 112, 8.4], [57, 112, 8.1], [55, 110, 7.8]]),
          buildCruiseSetting(2500, 16, [[53, 106, 7.7], [51, 104, 7.4], [49, 102, 7.2]]),
          buildCruiseSetting(2500, 15, [[47, 97, 6.9], [45, 95, 6.7], [44, 93, 6.5]]),
          buildCruiseSetting(2400, 18, [[58, 112, 8.3], [56, 111, 8.0], [54, 109, 7.8]]),
          buildCruiseSetting(2400, 17, [[54, 106, 7.7], [52, 104, 7.5], [50, 103, 7.2]]),
          buildCruiseSetting(2400, 16, [[49, 100, 7.1], [47, 98, 6.9], [46, 96, 6.7]]),
          buildCruiseSetting(2400, 15, [[44, 93, 6.6], [43, 90, 6.4], [41, 88, 6.2]]),
          buildCruiseSetting(2300, 18, [[55, 108, 7.9], [53, 106, 7.6], [51, 104, 7.4]]),
          buildCruiseSetting(2300, 17, [[50, 101, 7.3], [48, 100, 7.1], [47, 98, 6.8]]),
          buildCruiseSetting(2300, 16, [[46, 95, 6.7], [44, 93, 6.5], [43, 90, 6.3]]),
          buildCruiseSetting(2200, 18, [[51, 103, 7.4], [49, 101, 7.1], [47, 99, 6.9]]),
          buildCruiseSetting(2200, 17, [[47, 96, 6.8], [45, 94, 6.6], [44, 92, 6.4]])
        ]
      }
    },
    landing: {
      source: "R172K POH landing distance, short field, maximum weight 2550 lb.",
      conditions: [
        "Flaps 40 deg.",
        "Power off.",
        "Maximum braking.",
        "Paved, level, dry runway.",
        "Zero wind."
      ],
      corrections: {
        dryGrassIncreaseByGroundRollPercent: 40,
        headwindDecreasePercentPerKt: 10 / 9,
        tailwindIncreasePercentPerKt: 10 / 2,
        tailwindLimitKt: 10
      },
      flapsDeg: 40,
      maxWeightLb: 2550,
      notes: [
        "Short field technique as specified in Section 4.",
        "Decrease distances 10% for each 9 knots headwind.",
        "For operation with tail winds up to 10 knots, increase distances by 10% for each 2 knots.",
        "For operation on a dry grass runway, increase distances by 40% of the ground roll figure."
      ],
      weightsLb: {
        "2550": buildLandingWeightTable(2550, 63, [
          [[590, 1225], [610, 1255], [630, 1285], [650, 1315], [675, 1350]],
          [[610, 1255], [630, 1285], [655, 1320], [675, 1350], [700, 1390]],
          [[630, 1285], [655, 1320], [680, 1360], [700, 1390], [725, 1425]],
          [[655, 1320], [680, 1360], [705, 1395], [730, 1430], [750, 1465]],
          [[680, 1360], [705, 1395], [730, 1435], [755, 1470], [780, 1505]],
          [[705, 1395], [730, 1435], [760, 1475], [785, 1515], [810, 1550]],
          [[735, 1440], [760, 1475], [785, 1515], [815, 1560], [840, 1595]],
          [[760, 1480], [790, 1520], [815, 1560], [845, 1605], [875, 1645]],
          [[790, 1520], [820, 1555], [850, 1610], [880, 1655], [905, 1690]]
        ])
      }
    },
    takeoff: {
      source: "R172K POH take-off distance, short field, maximum weight 2550 lb plus 2400/2200 lb sheet.",
      conditions: [
        "Flaps 10 deg.",
        "2600 RPM and full throttle prior to brake release.",
        "Mixture set at placard fuel flow.",
        "Cowl flap open.",
        "Paved, level, dry runway.",
        "Zero wind."
      ],
      corrections: {
        dryGrassIncreaseByGroundRollPercent: 15,
        headwindDecreasePercentPerKt: 10 / 9,
        tailwindIncreasePercentPerKt: 10 / 2,
        tailwindLimitKt: 10
      },
      flapsDeg: 10,
      maxWeightLb: 2550,
      mixtureGphByPressureAltitudeFt: [
        { pressureAltitudeFt: 0, fuelFlowGph: 16 },
        { pressureAltitudeFt: 2000, fuelFlowGph: 15 },
        { pressureAltitudeFt: 4000, fuelFlowGph: 14 },
        { pressureAltitudeFt: 6000, fuelFlowGph: 13 },
        { pressureAltitudeFt: 8000, fuelFlowGph: 12 }
      ],
      notes: [
        "Short field technique as specified in Section 4.",
        "Decrease distances 10% for each 9 knots headwind.",
        "For operation with tail winds up to 10 knots, increase distances by 10% for each 2 knots.",
        "For operation on a dry grass runway, increase distances by 15% of the ground roll figure."
      ],
      weightsLb: {
        "2200": buildWeightTable(2200, 52, 56, [
          [[510, 880], [550, 940], [590, 1005], [635, 1075], [680, 1150]],
          [[555, 955], [600, 1025], [645, 1095], [690, 1175], [740, 1255]],
          [[605, 1040], [650, 1115], [705, 1195], [755, 1280], [810, 1370]],
          [[660, 1135], [715, 1215], [770, 1305], [825, 1400], [890, 1500]],
          [[725, 1240], [780, 1330], [840, 1430], [900, 1535], [975, 1650]],
          [[795, 1355], [855, 1460], [925, 1570], [995, 1690], [1070, 1820]],
          [[870, 1490], [940, 1605], [1015, 1730], [1095, 1865], [1175, 2010]],
          [[955, 1645], [1035, 1770], [1115, 1915], [1205, 2065], [1295, 2225]],
          [[1055, 1815], [1140, 1965], [1230, 2125], [1330, 2300], [1430, 2495]]
        ]),
        "2400": buildWeightTable(2400, 54, 58, [
          [[620, 1070], [670, 1145], [720, 1225], [775, 1315], [835, 1410]],
          [[680, 1165], [730, 1250], [790, 1340], [845, 1435], [910, 1540]],
          [[740, 1270], [800, 1365], [860, 1465], [925, 1575], [995, 1690]],
          [[810, 1390], [875, 1495], [945, 1605], [1015, 1730], [1095, 1860]],
          [[890, 1520], [960, 1640], [1035, 1765], [1115, 1905], [1200, 2055]],
          [[975, 1675], [1055, 1805], [1135, 1950], [1225, 2110], [1320, 2280]],
          [[1070, 1850], [1160, 2000], [1250, 2165], [1350, 2345], [1455, 2540]],
          [[1180, 2050], [1275, 2220], [1380, 2410], [1490, 2620], [1610, 2850]],
          [[1305, 2280], [1410, 2480], [1525, 2700], [1650, 2950], [1780, 3225]]
        ]),
        "2550": buildWeightTable(2550, 56, 60, [
          [[715, 1225], [770, 1315], [830, 1410], [895, 1510], [960, 1625]],
          [[780, 1335], [840, 1435], [905, 1540], [975, 1655], [1050, 1780]],
          [[855, 1460], [920, 1570], [995, 1690], [1070, 1820], [1150, 1960]],
          [[935, 1600], [1010, 1725], [1090, 1860], [1175, 2005], [1265, 2165]],
          [[1025, 1760], [1110, 1900], [1195, 2055], [1290, 2220], [1390, 2405]],
          [[1125, 1945], [1220, 2105], [1315, 2280], [1420, 2470], [1530, 2685]],
          [[1240, 2155], [1340, 2340], [1450, 2540], [1565, 2765], [1690, 3015]],
          [[1365, 2405], [1480, 2615], [1600, 2850], [1730, 3115], [1870, 3415]],
          [[1510, 2695], [1635, 2945], [1770, 3225], [1915, 3545], [2075, 3920]]
        ])
      }
    }
  };
})();
