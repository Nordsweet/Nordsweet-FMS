"""Import owner-supplied Carenado CT182T simulation manuals into the bundled dataset."""
import json
import re
import sys
from pathlib import Path
from pypdf import PdfReader

base = Path(sys.argv[1])
target = Path(__file__).resolve().parents[1] / "public/data/aircraft.json"

def pages(name):
    return [p.extract_text().replace("\ufffd", " degrees ") for p in PdfReader(base / name).pages]

def clean(text):
    text = re.sub(r"Carenado Copyrights 2012\s+all rights reserved", "", text)
    return re.sub(r"(?m)^\s*\d+\s*$", "", text)

def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")

rows = []
for index, page in enumerate(pages("CT182T Performance Tables.pdf")[1:]):
    altitude = index * 2000
    rpm = None
    count = 0
    for line in page.splitlines():
        tokens = line.split()
        if tokens and tokens[0] in ["2400", "2300", "2200", "2100", "2000"]:
            rpm = int(tokens.pop(0))
        if len(tokens) != 10 or not re.fullmatch(r"\d{2}", tokens[0]):
            continue
        assert rpm is not None
        mp = int(tokens[0])
        for offset, delta in enumerate([-20, 0, 20]):
            triple = tokens[1 + offset * 3:4 + offset * 3]
            if triple == ["---"] * 3:
                continue
            power, speed, gph = (float(value.rstrip(".")) for value in triple)
            rows.append(dict(pressureAltitudeFt=altitude, isaDeltaC=delta,
                             setting=f"{rpm} RPM / {mp} inHg", powerPct=power,
                             ktas=speed, fuelFlowLph=round(gph * 3.785411784, 6)))
            count += 1
    assert count > 60, (altitude, count)

normal_names = [
    ("Before Starting Engine", "taxiout"),
    ("Starting Engine (With Battery)", "taxiout"),
    ("Starting Engine (With External Power)", "taxiout"),
    ("Before Takeoff", "takeoff"), ("Normal Takeoff", "takeoff"),
    ("Short Field Takeoff", "takeoff"), ("Normal Climb", "climb"),
    ("Maximum Performance Climb", "climb"), ("Cruise", "cruise"),
    ("Descent", "descent"), ("Before Landing", "landing"),
    ("Normal Landing", "landing"), ("Short Field Landing", "landing"),
    ("Balked Landing", "landing"), ("After Landing", "taxiin"),
    ("Securing Airplane", "taxiin"),
]

def blocks(text, names):
    locations = []
    for name in names:
        match = re.search(r"(?m)^" + re.escape(name) + r"\s*$", text)
        assert match, name
        locations.append((match.start(), match.end(), name))
    locations.sort()
    return [(name, text[end:locations[i + 1][0] if i + 1 < len(locations) else len(text)])
            for i, (_, end, name) in enumerate(locations)]

def numbered(body):
    matches = list(re.finditer(r"(?m)^\s*(\d+)\.\s+", body))
    return [" ".join(body[m.end():matches[i + 1].start() if i + 1 < len(matches) else len(body)].split())
            for i, m in enumerate(matches)]

normal = "\n".join(clean(p) for p in pages("CT182T Normal Procedures.pdf")[7:])
normal = re.sub(r"(?m)^\s*(Takeoff|Enroute Climb)\s*$", "", normal)
checklists = []
preflight = "\n".join(clean(p) for p in pages("CT182T Normal Procedures.pdf")[1:7])
preflight = re.sub(r"(?m)^Preflight Inspection(?: \(Continued\))?\s*$", "", preflight)
preflight_sections = []
for name, body in blocks(preflight, ["Cabin", "Empennage", "Right Wing Trailing Edge", "Right Wing", "Nose", "Left Wing Leading Edge", "Left Wing", "LEFT WING Trailing Edge"]):
    items = []
    for text in numbered(body):
        action, sep, expected = text.partition(" - ")
        items.append(dict(action=action, expected=expected if sep else ""))
    preflight_sections.append(dict(title=name, items=items))
checklists.append(dict(id="ct182t-preflight", name="Preflight Inspection", phase="taxiout",
                       source="Carenado CT182T Normal Procedures (2012), pp. 2-7; simulation reference",
                       sections=preflight_sections))
for name, body in blocks(normal, [n for n, _ in normal_names]):
    items = []
    for text in numbered(body):
        action, sep, expected = text.partition(" - ")
        items.append(dict(action=action, expected=expected if sep else ""))
    assert items, name
    checklists.append(dict(id="ct182t-" + slug(name), name=name,
                           phase=dict(normal_names)[name],
                           source="Carenado CT182T Normal Procedures (2012), pp. 8-19; simulation reference",
                           sections=[dict(title=name, items=items)]))

emergency_names = [
    ("Engine Failure During Takeoff Roll", "failure", "runway"),
    ("Engine Failure Immediately After Takeoff", "failure", "after-takeoff"),
    ("Engine Failure During Flight (Restart Procedures)", "failure", "flight"),
    ("Emergency Landing Without Engine Power", "failure", "flight"),
    ("Precautionary Landing With Engine Power", "failure", "flight"),
    ("Ditching", "pax", "flight"), ("During Start On Ground", "fire", "ground"),
    ("Engine Fire In Flight", "fire", "flight"),
    ("Electrical Fire In Flight", "electric", "flight"),
    ("Cabin Fire", "fire", "flight"), ("Wing Fire", "fire", "flight"),
    ("Inadvertent Icing Encounter During Flight", "failure", "flight"),
    ("Static Source Blockage", "failure", "flight"),
    ("Fuel Flow Stabilization Procedures", "fuel", "flight"),
    ("Landing With A Flat Main Tire", "failure", "flight"),
    ("Landing With A Flat Nose Tire", "failure", "flight"),
]
emergency = "\n".join(clean(p) for p in pages("CT182T Emergency Procedures.pdf")[1:])
emergency = re.sub(r"(?m)^\s*(Forced Landings|Fires|Icing|Excessive Fuel Vapor|Abnormal Landings)\s*$", "", emergency)
procedures = []
for name, body in blocks(emergency, [n for n, _, _ in emergency_names]):
    _, family, phase = next(row for row in emergency_names if row[0] == name)
    first_item = re.search(r"(?m)^\s*\d+\.\s+", body)
    introduction = " ".join(body[:first_item.start()].split()) if first_item else ""
    procedures.append(dict(key="ct182t-" + slug(name), revision="carenado-2012",
                           title=name, family=family, phase=phase, status="reference",
                           aircraftType="CT182T", registration=None,
                           source="Carenado CT182T Emergency Procedures (2012); simulation reference",
                           pages="2-7", edition="2012", serialRange=None, equipment=None,
                           reviewer=None, reviewedAt=None, branchKey=None, speed=None,
                           introduction=introduction,
                           items=[dict(id=f"ct182t-{slug(name)}-{i + 1}", text=t)
                                  for i, t in enumerate(numbered(body))], warnings=[],
                           notes=[" ".join(body.split())] if not numbered(body) else []))

profile = dict(
    id="CT182T", type="CT182T", registration=None,
    displayName="Carenado CT182T Skylane", icaoType="C82S", order=120,
    powerplant="reciprocating", engineCount=1, usableFuelL=None, fuelTankCapacityL=None,
    patternSpeedKt=None, retractableGear=False,
    flapSpeeds=[],
    weightBalance=None, takeoff=None, landing=None, climb=None, climbTables=[],
    cruise=dict(source="Carenado CT182T Performance Tables (2012), pp. 2-12; 3100 lb; recommended lean mixture; cowl flaps closed; simulation reference",
                draft=False, rows=rows), checklists=checklists, emergencyProcedures=procedures,
    windLimits=None,
    referenceData=dict(simulationOnly=True,
        sources=["Carenado CT182T " + name + " (2012)" for name in
                 ["Performance Tables", "Reference", "Normal Procedures", "Emergency Procedures"]],
        values=[dict(label=k, value=v) for k, v in [
            ("VNE", "175 KIAS"), ("VNO", "140 KIAS"),
            ("VA", "110 / 101 / 91 KIAS at 3100 / 2600 / 2100 lb"),
            ("Vx", "64 KIAS"), ("Vy", "84 KIAS S.L.; 80 KIAS at 20,000 ft"),
            ("VFE", "10 degrees: 140 KIAS; 20 degrees: 120 KIAS; FULL: 100 KIAS"),
            ("Best glide", "75 / 69 / 62 KIAS at 3100 / 2600 / 2100 lb"),
            ("Normal climb", "90-100 KIAS; 25 inHg / 2400 RPM; 16 US GPH = 60.57 L/h"),
            ("Maximum performance climb", "32 inHg / 2400 RPM; 24 US GPH = 90.85 L/h"),
            ("Cruise conditions", "3100 lb = 1406.136 kg; recommended lean mixture; cowl flaps closed"),
            ("Missing source data", "No takeoff/landing distance tables, climb-rate table, fuel capacity or W&B envelope supplied"),
        ]]))
data = json.loads(target.read_text(encoding="utf-8"))
data = [a for a in data if a["type"] != "CT182T"]
data.append(profile)
target.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(json.dumps(dict(cruiseRows=len(rows), checklists=len(checklists), emergencyProcedures=len(procedures))))
