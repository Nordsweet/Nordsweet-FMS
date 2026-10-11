window.NORDSWEET_AIRCRAFT_DATA.register({
  checklists: [
    {
      "id": "cl-mp4eg78b-tjih58",
      "name": "Before Starting Engine",
      "phase": "taxiout",
      "sections": [
        {
          "id": "sec-mp4eg78b-916uh8",
          "title": "Before Starting Engine",
          "items": [
            {
              "action": "Start Circut",
              "expected": "OUT"
            },
            {
              "action": "Preflight check",
              "expected": "COMPLETE"
            },
            {
              "action": "Parking brake",
              "expected": "SET"
            },
            {
              "action": "Flight controls",
              "expected": "CHECK"
            },
            {
              "action": "Seats, seatbelts",
              "expected": "ADJUST"
            },
            {
              "action": "Throttle friction",
              "expected": "SET"
            },
            {
              "action": "Master",
              "expected": "ON"
            },
            {
              "action": "Hoobs",
              "expected": "COPY"
            },
            {
              "action": "Nav light",
              "expected": "ON"
            },
            {
              "action": "Avionic master",
              "expected": "ON"
            },
            {
              "action": "ATIS information",
              "expected": "CHECK"
            },
            {
              "action": "Startup clearance",
              "expected": "OBTAIN"
            },
            {
              "action": "Avionic master",
              "expected": "OFF"
            }
          ]
        }
      ]
    },
    {
      "id": "cl-mp4eg78b-uzzkap",
      "name": "Starting Engine",
      "phase": "taxiout",
      "sections": [
        {
          "id": "sec-mp4eg78b-7cblfm",
          "title": "Starting Engine",
          "items": [
            {
              "action": "Strobes",
              "expected": "ON"
            },
            {
              "action": "Fuel valve",
              "expected": "FULLER TANK"
            },
            {
              "action": "Throttle",
              "expected": "IDLE"
            },
            {
              "action": "Choke",
              "expected": "AS REQUIRED"
            },
            {
              "action": "Fuel pump",
              "expected": "ON"
            },
            {
              "action": "Fuel pressure",
              "expected": "CHECK"
            },
            {
              "action": "Propeller area",
              "expected": "CLEAR"
            },
            {
              "action": "START circuit",
              "expected": "IN"
            },
            {
              "action": "Ignition (key inside)",
              "expected": "START"
            },
            {
              "action": "Generator",
              "expected": "ON"
            },
            {
              "action": "Ammeter",
              "expected": "CHECK"
            },
            {
              "action": "Oil pressure (10s)",
              "expected": "CHECK"
            },
            {
              "action": "Engine instruments",
              "expected": "CHECK"
            },
            {
              "action": "Choke (if on)",
              "expected": "OFF"
            },
            {
              "action": "Power RPM",
              "expected": "1000"
            },
            {
              "action": "Fuel pump",
              "expected": "OFF"
            },
            {
              "action": "Fuel pressure",
              "expected": "CHECK"
            },
            {
              "action": "Circuit breakers",
              "expected": "ALL IN"
            },
            {
              "action": "Strobes",
              "expected": "OFF"
            }
          ]
        }
      ]
    },
    {
      "id": "cl-mp4eg78b-egvzhl",
      "name": "Before Taxi",
      "phase": "taxiout",
      "sections": [
        {
          "id": "sec-mp4eg78b-4v0yvn",
          "title": "Before Taxi",
          "items": [
            {
              "action": "Avionics master",
              "expected": "ON"
            },
            {
              "action": "Baro (on PDF & stb)",
              "expected": "SET BOTH"
            },
            {
              "action": "Transponder code",
              "expected": "SET, STB"
            },
            {
              "action": "AHRS, NAV, COMM",
              "expected": "READY & SET"
            },
            {
              "action": "Taxi clearance ",
              "expected": "OBTAIN"
            },
            {
              "action": "Chronometer (UTC)",
              "expected": "COPY"
            },
            {
              "action": "Taxi lights",
              "expected": "ON"
            },
            {
              "action": "Brakes (when taxi)",
              "expected": "CHECK"
            }
          ]
        }
      ]
    },
    {
      "id": "cl-mp4eg78b-jr67q1",
      "name": "RUN-UP (at holding point)",
      "phase": "taxiout",
      "sections": [
        {
          "id": "sec-mp4eg78b-q6n8yn",
          "title": "RUN-UP (at holding point) ",
          "items": [
            {
              "action": "Parking brake ",
              "expected": "SET"
            },
            {
              "action": "Taxi light",
              "expected": "OFF"
            },
            {
              "action": "Oil temp minimum",
              "expected": "GREEN"
            },
            {
              "action": "Engine instruments ",
              "expected": "CHECK"
            },
            {
              "action": "Generator light",
              "expected": "CHECK OFF"
            },
            {
              "action": "Power",
              "expected": "1640 RPM"
            },
            {
              "action": "Magnetos max -130/±50RPM",
              "expected": "CHECK"
            },
            {
              "action": "Carb. heat max -50RPM ",
              "expected": "CHECK"
            },
            {
              "action": "Throttle",
              "expected": "IDLE"
            }
          ]
        }
      ]
    },
    {
      "id": "cl-mp4eg78b-1nzzni",
      "name": "BEFORE TAKE-OFF",
      "phase": "taxiout",
      "sections": [
        {
          "id": "sec-mp4eg78b-5191rl",
          "title": "BEFORE TAKE-OFF",
          "items": [
            {
              "action": "Fuel quantity",
              "expected": "CHECK"
            },
            {
              "action": "Flaps",
              "expected": "SET T/O"
            },
            {
              "action": "Trim",
              "expected": "SET"
            },
            {
              "action": "Carb. heat",
              "expected": "OFF"
            },
            {
              "action": "Doors locks",
              "expected": "CLOSED"
            },
            {
              "action": "Departure briefing",
              "expected": "PERFORMED"
            },
            {
              "action": "Emergency briefing",
              "expected": "PERFORMED"
            }
          ]
        }
      ]
    },
    {
      "id": "cl-mp8chqh5-4zkbi7",
      "name": "LINE-UP",
      "phase": "takeoff",
      "sections": [
        {
          "id": "sec-mp8chqh5-pt6hcp",
          "title": "Main",
          "items": [
            {
              "action": "Parking brake",
              "expected": "RELEASE"
            },
            {
              "action": "Fuel pump",
              "expected": "ON"
            },
            {
              "action": "Transponder",
              "expected": "ALT"
            },
            {
              "action": "Strobes ",
              "expected": "ON"
            },
            {
              "action": "Landing light",
              "expected": "ON"
            },
            {
              "action": "Taxi light",
              "expected": "ON"
            },
            {
              "action": "Runway & app sector ",
              "expected": "FREE"
            },
            {
              "action": "Magnetic compass",
              "expected": "CHECK"
            },
            {
              "action": "Heading bug on RWY HDG ",
              "expected": "SET"
            }
          ]
        }
      ]
    },
    {
      "id": "cl-mp8cjsf4-5uet5o",
      "name": "TAKE-OFF",
      "phase": "takeoff",
      "sections": [
        {
          "id": "sec-mp8cjsf4-dq8zap",
          "title": "TAKE-OFF",
          "items": [
            {
              "action": "Throttle full ",
              "expected": "FORWARD"
            },
            {
              "action": "Runway centerline ",
              "expected": "HOLD"
            },
            {
              "action": "Engine instruments ",
              "expected": "CHECK"
            },
            {
              "action": "Rotation speed Vr",
              "expected": "50 KIAS"
            },
            {
              "action": "Positive climb ",
              "expected": "BRAKES ON"
            }
          ]
        }
      ]
    },
    {
      "id": "cl-mp8cpbt4-78pbdz",
      "name": "AFTER TAKE-OFF",
      "phase": "takeoff",
      "sections": [
        {
          "id": "sec-mp8cpbt4-mimi2p",
          "title": "AFTER TAKE-OFF",
          "items": [
            {
              "action": "Fuel pump",
              "expected": "OFF"
            },
            {
              "action": "Fuel pressure",
              "expected": "GREEN ARC"
            },
            {
              "action": "Flaps",
              "expected": "UP"
            },
            {
              "action": "Landing light",
              "expected": "OFF"
            },
            {
              "action": "Taxi light",
              "expected": "OFF"
            },
            {
              "action": "Climbing speed Vy",
              "expected": "67 KIAS"
            },
            {
              "action": "Trim",
              "expected": "AS NEEDED"
            }
          ]
        }
      ]
    },
    {
      "id": "cl-mp8cr9pc-ljgzdl",
      "name": "CRUISE",
      "phase": "cruise",
      "sections": [
        {
          "id": "sec-mp8cr9pc-1o41ly",
          "title": "CRUISE",
          "items": [
            {
              "action": "Desired altitude",
              "expected": "LEVELED"
            },
            {
              "action": "Cruise power",
              "expected": "SET"
            },
            {
              "action": "Trim",
              "expected": "AS NEEDED"
            },
            {
              "action": "Engine instruments",
              "expected": "MONITOR"
            },
            {
              "action": "Carb. heat",
              "expected": "AS NEEDED"
            }
          ]
        }
      ]
    },
    {
      "id": "cl-mp8dpk4m-5zg2bz",
      "name": "IN-FLIGHT FUEL IMBALANCE",
      "phase": "cruise",
      "sections": [
        {
          "id": "sec-mp8dpk4m-8syx2n",
          "title": "IN-FLIGHT FUEL IMBALANCE",
          "items": [
            {
              "action": "FUEL PUMP",
              "expected": "ON"
            },
            {
              "action": "FUEL VALVE",
              "expected": "FULLER TANK"
            },
            {
              "action": "FUEL PUMP",
              "expected": "OFF AFTER 5S"
            }
          ]
        }
      ]
    },
    {
      "id": "cl-mp8drci3-rjc40m",
      "name": "BEFORE LANDING",
      "phase": "descent",
      "sections": [
        {
          "id": "sec-mp8drci3-1g6zt0",
          "title": "BEFORE LANDING",
          "items": [
            {
              "action": "Descent power",
              "expected": "SET"
            },
            {
              "action": "Fuel pump",
              "expected": "ON"
            },
            {
              "action": "Fuel valve",
              "expected": "FULLER TANK"
            },
            {
              "action": "Carb. heat",
              "expected": "ON"
            },
            {
              "action": "Approach speed (white arc)",
              "expected": "66-70 KIAS"
            },
            {
              "action": "Flaps",
              "expected": "SET T/O"
            },
            {
              "action": "Landing light",
              "expected": "ON"
            }
          ]
        }
      ]
    },
    {
      "id": "cl-mp8dtanf-99vjgh",
      "name": "FINAL",
      "phase": "landing",
      "sections": [
        {
          "id": "sec-mp8dtanf-z4bs6r",
          "title": "FINAL",
          "items": [
            {
              "action": "Speed check",
              "expected": "65 KIAS"
            },
            {
              "action": "Flaps",
              "expected": "LDG"
            },
            {
              "action": "Descent",
              "expected": "ESTABLISH"
            },
            {
              "action": "Carb. heat",
              "expected": "OFF"
            },
            {
              "action": "Touch down speed",
              "expected": "51 KIAS"
            }
          ]
        }
      ]
    },
    {
      "id": "cl-mp8en440-zrehhd",
      "name": "GO AROUND",
      "phase": "landing",
      "sections": [
        {
          "id": "sec-mp8en440-qryezm",
          "title": "GO AROUND",
          "items": [
            {
              "action": "Throttle",
              "expected": "FULL"
            },
            {
              "action": "Speed",
              "expected": "63 KIAS"
            },
            {
              "action": "Fuel pump",
              "expected": "ON"
            },
            {
              "action": "Flaps",
              "expected": "SET T/O"
            }
          ]
        }
      ]
    },
    {
      "id": "cl-mp8eolnz-7cjc4h",
      "name": "AFTER LANDING",
      "phase": "landing",
      "sections": [
        {
          "id": "sec-mp8eolnz-sv0fub",
          "title": "AFTER LANDING",
          "items": [
            {
              "action": "Flaps",
              "expected": "UP"
            },
            {
              "action": "Fuel Pump",
              "expected": "OFF"
            }
          ]
        }
      ]
    },
    {
      "id": "cl-mp8epv27-9gtavc",
      "name": "AFTER VACATING",
      "phase": "taxiin",
      "sections": [
        {
          "id": "sec-mp8epv27-o8dulk",
          "title": "AFTER VACATING",
          "items": [
            {
              "action": "Transponder",
              "expected": "SET STB"
            },
            {
              "action": "Strobes",
              "expected": "OFF"
            },
            {
              "action": "Landing light",
              "expected": "OFF"
            },
            {
              "action": "Taxi light",
              "expected": "ON"
            }
          ]
        }
      ]
    },
    {
      "id": "cl-mp8er4yn-kxyiog",
      "name": "ENGINE SHUT DOWN",
      "phase": "taxiin",
      "sections": [
        {
          "id": "sec-mp8er4yn-3ap5ai",
          "title": "ENGINE SHUT DOWN",
          "items": [
            {
              "action": "Parking brake",
              "expected": "SET"
            },
            {
              "action": "Taxi light",
              "expected": "OFF"
            },
            {
              "action": "Avionics master",
              "expected": "OFF"
            },
            {
              "action": "Generator",
              "expected": "OFF"
            },
            {
              "action": "Magnetos",
              "expected": "OFF"
            },
            {
              "action": "Nav light",
              "expected": "OFF"
            },
            {
              "action": "Chronometer (UTC)",
              "expected": "COPY"
            },
            {
              "action": "Master",
              "expected": "OFF"
            },
            {
              "action": "Hoobs",
              "expected": "COPY"
            },
            {
              "action": "START circuit",
              "expected": "OUT"
            }
          ]
        }
      ]
    }
  ],
  dataFileBaseName: "P2008JC data",
  displayName: "Tecnam P2008JC",
  icaoType: "P208",
  order: 2,
  performance: null,
  performanceStatus: "pending",
  powerplant: "reciprocating",
  source: "Performance tables not loaded yet",
  type: "P2008JC"
});
