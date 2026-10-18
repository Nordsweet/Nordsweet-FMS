# C172S / Carenado NAV III reference import

Owner supplied four PDFs from their Carenado C172SP G1000 simulator installation on 2026-10-18.
The aircraft is a separate `C172S` profile, ICAO `C172`, with no registration assignment. It does
not inherit R172K/FR172H or C152 performance, emergency steps or W&B.

## Source inventory

| PDF                                            | Pages                    | Imported                                                                                                                                                                                                                  |
| ---------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carenado C172SP G1000 References.pdf           | 1, U.S.4-5, 172SPHAUS-03 | Normal operating speeds, weight-dependent turbulent penetration speeds, demonstrated crosswind                                                                                                                            |
| Carenado C172SP G100 Performance.pdf           | 2                        | Power-off stall table, forward/rearward CG, 0/30/45/60 degree banks, KIAS and KCAS                                                                                                                                        |
| Same                                           | 3–4, Figure 5-8          | All 111 cruise cells: six pressure altitudes (2000–12000 ft), three ISA deviations (−20/0/+20 C), RPM, power, KTAS, fuel flow                                                                                             |
| Carenado C172SP G1000 Normal Procedures.pdf    | 2–19                     | 20 phase-linked checklists: walk-around, battery/external-power starts, before takeoff, normal/short takeoff, climb, cruise, descent, before landing, normal/short landing, balked landing, after landing and securing    |
| Carenado C172SP G1000 Emergency Procedures.pdf | 2–17                     | 26 source-labelled reference variants, including engine failures, forced/precautionary landing, ditching, engine/electrical/cabin/wing fires, icing, static blockage, vapor, tires, electrical/ADC/AHRS/cooling/vacuum/CO |

Every PDF says **NOT INTENDED FOR REAL FLIGHTS**. That designation is visible on the aircraft
reference card, normal checklists and emergency references. Emergency definitions remain
`reference`, with no invented reviewer, serial applicability or operational approval. Browse them
from EMER or the checklist library; reference selection/progress is retained offline. Original
aviation procedure language is English; application labels and source notices are PL/EN.

## Interpretation and missing data

- US gallons to litres: exactly 3.785411784 L/US gal. Original source quantities/conditions are
  retained in the reference card. The 2550 lb value is the table reference weight, not a supplied
  aircraft-specific empty weight, loading station model or CG envelope.
- All cruise rows are retained. The source says recommended lean mixture is for at most 75% MCP;
  higher rows are interpolation references, and operations above 75% require full rich mixture.
  The operating lookup filters interpolated power above 75%; climb-power fuel extrapolation returns
  unavailable for this table. Fixed-pitch manual lookup accepts RPM without inventing MAP and
  interpolates only within available operating settings.
- 15 kt is the **demonstrated crosswind**, exposed through the existing planning crosswind field;
  the reference card explicitly distinguishes it from a certified operating limit.
- No takeoff/landing distances, climb-rate/fuel tables, tank capacities, aircraft-specific W&B,
  approved glide polar or prescribed circuit speed were supplied. Those profile fields remain
  null/empty. Normal speeds and stall figures are reference values, not invented flight-envelope
  minima or a substitute for those missing tables. No source PDF binaries are published.
- PDF text has hidden/overlapping older layers. Deduplicated cruise cells were compared with
  rendered pages. Normal p.16 and emergency pp.9/11/12/14 were transcribed against their visible
  rendered content. In particular p.9 shows static blockage + vapor, not the hidden previous
  fire procedure. Visible pp.12/14 omit a numbered BUS 2 OFF step present in hidden text; no
  hidden step was silently inserted. The static-source airspeed footnote points to a correction
  chart absent from the supplied PDFs, so it is explicitly unavailable.

## Validation

`tests/c172s.test.ts` checks profile isolation, missing values, 111 unique cruise cells and source
anchors, precise gallon conversion, fixed-pitch interpolation/75% constraint, phase coverage,
reference-only emergency status, stable item IDs and restart branch integrity. The existing cruise
golden tests protect other aircraft. `e2e/c172s.spec.ts` verifies selection/reload, source speeds,
normal checklist progress/reload, Engine Out reference and electrical reference selection. Existing
FR172H emergency scenarios protect its reference browsing after generalized aircraft labels.
