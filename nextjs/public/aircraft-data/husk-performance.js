(function () {
  const FT_TO_M = 0.3048;
  const LB_TO_KG = 0.45359237;
  const MPH_TO_KT = 0.868976242;
  const MAX_WEIGHT_LB = 1890;
  const MAX_WEIGHT_KG = Math.round(MAX_WEIGHT_LB * LB_TO_KG);
  const PRESSURE_ALTITUDES_FT = [0, 2000, 4000, 6000, 8000, 10000];
  const TEMPERATURES_F = [-40, -20, 0, 20, 40, 60, 80, 100, 120];
  const TEMPERATURES_C = TEMPERATURES_F.map((tempF) => Math.round(((tempF - 32) * 5 / 9) * 10) / 10);

  function feetToMeters(valueFt) {
    return Math.round(valueFt * FT_TO_M);
  }

  function mphToKias(valueMph) {
    return Math.round(valueMph * MPH_TO_KT);
  }

  function roundTo(value, decimals) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  function getIsaTemperatureC(pressureAltitudeFt) {
    return 15 - (1.9812 * pressureAltitudeFt / 1000);
  }

  function getIsaTemperatureF(pressureAltitudeFt) {
    return getIsaTemperatureC(pressureAltitudeFt) * 9 / 5 + 32;
  }

  function interpolateTemperatureSeries(sourceTemperaturesF, row, temperatureF) {
    if (temperatureF <= sourceTemperaturesF[0]) {
      return row[0];
    }

    const lastIndex = sourceTemperaturesF.length - 1;
    if (temperatureF >= sourceTemperaturesF[lastIndex]) {
      return row[lastIndex];
    }

    for (let index = 0; index < lastIndex; index += 1) {
      const lowerTemp = sourceTemperaturesF[index];
      const upperTemp = sourceTemperaturesF[index + 1];
      if (temperatureF >= lowerTemp && temperatureF <= upperTemp) {
        const ratio = (temperatureF - lowerTemp) / (upperTemp - lowerTemp);
        return Math.round(row[index] + (row[index + 1] - row[index]) * ratio);
      }
    }

    return row[lastIndex];
  }

  function convertDistanceTable(rowsFt) {
    return rowsFt.map((row) => row.map(feetToMeters));
  }

  function buildGroundRollTable(obstacleRowsFt, groundRollRatio) {
    return obstacleRowsFt.map((row) => row.map((valueFt) => feetToMeters(valueFt * groundRollRatio)));
  }

  function buildTakeoffVariant(options) {
    const obstacleRowsFt = options.obstacle50ftDistanceFt;
    const groundRollRowsFt = obstacleRowsFt.map((row) => row.map((valueFt) => Math.round(valueFt * options.groundRollRatio)));
    return {
      source: options.source,
      status: "draft-digitized-from-chart",
      notes: [
        "No wind.",
        "Hard surface runway, dry and level.",
        "Distance values are approximate chart reads from the supplied raster images."
      ],
      propellerDiameterIn: options.propellerDiameterIn,
      flaps: options.flaps,
      takeoffType: options.takeoffType,
      maximumWeightLb: MAX_WEIGHT_LB,
      maximumWeightKg: MAX_WEIGHT_KG,
      pressureAltitudesFt: PRESSURE_ALTITUDES_FT.slice(),
      sourceTemperaturesF: TEMPERATURES_F.slice(),
      temperaturesC: TEMPERATURES_C.slice(),
      groundRollRatio: options.groundRollRatio,
      sourceDistanceFt: {
        groundRoll: groundRollRowsFt,
        obstacle50ft: obstacleRowsFt
      },
      weightsKg: {
        [String(MAX_WEIGHT_KG)]: {
          flaps: options.flaps,
          liftoffSpeedKias: mphToKias((options.liftoffSpeedMphIasRange[0] + options.liftoffSpeedMphIasRange[1]) / 2),
          liftoffSpeedMphIasRange: options.liftoffSpeedMphIasRange.slice(),
          obstacle50ftSpeedKias: mphToKias(options.obstacle50ftSpeedMphIas),
          obstacle50ftSpeedMphIas: options.obstacle50ftSpeedMphIas,
          propellerDiameterIn: options.propellerDiameterIn,
          runway: "Hard surface, dry, level",
          throttle: "Full Open",
          pressureAltitudesFt: PRESSURE_ALTITUDES_FT.slice(),
          sourceTemperaturesF: TEMPERATURES_F.slice(),
          temperaturesC: TEMPERATURES_C.slice(),
          distanceM: {
            groundRoll: buildGroundRollTable(obstacleRowsFt, options.groundRollRatio),
            obstacle50ft: convertDistanceTable(obstacleRowsFt)
          },
          sourceDistanceFt: {
            groundRoll: groundRollRowsFt,
            obstacle50ft: obstacleRowsFt
          }
        }
      }
    };
  }

  function buildClimbSpeedMphIas() {
    return PRESSURE_ALTITUDES_FT.map((pressureAltitudeFt) => roundTo(74 - pressureAltitudeFt / 10000 * 6, 1));
  }

  function buildClimbVariant(options) {
    const climbSpeedMphIas = buildClimbSpeedMphIas();
    const climbSpeedVyKias = climbSpeedMphIas.map(mphToKias);
    const rateOfClimbFpm = options.rateOfClimbFpm.map((row) => row.slice());
    const isaReference = rateOfClimbFpm.map((row, index) => {
      const isaTemperatureF = getIsaTemperatureF(PRESSURE_ALTITUDES_FT[index]);
      return interpolateTemperatureSeries(TEMPERATURES_F, row, isaTemperatureF);
    });

    return {
      source: options.source,
      status: "draft-digitized-from-chart",
      notes: [
        "All climbs are with 0 deg flaps.",
        "Climb speed is best rate of climb.",
        "Smooth air, no wind.",
        "Distance values are approximate chart reads from the supplied raster images."
      ],
      propellerDiameterIn: options.propellerDiameterIn,
      flaps: "0 deg",
      maximumWeightLb: MAX_WEIGHT_LB,
      maximumWeightKg: MAX_WEIGHT_KG,
      powerSetting: "Full Open",
      speedLabel: "Vy",
      speedKey: "climbSpeedVyKias",
      pressureAltitudesFt: PRESSURE_ALTITUDES_FT.slice(),
      sourceTemperaturesF: TEMPERATURES_F.slice(),
      temperaturesC: TEMPERATURES_C.slice(),
      sourceClimbSpeedMphIas: climbSpeedMphIas,
      climbSpeedVyKias,
      sourceRateOfClimbFpm: rateOfClimbFpm.map((row) => row.slice()),
      weightsKg: {
        [String(MAX_WEIGHT_KG)]: {
          flaps: "0 deg",
          propellerDiameterIn: options.propellerDiameterIn,
          maximumWeightLb: MAX_WEIGHT_LB,
          pressureAltitudesFt: PRESSURE_ALTITUDES_FT.slice(),
          sourceTemperaturesF: TEMPERATURES_F.slice(),
          temperaturesC: TEMPERATURES_C.slice(),
          sourceClimbSpeedMphIas: climbSpeedMphIas,
          climbSpeedVyKias,
          isaReference: {
            rateOfClimbFpm: isaReference
          },
          rateOfClimbFpm
        }
      }
    };
  }

  function buildLandingVariant(options) {
    const obstacleRowsFt = options.obstacle50ftDistanceFt;
    const groundRollRowsFt = obstacleRowsFt.map((row) => row.map((valueFt) => Math.round(valueFt * options.groundRollRatio)));
    return {
      source: options.source,
      status: "draft-digitized-from-chart",
      notes: [
        "No wind.",
        "Hard surface runway, dry and level.",
        "Brakes apply heavily.",
        "Distance values are approximate chart reads from the supplied raster images."
      ],
      flaps: options.flaps,
      maximumWeightLb: MAX_WEIGHT_LB,
      maximumWeightKg: MAX_WEIGHT_KG,
      pressureAltitudesFt: PRESSURE_ALTITUDES_FT.slice(),
      sourceTemperaturesF: TEMPERATURES_F.slice(),
      temperaturesC: TEMPERATURES_C.slice(),
      groundRollRatio: options.groundRollRatio,
      sourceDistanceFt: {
        groundRoll: groundRollRowsFt,
        obstacle50ft: obstacleRowsFt
      },
      weightsKg: {
        [String(MAX_WEIGHT_KG)]: {
          flaps: options.flaps,
          shortFinalApproachSpeedKias: mphToKias(options.obstacle50ftSpeedMphIas),
          obstacle50ftSpeedMphIas: options.obstacle50ftSpeedMphIas,
          runway: "Hard surface, dry, level",
          throttle: "Idle",
          pressureAltitudesFt: PRESSURE_ALTITUDES_FT.slice(),
          sourceTemperaturesF: TEMPERATURES_F.slice(),
          temperaturesC: TEMPERATURES_C.slice(),
          distanceM: {
            groundRoll: buildGroundRollTable(obstacleRowsFt, options.groundRollRatio),
            obstacle50ft: convertDistanceTable(obstacleRowsFt)
          },
          sourceDistanceFt: {
            groundRoll: groundRollRowsFt,
            obstacle50ft: obstacleRowsFt
          }
        }
      }
    };
  }

  const flaps0Prop76 = buildTakeoffVariant({
    source: "A-1A Husky take-off distance chart, flaps 0 deg, 76 inch diameter propeller",
    propellerDiameterIn: 76,
    flaps: "0 deg",
    takeoffType: "Normal",
    groundRollRatio: 0.66,
    liftoffSpeedMphIasRange: [51, 56],
    obstacle50ftSpeedMphIas: 65,
    obstacle50ftDistanceFt: [
      [750, 775, 805, 830, 855, 880, 905, 930, 950],
      [800, 825, 850, 880, 910, 935, 960, 985, 1010],
      [850, 875, 905, 935, 965, 995, 1020, 1045, 1065],
      [890, 925, 955, 985, 1015, 1045, 1075, 1105, 1125],
      [940, 975, 1010, 1045, 1080, 1110, 1140, 1170, 1195],
      [990, 1025, 1065, 1100, 1135, 1165, 1195, 1220, 1240]
    ]
  });

  const flaps0Prop72 = buildTakeoffVariant({
    source: "A-1A Husky take-off distance chart, flaps 0 deg, 72 inch diameter propeller",
    propellerDiameterIn: 72,
    flaps: "0 deg",
    takeoffType: "Normal",
    groundRollRatio: 0.40,
    liftoffSpeedMphIasRange: [51, 56],
    obstacle50ftSpeedMphIas: 66,
    obstacle50ftDistanceFt: [
      [780, 815, 860, 910, 970, 1040, 1130, 1260, 1420],
      [850, 900, 960, 1030, 1110, 1210, 1330, 1470, 1620],
      [1000, 1060, 1140, 1230, 1340, 1480, 1640, 1810, 1980],
      [1100, 1180, 1280, 1400, 1540, 1700, 1900, 2140, 2380],
      [1320, 1460, 1600, 1760, 1940, 2140, 2370, 2600, 2730],
      [1640, 1810, 2000, 2200, 2430, 2660, 2920, 3180, 3400]
    ]
  });

  const flaps30Prop76 = buildTakeoffVariant({
    source: "A-1A Husky take-off distance chart, flaps 30 deg, 76 inch diameter propeller",
    propellerDiameterIn: 76,
    flaps: "30 deg",
    takeoffType: "Maximum Performance",
    groundRollRatio: 0.74,
    liftoffSpeedMphIasRange: [51, 56],
    obstacle50ftSpeedMphIas: 59,
    obstacle50ftDistanceFt: [
      [590, 610, 630, 650, 670, 690, 710, 730, 745],
      [620, 645, 665, 690, 710, 735, 755, 775, 790],
      [655, 680, 705, 730, 755, 780, 800, 820, 835],
      [695, 720, 745, 770, 795, 820, 845, 865, 880],
      [735, 760, 785, 815, 840, 865, 890, 915, 930],
      [770, 800, 825, 850, 880, 905, 930, 955, 975]
    ]
  });

  const flaps30Prop72 = buildTakeoffVariant({
    source: "A-1A Husky take-off distance chart, flaps 30 deg, 72 inch diameter propeller",
    propellerDiameterIn: 72,
    flaps: "30 deg",
    takeoffType: "Maximum Performance",
    groundRollRatio: 0.625,
    liftoffSpeedMphIasRange: [51, 56],
    obstacle50ftSpeedMphIas: 59,
    obstacle50ftDistanceFt: [
      [580, 600, 625, 650, 700, 735, 790, 840, 880],
      [670, 710, 760, 820, 900, 980, 1070, 1170, 1280],
      [800, 850, 920, 995, 1080, 1180, 1310, 1430, 1560],
      [880, 940, 1010, 1110, 1230, 1370, 1510, 1640, 1760],
      [950, 1040, 1120, 1210, 1320, 1440, 1580, 1720, 1880],
      [1050, 1110, 1190, 1300, 1430, 1560, 1720, 1880, 2000]
    ]
  });

  const climbFlaps0Prop76 = buildClimbVariant({
    source: "A-1A Husky climb performance chart, flaps 0 deg, 76 inch diameter propeller",
    propellerDiameterIn: 76,
    rateOfClimbFpm: [
      [1620, 1605, 1580, 1535, 1475, 1390, 1300, 1180, 1050],
      [1450, 1410, 1360, 1290, 1215, 1135, 1050, 970, 890],
      [1230, 1190, 1135, 1065, 990, 920, 850, 780, 720],
      [1020, 990, 950, 900, 840, 770, 700, 610, 520],
      [830, 800, 750, 700, 640, 570, 490, 410, 350],
      [630, 590, 550, 500, 450, 390, 320, 250, 180]
    ]
  });

  const climbFlaps0Prop72 = buildClimbVariant({
    source: "A-1A Husky climb performance chart, flaps 0 deg, 72 inch diameter propeller",
    propellerDiameterIn: 72,
    rateOfClimbFpm: [
      [1560, 1500, 1440, 1380, 1310, 1230, 1150, 1060, 980],
      [1360, 1290, 1230, 1160, 1090, 1020, 950, 890, 830],
      [1180, 1110, 1030, 960, 890, 810, 750, 700, 650],
      [980, 920, 860, 790, 720, 660, 600, 550, 510],
      [780, 730, 690, 640, 590, 540, 480, 420, 350],
      [580, 540, 500, 460, 410, 360, 300, 240, 200]
    ]
  });

  const landingFlaps0 = buildLandingVariant({
    source: "A-1A Husky landing distance chart, flaps 0 deg",
    flaps: "0 deg",
    groundRollRatio: 0.56,
    obstacle50ftSpeedMphIas: 66,
    obstacle50ftDistanceFt: [
      [1480, 1540, 1610, 1680, 1745, 1810, 1890, 1970, 2050],
      [1600, 1665, 1740, 1810, 1880, 1960, 2050, 2140, 2230],
      [1720, 1800, 1880, 1970, 2050, 2140, 2230, 2330, 2420],
      [1850, 1940, 2030, 2120, 2220, 2320, 2420, 2520, 2620],
      [2020, 2120, 2220, 2320, 2420, 2520, 2630, 2740, 2840],
      [2120, 2220, 2340, 2440, 2540, 2640, 2740, 2840, 2920]
    ]
  });

  const landingFlaps30 = buildLandingVariant({
    source: "A-1A Husky landing distance chart, flaps 30 deg",
    flaps: "30 deg",
    groundRollRatio: 0.61,
    obstacle50ftSpeedMphIas: 59,
    obstacle50ftDistanceFt: [
      [830, 860, 895, 940, 990, 1030, 1070, 1110, 1140],
      [900, 940, 990, 1040, 1090, 1140, 1180, 1210, 1240],
      [970, 1020, 1080, 1135, 1180, 1230, 1270, 1300, 1330],
      [1040, 1090, 1140, 1190, 1240, 1280, 1330, 1380, 1430],
      [1120, 1180, 1230, 1280, 1340, 1390, 1440, 1490, 1540],
      [1180, 1230, 1280, 1340, 1400, 1450, 1510, 1570, 1640]
    ]
  });

  window.HUSK_PERFORMANCE = {
    source: "A-1A Husky performance charts provided by user",
    status: "partial",
    defaultPropellerDiameterIn: 72,
    registrationOverrides: {},
    weightsKg: flaps0Prop72.weightsKg,
    takeoff: {
      source: "Take-off distance over 50 ft obstacle, maximum weight 1890 lb",
      defaultPropellerDiameterIn: 72,
      defaultVariant: "flaps0Prop72",
      defaultVariantByFlaps: {
        "0 deg": "flaps0Prop72",
        "30 deg": "flaps30Prop72"
      },
      variants: {
        flaps0Prop76,
        flaps0Prop72,
        flaps30Prop76,
        flaps30Prop72
      }
    },
    climb: {
      source: "Climb performance, flaps 0 deg, maximum weight 1890 lb",
      defaultPropellerDiameterIn: 72,
      defaultVariant: "flaps0Prop72",
      variants: {
        flaps0Prop76: climbFlaps0Prop76,
        flaps0Prop72: climbFlaps0Prop72
      },
      powerSetting: climbFlaps0Prop72.powerSetting,
      flaps: climbFlaps0Prop72.flaps,
      speedLabel: climbFlaps0Prop72.speedLabel,
      speedKey: climbFlaps0Prop72.speedKey,
      pressureAltitudesFt: climbFlaps0Prop72.pressureAltitudesFt.slice(),
      sourceTemperaturesF: climbFlaps0Prop72.sourceTemperaturesF.slice(),
      temperaturesC: climbFlaps0Prop72.temperaturesC.slice(),
      weightsKg: climbFlaps0Prop72.weightsKg
    },
    landing: {
      source: "Landing distance from 50 ft obstacle, maximum weight 1890 lb",
      defaultVariant: "flaps30",
      defaultVariantByFlaps: {
        "0 deg": "flaps0",
        "30 deg": "flaps30"
      },
      variants: {
        flaps0: landingFlaps0,
        flaps30: landingFlaps30
      },
      weightsKg: landingFlaps30.weightsKg
    },
    cruise: {
      source: "A-1A Husky best economy cruise data provided by user",
      status: "partial",
      airspeedBasis: "IAS",
      engineCount: 1,
      fuelConsumptionBasis: "Fuel consumption for one engine",
      isaDeltaC: [0],
      pressureAltitudesFt: [2000, 5000],
      defaultMode: "bestEconomy",
      settings: {
        bestEconomy: {
          rpm: 2350,
          mapInHg: 20,
          iasKt: 87,
          fuelFlowByAltitudeLph: {
            "2000": 28.3,
            "5000": 24.1
          },
          label: "Best economy"
        }
      },
      tables: {
        "2000": [
          { rpm: 2350, mapInHg: 20, values: [{ kias: 87, ktas: 87, fuelPerEngineLph: 28.3, fuelTotalLph: 28.3 }] }
        ],
        "5000": [
          { rpm: 2350, mapInHg: 20, values: [{ kias: 87, ktas: 87, fuelPerEngineLph: 24.1, fuelTotalLph: 24.1 }] }
        ]
      }
    }
  };
})();
