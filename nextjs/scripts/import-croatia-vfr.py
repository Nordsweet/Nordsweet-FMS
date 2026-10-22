"""Import the user-supplied Croatia VFR Manual ENR 4.4, 15 MAY 2025.

Run with Python + pdfplumber. The original two-page PDF is kept with provenance.
"""
import hashlib
import json
import re
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "docs/maps/sources/croatia-vfr-enr-4.4-2025-05-15.pdf"
DATA = ROOT / "nextjs/public/data/navpoints.json"
SOURCE = "Croatia Control VFR Manual ENR 4.4, 15 MAY 2025, AMDT 6/25"
PATTERN = r"\b([A-Z][A-Z0-9]{1,4})\s+(\d{2})\s+(\d{2})\s+(\d{2})N\s+(\d{3})\s+(\d{2})\s+(\d{2})E"


def decimal(degrees, minutes, seconds):
    assert 0 <= int(minutes) < 60 and 0 <= int(seconds) < 60
    return round(int(degrees) + int(minutes) / 60 + int(seconds) / 3600, 8)


with pdfplumber.open(PDF) as pdf:
    assert len(pdf.pages) == 2
    rows = [row for page in pdf.pages
            for row in re.findall(PATTERN, page.dedupe_chars().extract_text())]
assert len(rows) == 84 and len({r[0] for r in rows}) == 84
points = []
for ident, lat_d, lat_m, lat_s, lon_d, lon_m, lon_s in rows:
    lat = decimal(lat_d, lat_m, lat_s)
    lon = decimal(lon_d, lon_m, lon_s)
    assert 42 <= lat <= 47 and 13 <= lon <= 20, ident
    # ENR 4.4 does not assign airports; do not guess from nearby aerodromes.
    remark = {"I2": "Islam Latinski", "L7": "Islet of Love - Jarun Lake"}.get(ident)
    points.append(dict(ident=ident, aliases=[], name=ident,
                       kind="vfr-reporting-point", lat=lat, lon=lon, airport=None,
                       description=remark, airways=[], navaid=None, source=SOURCE))

existing = json.loads(DATA.read_text(encoding="utf-8"))
ids = {p["ident"] for p in points}
conflicts = [p["ident"] for p in existing if p["ident"] in ids and p["source"] != SOURCE]
assert not conflicts, f"Resolve existing identifier collisions before importing: {conflicts}"
result = [p for p in existing if p["source"] != SOURCE] + sorted(points, key=lambda p: p["ident"])
DATA.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Imported {len(points)} Croatia VFR points; source SHA256 {hashlib.sha256(PDF.read_bytes()).hexdigest()}")
