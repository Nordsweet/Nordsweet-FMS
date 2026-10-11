window.P2006T_PERFORMANCE = {
  source: "POH takeoff performance table",
  corrections: {
    headwind_percent_per_kt: -2.5,
    tailwind_percent_per_kt: 10,
    paved_runway_percent: -6,
    uphill_percent_per_slope_percent: 5
  },
  weightsKg: {
    "930": {
      flaps: "T/O",
      liftoffSpeedKias: 65,
      obstacle50ftSpeedKias: 70,
      throttle: "Full Forward",
      runway: "Grass",
      pressureAltitudesFt: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
      temperaturesC: [-25, 0, 25, 50],
      isaReference: {
        groundRollM: [146, 160, 175, 192, 212, 233, 256, 282, 312, 344, 380],
        obstacle50ftM: [190, 209, 229, 252, 277, 305, 335, 370, 408, 450, 498]
      },
      distanceM: {
        groundRoll: [
          [100, 127, 158, 194],
          [112, 142, 177, 216],
          [125, 159, 197, 242],
          [140, 177, 221, 270],
          [156, 198, 247, 302],
          [175, 222, 277, 338],
          [196, 249, 310, 379],
          [220, 280, 348, 426],
          [247, 314, 391, 478],
          [278, 353, 440, 538],
          [313, 397, 495, 605]
        ],
        obstacle50ft: [
          [131, 167, 207, 254],
          [146, 186, 231, 283],
          [163, 208, 258, 316],
          [183, 232, 289, 353],
          [204, 260, 323, 395],
          [229, 291, 362, 443],
          [257, 326, 406, 496],
          [288, 366, 455, 557],
          [323, 411, 512, 626],
          [364, 462, 575, 704],
          [409, 520, 648, 792]
        ]
      }
    },
    "1080": {
      flaps: "T/O",
      liftoffSpeedKias: 65,
      obstacle50ftSpeedKias: 70,
      throttle: "Full Forward",
      runway: "Grass",
      pressureAltitudesFt: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
      temperaturesC: [-25, 0, 25, 50],
      isaReference: {
        groundRollM: [215, 235, 258, 284, 312, 343, 378, 417, 460, 508, 561],
        obstacle50ftM: [281, 308, 338, 372, 409, 449, 495, 545, 602, 664, 734]
      },
      distanceM: {
        groundRoll: [
          [148, 188, 234, 286],
          [165, 210, 261, 319],
          [184, 234, 291, 356],
          [206, 262, 326, 398],
          [230, 293, 364, 446],
          [258, 328, 408, 499],
          [289, 368, 457, 559],
          [324, 412, 513, 628],
          [364, 463, 577, 705],
          [410, 521, 648, 793],
          [461, 586, 730, 893]
        ],
        obstacle50ft: [
          [193, 246, 306, 374],
          [216, 274, 341, 418],
          [241, 306, 381, 466],
          [269, 342, 426, 521],
          [301, 383, 477, 583],
          [338, 429, 534, 653],
          [378, 481, 599, 732],
          [425, 540, 672, 822],
          [477, 606, 755, 923],
          [536, 682, 849, 1038],
          [604, 767, 955, 1168]
        ]
      }
    },
    "1290": {
      flaps: "T/O",
      liftoffSpeedKias: 67,
      obstacle50ftSpeedKias: 72,
      throttle: "Full Forward",
      runway: "Grass",
      pressureAltitudesFt: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
      temperaturesC: [-25, 0, 25, 50],
      isaReference: {
        groundRollM: [313, 343, 377, 414, 455, 501, 551, 620, 697, 784, 883],
        obstacle50ftM: [417, 457, 502, 551, 606, 667, 734, 826, 929, 1045, 1177]
      },
      distanceM: {
        groundRoll: [
          [215, 274, 341, 417],
          [240, 306, 380, 465],
          [268, 341, 425, 520],
          [300, 382, 475, 581],
          [336, 427, 531, 650],
          [376, 478, 595, 728],
          [422, 536, 667, 816],
          [482, 613, 763, 934],
          [553, 703, 875, 1070],
          [633, 805, 1002, 1226],
          [726, 923, 1149, 1406]
        ],
        obstacle50ft: [
          [296, 377, 469, 574],
          [331, 420, 523, 640],
          [369, 470, 585, 715],
          [413, 525, 654, 799],
          [462, 587, 731, 894],
          [517, 658, 819, 1002],
          [580, 737, 918, 1123],
          [664, 844, 1051, 1285],
          [761, 967, 1203, 1472],
          [872, 1108, 1379, 1687],
          [999, 1271, 1582, 1934]
        ]
      }
    }
  },
  landing: {
    source: "POH landing performance table",
    corrections: {
      headwind_m_per_kt: -5,
      tailwind_m_per_kt: 11,
      hard_runway_percent: -2,
      slope_ground_roll_percent_per_slope_percent: -2.5
    },
    weightsKg: {
      "930": {
        flaps: "LAND",
        shortFinalApproachSpeedKias: 70,
        throttle: "Idle",
        runway: "Grass",
        pressureAltitudesFt: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
        temperaturesC: [-25, 0, 25, 50],
        isaReference: {
          groundRollM: [175, 180, 185, 191, 197, 203, 209, 215, 222, 229, 237],
          obstacle50ftM: [264, 270, 277, 291, 291, 299, 307, 315, 323, 331, 340]
        },
        distanceM: {
          groundRoll: [
            [150, 166, 181, 196],
            [156, 172, 187, 203],
            [162, 178, 194, 211],
            [168, 185, 202, 219],
            [174, 192, 209, 227],
            [181, 199, 217, 235],
            [188, 207, 226, 244],
            [195, 215, 234, 254],
            [203, 223, 243, 264],
            [210, 232, 253, 274],
            [219, 241, 263, 285]
          ],
          obstacle50ft: [
            [233, 252, 271, 290],
            [240, 260, 280, 299],
            [248, 268, 288, 309],
            [263, 285, 307, 328],
            [263, 285, 307, 328],
            [272, 294, 317, 339],
            [280, 304, 327, 350],
            [289, 313, 338, 361],
            [299, 324, 349, 373],
            [308, 334, 360, 386],
            [319, 346, 372, 399]
          ]
        }
      },
      "1080": {
        flaps: "LAND",
        shortFinalApproachSpeedKias: 70,
        throttle: "Idle",
        runway: "Grass",
        pressureAltitudesFt: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
        temperaturesC: [-25, 0, 25, 50],
        isaReference: {
          groundRollM: [203, 209, 215, 222, 228, 235, 243, 250, 258, 266, 275],
          obstacle50ftM: [306, 314, 322, 338, 338, 347, 356, 365, 375, 385, 395]
        },
        distanceM: {
          groundRoll: [
            [175, 192, 210, 227],
            [181, 199, 218, 236],
            [188, 207, 226, 245],
            [195, 215, 234, 254],
            [202, 223, 243, 263],
            [210, 231, 252, 273],
            [218, 240, 262, 284],
            [226, 249, 272, 295],
            [235, 259, 283, 306],
            [244, 269, 294, 318],
            [254, 280, 305, 331]
          ],
          obstacle50ft: [
            [271, 293, 315, 337],
            [279, 302, 325, 348],
            [288, 311, 335, 358],
            [306, 331, 356, 381],
            [306, 331, 356, 381],
            [315, 342, 368, 394],
            [325, 353, 380, 406],
            [336, 364, 392, 420],
            [347, 376, 405, 434],
            [358, 388, 418, 448],
            [370, 401, 432, 463]
          ]
        }
      },
      "1290": {
        flaps: "LAND",
        shortFinalApproachSpeedKias: 75,
        throttle: "Idle",
        runway: "Grass",
        pressureAltitudesFt: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
        temperaturesC: [-25, 0, 25, 50],
        isaReference: {
          groundRollM: [251, 258, 266, 274, 283, 291, 300, 310, 319, 329, 340],
          obstacle50ftM: [375, 384, 394, 404, 414, 425, 436, 447, 459, 471, 484]
        },
        distanceM: {
          groundRoll: [
            [216, 238, 260, 281],
            [224, 247, 269, 292],
            [232, 256, 279, 303],
            [241, 265, 290, 314],
            [250, 275, 301, 326],
            [260, 286, 312, 338],
            [270, 297, 324, 351],
            [280, 308, 337, 365],
            [291, 320, 350, 379],
            [302, 333, 363, 394],
            [314, 346, 378, 409]
          ],
          obstacle50ft: [
            [331, 359, 386, 413],
            [341, 370, 398, 426],
            [352, 381, 410, 439],
            [363, 393, 423, 453],
            [374, 405, 436, 467],
            [386, 418, 450, 482],
            [398, 432, 465, 498],
            [411, 446, 480, 514],
            [425, 460, 496, 531],
            [439, 476, 513, 549],
            [453, 492, 530, 568]
          ]
        }
      }
    }
  },
  climb: {
    source: "POH climb performance table",
    powerSetting: "Maximum Continuous Power",
    flaps: "Take-Off",
    landingGear: "Up",
    speedLabel: "Vy",
    speedKey: "climbSpeedVyKias",
    pressureAltitudesFt: [0, 2000, 4000, 6000, 8000, 10000, 12000, 14000],
    temperaturesC: [-25, 0, 25, 50],
    weightsKg: {
      "930": {
        climbSpeedVyKias: [85, 82, 79, 75, 72, 69, 65, 62],
        isaReference: {
          rateOfClimbFpm: [1451, 1315, 1180, 1045, 909, 774, 639, 503]
        },
        rateOfClimbFpm: [
          [1803, 1575, 1372, 1189],
          [1630, 1406, 1206, 1026],
          [1457, 1238, 1041, 864],
          [1286, 1070, 877, 703],
          [1114, 902, 713, 542],
          [944, 735, 549, 382],
          [774, 569, 387, 222],
          [604, 404, 224, 63]
        ]
      },
      "1080": {
        climbSpeedVyKias: [85, 82, 79, 76, 73, 69, 66, 63],
        isaReference: {
          rateOfClimbFpm: [1190, 1068, 946, 825, 703, 581, 459, 338]
        },
        rateOfClimbFpm: [
          [1507, 1302, 1119, 954],
          [1351, 1150, 970, 808],
          [1196, 998, 822, 662],
          [1041, 847, 674, 517],
          [887, 696, 526, 372],
          [734, 546, 379, 228],
          [581, 397, 232, 84],
          [428, 248, 86, -59]
        ]
      },
      "1290": {
        climbSpeedVyKias: [86, 83, 79, 76, 73, 70, 67, 64],
        isaReference: {
          rateOfClimbFpm: [916, 809, 702, 595, 488, 381, 274, 167]
        },
        rateOfClimbFpm: [
          [1194, 1014, 854, 709],
          [1057, 881, 723, 581],
          [921, 747, 592, 453],
          [785, 615, 462, 325],
          [650, 483, 333, 198],
          [515, 351, 204, 71],
          [381, 219, 75, -55],
          [247, 89, -53, -181]
        ]
      }
    }
  },
  climbFlapsUpVy: {
    source: "POH climb performance table - flaps up",
    powerSetting: "Maximum Continuous Power",
    flaps: "Up",
    landingGear: "Up",
    speedLabel: "Vy",
    speedKey: "climbSpeedVyKias",
    pressureAltitudesFt: [0, 2000, 4000, 6000, 8000, 10000, 12000, 14000],
    temperaturesC: [-25, 0, 25, 50],
    weightsKg: {
      "930": {
        climbSpeedVyKias: [82, 81, 79, 77, 75, 73, 71, 69],
        isaReference: {
          rateOfClimbFpm: [1527, 1393, 1260, 1127, 994, 861, 727, 594]
        },
        rateOfClimbFpm: [
          [1873, 1649, 1449, 1269],
          [1703, 1483, 1286, 1109],
          [1533, 1317, 1124, 950],
          [1364, 1151, 962, 791],
          [1196, 987, 800, 632],
          [1028, 823, 639, 474],
          [860, 659, 479, 317],
          [693, 496, 319, 160]
        ]
      },
      "1080": {
        climbSpeedVyKias: [83, 82, 80, 78, 76, 74, 72, 70],
        isaReference: {
          rateOfClimbFpm: [1251, 1132, 1014, 895, 776, 658, 539, 420]
        },
        rateOfClimbFpm: [
          [1560, 1360, 1182, 1022],
          [1408, 1212, 1037, 879],
          [1257, 1064, 892, 737],
          [1106, 917, 748, 595],
          [956, 770, 604, 454],
          [807, 624, 461, 314],
          [657, 478, 318, 173],
          [509, 333, 175, 34]
        ]
      },
      "1290": {
        climbSpeedVyKias: [84, 83, 81, 81, 79, 79, 77, 75],
        isaReference: {
          rateOfClimbFpm: [961, 857, 753, 649, 546, 442, 338, 234]
        },
        rateOfClimbFpm: [
          [1231, 1057, 901, 760],
          [1098, 927, 774, 635],
          [966, 798, 647, 511],
          [834, 669, 521, 387],
          [703, 540, 395, 264],
          [572, 412, 269, 140],
          [441, 284, 144, 18],
          [311, 157, 20, -104]
        ]
      }
    }
  },
  climbFlapsUpVx: {
    source: "POH enroute rate of climb at Vx table - flaps up",
    powerSetting: "Maximum Continuous Power",
    flaps: "Up",
    landingGear: "Up",
    speedLabel: "Vx",
    speedKey: "climbSpeedVxKias",
    pressureAltitudesFt: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000],
    temperaturesC: [-25, 0, 25, 50],
    weightsKg: {
      "930": {
        climbSpeedVxKias: [72, 72, 71, 71, 71, 71, 71, 70],
        isaReference: {
          rateOfClimbFpm: [1463, 1401, 1339, 1277, 1215, 1153, 1090, 1028]
        },
        rateOfClimbFpm: [
          [1787, 1578, 1391, 1223],
          [1707, 1500, 1315, 1148],
          [1628, 1422, 1239, 1074],
          [1549, 1345, 1163, 999],
          [1470, 1268, 1087, 925],
          [1391, 1190, 1012, 851],
          [1312, 1113, 936, 777],
          [1233, 1036, 861, 703]
        ]
      },
      "1080": {
        climbSpeedVxKias: [72, 72, 72, 72, 71, 71, 71, 71],
        isaReference: {
          rateOfClimbFpm: [1194, 1139, 1084, 1029, 973, 918, 863, 808]
        },
        rateOfClimbFpm: [
          [1480, 1295, 1130, 981],
          [1410, 1226, 1062, 915],
          [1340, 1158, 995, 848],
          [1269, 1089, 928, 782],
          [1199, 1020, 861, 717],
          [1129, 952, 794, 651],
          [1059, 884, 727, 585],
          [990, 815, 660, 520]
        ]
      },
      "1290": {
        climbSpeedVxKias: [72, 72, 72, 72, 72, 72, 71, 71],
        isaReference: {
          rateOfClimbFpm: [906, 858, 810, 762, 714, 666, 618, 570]
        },
        rateOfClimbFpm: [
          [1157, 995, 850, 720],
          [1095, 935, 792, 663],
          [1034, 875, 733, 605],
          [972, 815, 674, 547],
          [911, 755, 615, 490],
          [850, 695, 557, 432],
          [789, 635, 498, 375],
          [728, 576, 440, 318]
        ]
      }
    }
  },
  climbOneEngineInopVy: {
    source: "POH one-engine rate of climb at Vyse table",
    powerSetting: "Maximum Continuous Power (operative engine)",
    flaps: "Up",
    landingGear: "Up",
    engineMode: "One engine INOP",
    speedLabel: "Vyse",
    speedKey: "climbSpeedVyseKias",
    pressureAltitudesFt: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000],
    temperaturesC: [-25, 0, 25, 50],
    weightsKg: {
      "930": {
        climbSpeedVyseKias: [79, 79, 79, 78, 78, 78, 78, 77],
        isaReference: {
          rateOfClimbFpm: [390, 355, 319, 284, 248, 213, 178, 142]
        },
        rateOfClimbFpm: [
          [574, 455, 349, 253],
          [529, 411, 305, 211],
          [483, 367, 262, 168],
          [438, 322, 219, 126],
          [393, 278, 176, 83],
          [348, 235, 133, 41],
          [304, 191, 90, -1],
          [259, 147, 47, -43]
        ]
      },
      "1080": {
        climbSpeedVyseKias: [80, 80, 79, 79, 79, 79, 78, 78],
        isaReference: {
          rateOfClimbFpm: [271, 240, 208, 176, 145, 113, 81, 50]
        },
        rateOfClimbFpm: [
          [436, 330, 235, 149],
          [396, 290, 196, 111],
          [355, 251, 157, 73],
          [315, 211, 118, 35],
          [275, 172, 80, -3],
          [234, 132, 41, -41],
          [194, 93, 3, -78],
          [154, 54, -35, -116]
        ]
      },
      "1290": {
        climbSpeedVyseKias: [84, 83, 82, 81, 80, 79, 79, 78],
        isaReference: {
          rateOfClimbFpm: [145, 116, 88, 60, 31, 3, -26, -54]
        },
        rateOfClimbFpm: [
          [293, 197, 112, 35],
          [257, 162, 77, 1],
          [220, 126, 42, -34],
          [184, 91, 7, -68],
          [148, 55, -27, -102],
          [112, 20, -62, -136],
          [75, -15, -97, -170],
          [39, -51, -131, -204]
        ]
      }
    }
  },
  climbOneEngineInopVx: {
    source: "POH one-engine rate of climb at Vxse table",
    powerSetting: "Maximum Continuous Power (operative engine)",
    flaps: "Up",
    landingGear: "Up",
    engineMode: "One engine INOP",
    speedLabel: "Vxse",
    speedKey: "climbSpeedVxseKias",
    pressureAltitudesFt: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000],
    temperaturesC: [-25, 0, 25, 50],
    weightsKg: {
      "930": {
        climbSpeedVxseKias: [78, 78, 78, 78, 78, 78, 77, 77],
        isaReference: {
          rateOfClimbFpm: [380, 346, 312, 279, 245, 211, 177, 143]
        },
        rateOfClimbFpm: [
          [556, 442, 341, 249],
          [513, 400, 299, 209],
          [469, 358, 258, 168],
          [426, 316, 217, 128],
          [383, 274, 176, 87],
          [340, 232, 134, 47],
          [298, 190, 93, 7],
          [255, 148, 52, -34]
        ]
      },
      "1080": {
        climbSpeedVxseKias: [79, 79, 79, 79, 78, 78, 78, 78],
        isaReference: {
          rateOfClimbFpm: [265, 234, 204, 173, 143, 112, 81, 51]
        },
        rateOfClimbFpm: [
          [424, 321, 229, 147],
          [385, 283, 192, 110],
          [346, 245, 155, 73],
          [307, 207, 117, 37],
          [268, 169, 80, 0],
          [229, 131, 43, -36],
          [190, 93, 6, -73],
          [152, 55, -31, -109]
        ]
      },
      "1290": {
        climbSpeedVxseKias: [83, 82, 81, 81, 80, 79, 78, 77],
        isaReference: {
          rateOfClimbFpm: [139, 111, 83, 55, 27, -1, -29, -57]
        },
        rateOfClimbFpm: [
          [285, 191, 107, 31],
          [249, 156, 72, -3],
          [213, 121, 38, -36],
          [178, 86, 4, -70],
          [142, 51, -30, -103],
          [106, 16, -64, -137],
          [71, -18, -98, -170],
          [35, -53, -132, -203]
        ]
      }
    }
  },
  climbVx: {
    source: "POH take-off rate of climb at Vx table",
    powerSetting: "Maximum Continuous Power",
    flaps: "Take-Off",
    landingGear: "Up",
    speedLabel: "Vx",
    speedKey: "climbSpeedVxKias",
    pressureAltitudesFt: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000],
    temperaturesC: [-25, 0, 25, 50],
    weightsKg: {
      "930": {
        climbSpeedVxKias: [78, 76, 75, 74, 73, 72, 71, 69],
        isaReference: {
          rateOfClimbFpm: [1138, 1081, 1024, 967, 910, 853, 796, 739]
        },
        rateOfClimbFpm: [
          [1435, 1243, 1072, 918],
          [1362, 1172, 1002, 849],
          [1289, 1101, 932, 780],
          [1216, 1030, 863, 712],
          [1144, 958, 793, 644],
          [1071, 888, 724, 576],
          [999, 817, 654, 508],
          [927, 746, 585, 440]
        ]
      },
      "1080": {
        climbSpeedVxKias: [78, 76, 75, 74, 73, 72, 71, 70],
        isaReference: {
          rateOfClimbFpm: [1002, 949, 895, 841, 787, 733, 679, 625]
        },
        rateOfClimbFpm: [
          [1283, 1102, 940, 794],
          [1214, 1034, 874, 729],
          [1145, 967, 808, 664],
          [1076, 900, 742, 600],
          [1008, 833, 676, 535],
          [939, 766, 611, 471],
          [871, 699, 545, 407],
          [803, 632, 480, 342]
        ]
      },
      "1290": {
        climbSpeedVxKias: [78, 76, 75, 74, 73, 72, 71, 70],
        isaReference: {
          rateOfClimbFpm: [870, 820, 770, 719, 669, 619, 569, 518]
        },
        rateOfClimbFpm: [
          [1132, 963, 812, 676],
          [1067, 900, 750, 615],
          [1003, 837, 689, 555],
          [939, 774, 627, 495],
          [875, 712, 566, 435],
          [811, 649, 505, 375],
          [748, 587, 444, 315],
          [684, 525, 383, 255]
        ]
      }
    }
  },
  cruise: {
    source: "POH cruise performance tables",
    weightKg: 1150,
    powerSetting: "Cruise",
    fuelConsumptionBasis: "Fuel consumption for each engine",
    pressureAltitudesFt: [0, 3000, 6000, 9000, 12000],
    isaDeltaC: [-30, 0, 30],
    tables: {
      "0": [
        { rpm: 2250, mapInHg: 29.5, values: [{ pwrPct: 103, ktas: 143, fuelPerEngineLph: 28.6 }, { pwrPct: 97, ktas: 145, fuelPerEngineLph: 27.1 }, { pwrPct: 92, ktas: 146, fuelPerEngineLph: 25.8 }] },
        { rpm: 2250, mapInHg: 28, values: [{ pwrPct: 88, ktas: 134, fuelPerEngineLph: 24.5 }, { pwrPct: 83, ktas: 136, fuelPerEngineLph: 23.2 }, { pwrPct: 79, ktas: 138, fuelPerEngineLph: 22 }] },
        { rpm: 2250, mapInHg: 26, values: [{ pwrPct: 69, ktas: 122, fuelPerEngineLph: 19.2 }, { pwrPct: 65, ktas: 124, fuelPerEngineLph: 18.2 }, { pwrPct: 62, ktas: 125, fuelPerEngineLph: 17.3 }] },
        { rpm: 2250, mapInHg: 24, values: [{ pwrPct: 59, ktas: 115, fuelPerEngineLph: 16.6 }, { pwrPct: 56, ktas: 116, fuelPerEngineLph: 15.7 }, { pwrPct: 53, ktas: 117, fuelPerEngineLph: 14.9 }] },
        { rpm: 2250, mapInHg: 22, values: [{ pwrPct: 46, ktas: 103, fuelPerEngineLph: 12.8 }, { pwrPct: 43, ktas: 103, fuelPerEngineLph: 12.1 }, { pwrPct: 41, ktas: 103, fuelPerEngineLph: 11.5 }] },
        { rpm: 2250, mapInHg: 20, values: [{ pwrPct: 39, ktas: 96, fuelPerEngineLph: 11 }, { pwrPct: 37, ktas: 95, fuelPerEngineLph: 10.4 }, { pwrPct: 35, ktas: 94, fuelPerEngineLph: 9.9 }] },
        { rpm: 2100, mapInHg: 28, values: [{ pwrPct: 84, ktas: 132, fuelPerEngineLph: 23.5 }, { pwrPct: 80, ktas: 134, fuelPerEngineLph: 22.2 }, { pwrPct: 76, ktas: 135, fuelPerEngineLph: 21.1 }] },
        { rpm: 2100, mapInHg: 26, values: [{ pwrPct: 66, ktas: 121, fuelPerEngineLph: 18.5 }, { pwrPct: 63, ktas: 122, fuelPerEngineLph: 17.5 }, { pwrPct: 60, ktas: 123, fuelPerEngineLph: 16.7 }] },
        { rpm: 2100, mapInHg: 24, values: [{ pwrPct: 57, ktas: 114, fuelPerEngineLph: 16 }, { pwrPct: 54, ktas: 114, fuelPerEngineLph: 15.1 }, { pwrPct: 52, ktas: 115, fuelPerEngineLph: 14.4 }] },
        { rpm: 2100, mapInHg: 22, values: [{ pwrPct: 43, ktas: 100, fuelPerEngineLph: 12.1 }, { pwrPct: 41, ktas: 100, fuelPerEngineLph: 11.5 }, { pwrPct: 39, ktas: 100, fuelPerEngineLph: 10.9 }] },
        { rpm: 2100, mapInHg: 20, values: [{ pwrPct: 37, ktas: 92, fuelPerEngineLph: 10.2 }, { pwrPct: 35, ktas: 91, fuelPerEngineLph: 9.7 }, { pwrPct: 33, ktas: 89, fuelPerEngineLph: 9.2 }] },
        { rpm: 1900, mapInHg: 26, values: [{ pwrPct: 61, ktas: 117, fuelPerEngineLph: 17.1 }, { pwrPct: 58, ktas: 118, fuelPerEngineLph: 16.2 }, { pwrPct: 55, ktas: 119, fuelPerEngineLph: 15.4 }] },
        { rpm: 1900, mapInHg: 24, values: [{ pwrPct: 53, ktas: 110, fuelPerEngineLph: 14.9 }, { pwrPct: 50, ktas: 111, fuelPerEngineLph: 14.1 }, { pwrPct: 48, ktas: 111, fuelPerEngineLph: 13.4 }] },
        { rpm: 1900, mapInHg: 22, values: [{ pwrPct: 41, ktas: 97, fuelPerEngineLph: 11.4 }, { pwrPct: 39, ktas: 97, fuelPerEngineLph: 10.8 }, { pwrPct: 37, ktas: 96, fuelPerEngineLph: 10.2 }] },
        { rpm: 1900, mapInHg: 20, values: [{ pwrPct: 35, ktas: 89, fuelPerEngineLph: 9.6 }, { pwrPct: 33, ktas: 88, fuelPerEngineLph: 9.1 }, { pwrPct: 31, ktas: 85, fuelPerEngineLph: 8.7 }] }
      ],
      "3000": [
        { rpm: 2388, mapInHg: 26.4, values: [{ pwrPct: 92, ktas: 141, fuelPerEngineLph: 25.7 }, { pwrPct: 87, ktas: 143, fuelPerEngineLph: 24.3 }, { pwrPct: 83, ktas: 144, fuelPerEngineLph: 23.1 }] },
        { rpm: 2250, mapInHg: 26.4, values: [{ pwrPct: 89, ktas: 139, fuelPerEngineLph: 25 }, { pwrPct: 85, ktas: 141, fuelPerEngineLph: 23.6 }, { pwrPct: 80, ktas: 143, fuelPerEngineLph: 22.4 }] },
        { rpm: 2250, mapInHg: 26, values: [{ pwrPct: 85, ktas: 137, fuelPerEngineLph: 23.9 }, { pwrPct: 81, ktas: 138, fuelPerEngineLph: 22.6 }, { pwrPct: 77, ktas: 140, fuelPerEngineLph: 21.5 }] },
        { rpm: 2250, mapInHg: 24, values: [{ pwrPct: 72, ktas: 128, fuelPerEngineLph: 20 }, { pwrPct: 68, ktas: 129, fuelPerEngineLph: 18.9 }, { pwrPct: 64, ktas: 130, fuelPerEngineLph: 18 }] },
        { rpm: 2250, mapInHg: 22, values: [{ pwrPct: 57, ktas: 116, fuelPerEngineLph: 16 }, { pwrPct: 54, ktas: 117, fuelPerEngineLph: 15.1 }, { pwrPct: 51, ktas: 118, fuelPerEngineLph: 14.3 }] },
        { rpm: 2250, mapInHg: 20, values: [{ pwrPct: 48, ktas: 108, fuelPerEngineLph: 13.4 }, { pwrPct: 45, ktas: 108, fuelPerEngineLph: 12.7 }, { pwrPct: 43, ktas: 108, fuelPerEngineLph: 12.1 }] },
        { rpm: 2100, mapInHg: 26.4, values: [{ pwrPct: 85, ktas: 137, fuelPerEngineLph: 23.9 }, { pwrPct: 81, ktas: 138, fuelPerEngineLph: 22.6 }, { pwrPct: 77, ktas: 140, fuelPerEngineLph: 21.4 }] },
        { rpm: 2100, mapInHg: 26, values: [{ pwrPct: 82, ktas: 134, fuelPerEngineLph: 22.8 }, { pwrPct: 77, ktas: 136, fuelPerEngineLph: 21.6 }, { pwrPct: 73, ktas: 137, fuelPerEngineLph: 20.5 }] },
        { rpm: 2100, mapInHg: 24, values: [{ pwrPct: 69, ktas: 125, fuelPerEngineLph: 19.2 }, { pwrPct: 65, ktas: 127, fuelPerEngineLph: 18.1 }, { pwrPct: 62, ktas: 128, fuelPerEngineLph: 17.2 }] },
        { rpm: 2100, mapInHg: 22, values: [{ pwrPct: 54, ktas: 114, fuelPerEngineLph: 15.2 }, { pwrPct: 51, ktas: 114, fuelPerEngineLph: 14.3 }, { pwrPct: 49, ktas: 115, fuelPerEngineLph: 13.6 }] },
        { rpm: 2100, mapInHg: 20, values: [{ pwrPct: 45, ktas: 104, fuelPerEngineLph: 12.6 }, { pwrPct: 43, ktas: 104, fuelPerEngineLph: 11.9 }, { pwrPct: 41, ktas: 104, fuelPerEngineLph: 11.3 }] },
        { rpm: 1900, mapInHg: 26.4, values: [{ pwrPct: 78, ktas: 132, fuelPerEngineLph: 21.9 }, { pwrPct: 74, ktas: 134, fuelPerEngineLph: 20.7 }, { pwrPct: 70, ktas: 135, fuelPerEngineLph: 19.6 }] },
        { rpm: 1900, mapInHg: 26, values: [{ pwrPct: 75, ktas: 130, fuelPerEngineLph: 20.9 }, { pwrPct: 71, ktas: 131, fuelPerEngineLph: 19.8 }, { pwrPct: 67, ktas: 132, fuelPerEngineLph: 18.8 }] },
        { rpm: 1900, mapInHg: 24, values: [{ pwrPct: 63, ktas: 121, fuelPerEngineLph: 17.7 }, { pwrPct: 60, ktas: 122, fuelPerEngineLph: 16.7 }, { pwrPct: 57, ktas: 123, fuelPerEngineLph: 15.9 }] },
        { rpm: 1900, mapInHg: 22, values: [{ pwrPct: 50, ktas: 110, fuelPerEngineLph: 14.1 }, { pwrPct: 48, ktas: 110, fuelPerEngineLph: 13.3 }, { pwrPct: 45, ktas: 110, fuelPerEngineLph: 12.6 }] },
        { rpm: 1900, mapInHg: 20, values: [{ pwrPct: 42, ktas: 101, fuelPerEngineLph: 11.7 }, { pwrPct: 40, ktas: 101, fuelPerEngineLph: 11.1 }, { pwrPct: 38, ktas: 100, fuelPerEngineLph: 10.6 }] }
      ],
      "6000": [
        { rpm: 2388, mapInHg: 23.6, values: [{ pwrPct: 83, ktas: 139, fuelPerEngineLph: 23.3 }, { pwrPct: 79, ktas: 141, fuelPerEngineLph: 22 }, { pwrPct: 75, ktas: 142, fuelPerEngineLph: 20.9 }] },
        { rpm: 2250, mapInHg: 23.6, values: [{ pwrPct: 81, ktas: 138, fuelPerEngineLph: 22.6 }, { pwrPct: 76, ktas: 139, fuelPerEngineLph: 21.4 }, { pwrPct: 73, ktas: 141, fuelPerEngineLph: 20.3 }] },
        { rpm: 2250, mapInHg: 22, values: [{ pwrPct: 68, ktas: 129, fuelPerEngineLph: 19.1 }, { pwrPct: 65, ktas: 130, fuelPerEngineLph: 18.1 }, { pwrPct: 61, ktas: 131, fuelPerEngineLph: 17.2 }] },
        { rpm: 2250, mapInHg: 20, values: [{ pwrPct: 57, ktas: 119, fuelPerEngineLph: 15.8 }, { pwrPct: 54, ktas: 120, fuelPerEngineLph: 14.9 }, { pwrPct: 51, ktas: 120, fuelPerEngineLph: 14.2 }] },
        { rpm: 2250, mapInHg: 18, values: [{ pwrPct: 46, ktas: 108, fuelPerEngineLph: 12.9 }, { pwrPct: 44, ktas: 108, fuelPerEngineLph: 12.2 }, { pwrPct: 41, ktas: 107, fuelPerEngineLph: 11.6 }] },
        { rpm: 2100, mapInHg: 23.6, values: [{ pwrPct: 77, ktas: 135, fuelPerEngineLph: 21.6 }, { pwrPct: 73, ktas: 137, fuelPerEngineLph: 20.4 }, { pwrPct: 69, ktas: 138, fuelPerEngineLph: 19.4 }] },
        { rpm: 2100, mapInHg: 22, values: [{ pwrPct: 65, ktas: 126, fuelPerEngineLph: 18.2 }, { pwrPct: 62, ktas: 127, fuelPerEngineLph: 17.2 }, { pwrPct: 59, ktas: 128, fuelPerEngineLph: 16.4 }] },
        { rpm: 2100, mapInHg: 20, values: [{ pwrPct: 54, ktas: 116, fuelPerEngineLph: 15 }, { pwrPct: 51, ktas: 116, fuelPerEngineLph: 14.1 }, { pwrPct: 48, ktas: 117, fuelPerEngineLph: 13.4 }] },
        { rpm: 2100, mapInHg: 18, values: [{ pwrPct: 44, ktas: 106, fuelPerEngineLph: 12.4 }, { pwrPct: 42, ktas: 106, fuelPerEngineLph: 11.7 }, { pwrPct: 40, ktas: 105, fuelPerEngineLph: 11.1 }] },
        { rpm: 1900, mapInHg: 23.6, values: [{ pwrPct: 71, ktas: 130, fuelPerEngineLph: 19.8 }, { pwrPct: 67, ktas: 132, fuelPerEngineLph: 18.7 }, { pwrPct: 64, ktas: 133, fuelPerEngineLph: 17.8 }] },
        { rpm: 1900, mapInHg: 22, values: [{ pwrPct: 60, ktas: 122, fuelPerEngineLph: 16.8 }, { pwrPct: 57, ktas: 123, fuelPerEngineLph: 15.8 }, { pwrPct: 54, ktas: 123, fuelPerEngineLph: 15 }] },
        { rpm: 1900, mapInHg: 20, values: [{ pwrPct: 50, ktas: 112, fuelPerEngineLph: 13.9 }, { pwrPct: 47, ktas: 112, fuelPerEngineLph: 13.1 }, { pwrPct: 44, ktas: 112, fuelPerEngineLph: 12.4 }] },
        { rpm: 1900, mapInHg: 18, values: [{ pwrPct: 41, ktas: 102, fuelPerEngineLph: 11.6 }, { pwrPct: 39, ktas: 102, fuelPerEngineLph: 10.9 }, { pwrPct: 37, ktas: 100, fuelPerEngineLph: 10.4 }] }
      ],
      "9000": [
        { rpm: 2388, mapInHg: 21.1, values: [{ pwrPct: 75, ktas: 137, fuelPerEngineLph: 21.5 }, { pwrPct: 71, ktas: 139, fuelPerEngineLph: 20.3 }, { pwrPct: 67, ktas: 140, fuelPerEngineLph: 18.7 }] },
        { rpm: 2250, mapInHg: 21.1, values: [{ pwrPct: 73, ktas: 136, fuelPerEngineLph: 20.3 }, { pwrPct: 69, ktas: 137, fuelPerEngineLph: 19.2 }, { pwrPct: 65, ktas: 138, fuelPerEngineLph: 18.2 }] },
        { rpm: 2250, mapInHg: 20, values: [{ pwrPct: 65, ktas: 130, fuelPerEngineLph: 18.3 }, { pwrPct: 62, ktas: 131, fuelPerEngineLph: 17.2 }, { pwrPct: 58, ktas: 131, fuelPerEngineLph: 16.3 }] },
        { rpm: 2250, mapInHg: 18, values: [{ pwrPct: 53, ktas: 118, fuelPerEngineLph: 14.9 }, { pwrPct: 50, ktas: 119, fuelPerEngineLph: 14 }, { pwrPct: 48, ktas: 118, fuelPerEngineLph: 13.3 }] },
        { rpm: 2100, mapInHg: 21.1, values: [{ pwrPct: 69, ktas: 133, fuelPerEngineLph: 19.4 }, { pwrPct: 65, ktas: 134, fuelPerEngineLph: 18.3 }, { pwrPct: 62, ktas: 135, fuelPerEngineLph: 17.4 }] },
        { rpm: 2100, mapInHg: 20, values: [{ pwrPct: 62, ktas: 127, fuelPerEngineLph: 17.4 }, { pwrPct: 59, ktas: 128, fuelPerEngineLph: 16.4 }, { pwrPct: 56, ktas: 128, fuelPerEngineLph: 15.6 }] },
        { rpm: 2100, mapInHg: 18, values: [{ pwrPct: 51, ktas: 116, fuelPerEngineLph: 14.2 }, { pwrPct: 48, ktas: 116, fuelPerEngineLph: 13.4 }, { pwrPct: 46, ktas: 116, fuelPerEngineLph: 12.7 }] },
        { rpm: 1900, mapInHg: 21.1, values: [{ pwrPct: 64, ktas: 128, fuelPerEngineLph: 17.8 }, { pwrPct: 60, ktas: 129, fuelPerEngineLph: 16.8 }, { pwrPct: 57, ktas: 130, fuelPerEngineLph: 15.9 }] },
        { rpm: 1900, mapInHg: 20, values: [{ pwrPct: 57, ktas: 122, fuelPerEngineLph: 16 }, { pwrPct: 54, ktas: 123, fuelPerEngineLph: 15.1 }, { pwrPct: 51, ktas: 123, fuelPerEngineLph: 14.3 }] },
        { rpm: 1900, mapInHg: 18, values: [{ pwrPct: 47, ktas: 112, fuelPerEngineLph: 13.2 }, { pwrPct: 44, ktas: 112, fuelPerEngineLph: 12.4 }, { pwrPct: 42, ktas: 111, fuelPerEngineLph: 11.8 }] }
      ],
      "12000": [
        { rpm: 2388, mapInHg: 18.8, values: [{ pwrPct: 67, ktas: 135, fuelPerEngineLph: 18.8 }, { pwrPct: 63, ktas: 136, fuelPerEngineLph: 17.7 }, { pwrPct: 60, ktas: 136, fuelPerEngineLph: 16.7 }] },
        { rpm: 2250, mapInHg: 18.8, values: [{ pwrPct: 65, ktas: 133, fuelPerEngineLph: 18.2 }, { pwrPct: 61, ktas: 134, fuelPerEngineLph: 17.2 }, { pwrPct: 58, ktas: 134, fuelPerEngineLph: 16.3 }] },
        { rpm: 2250, mapInHg: 18, values: [{ pwrPct: 60, ktas: 129, fuelPerEngineLph: 16.8 }, { pwrPct: 57, ktas: 129, fuelPerEngineLph: 15.9 }, { pwrPct: 54, ktas: 129, fuelPerEngineLph: 15 }] },
        { rpm: 2100, mapInHg: 18.8, values: [{ pwrPct: 62, ktas: 130, fuelPerEngineLph: 17.4 }, { pwrPct: 59, ktas: 131, fuelPerEngineLph: 16.4 }, { pwrPct: 56, ktas: 132, fuelPerEngineLph: 15.5 }] },
        { rpm: 2100, mapInHg: 18, values: [{ pwrPct: 58, ktas: 126, fuelPerEngineLph: 16.1 }, { pwrPct: 54, ktas: 126, fuelPerEngineLph: 15.2 }, { pwrPct: 51, ktas: 126, fuelPerEngineLph: 14.4 }] },
        { rpm: 1900, mapInHg: 18.8, values: [{ pwrPct: 57, ktas: 125, fuelPerEngineLph: 15.9 }, { pwrPct: 54, ktas: 126, fuelPerEngineLph: 15 }, { pwrPct: 51, ktas: 126, fuelPerEngineLph: 14.2 }] },
        { rpm: 1900, mapInHg: 18, values: [{ pwrPct: 53, ktas: 121, fuelPerEngineLph: 14.8 }, { pwrPct: 50, ktas: 121, fuelPerEngineLph: 13.9 }, { pwrPct: 47, ktas: 121, fuelPerEngineLph: 13.2 }] }
      ]
    }
  }
};
