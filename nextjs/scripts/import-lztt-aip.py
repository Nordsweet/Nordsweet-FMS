"""Reproduce LZTT reference data from the bundled LPS AIP (01 OCT 2026 edition).

Run from nextjs/: python scripts/import-lztt-aip.py (requires pdfplumber).
Only point-based RNAV IF/CF/TF procedures are imported; DME-arc conventional
procedures remain available as original charts, not invented point sequences.
"""
import json
import re
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public/data"
CHARTS = ROOT / "public/charts/Slovakia/LZTT"
SOURCE = "LPS SR eAIP 01 OCT 2026, LZTT AD 2"


def coordinates(value):
    parts = re.findall(r"(\d{2,3})[°](\d{2})['’](\d{2}[,.]\d+)[\"]([NE])", value)
    assert len(parts) == 2, value
    return [round(int(d) + int(m) / 60 + float(s.replace(',', '.')) / 3600, 8) for d, m, s, _ in parts]


def dms(value):
    lat, lon = value.split()
    def number(v):
        width = 2 if v[-1] == 'N' else 3
        return round(int(v[:width]) + int(v[width:width+2]) / 60 + float(v[width+2:-1]) / 3600, 8)
    return number(lat), number(lon)


def update(name, rows, key):
    path = DATA / (name + '.json')
    existing = json.loads(path.read_text(encoding='utf-8'))
    path.write_text(json.dumps([r for r in existing if not key(r)] + rows, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


airports = json.loads((DATA / 'airports.json').read_text(encoding='utf-8'))
airport = next(a for a in airports if a['ident'] == 'LZTT')
airport.update(lat=dms('490425N 0201428E')[0], lon=dms('490425N 0201428E')[1], elevationFt=2356,
               contact='+421/52/431 14 30; airport@airport-poprad.sk',
               links=['https://aim.lps.sk/web/eAIP_SR/AIP_SR_EFF_01OCT2026_amdt/html/LZ-AD-2.LZTT-en-SK.html', 'https://www.airport-poprad.sk/'],
               remarks='RWY 07L/25R closed (not offered for planning). RWY 07R/25L: prior airport operator approval, maximum 2000 kg / 0.4 MPa. Contact Tatry Tower at least 3 minutes before entering CTR/TMA from uncontrolled airspace. VFR entry/exit via E/N/S/W unless otherwise instructed. ATS hours: 0615–1800 UTC (0515–1700 summer), otherwise prior confirmation; verify NOTAM. RNAV 1 procedures require GNSS; initial climb by ATC and published climb gradients apply (see SID charts).', source=SOURCE)
airport['runways'] = []
for designator, heading, length, width, surface, position, elevation, toda in [
    ('09',94.10,2600,45,'concrete','490427.96N 0201324.22E',2355.2,2660),
    ('27',274.13,2600,45,'concrete','490421.92N 0201531.99E',2278.5,2700),
    ('07R',73.45,760,45,'grass','490410.65N 0201408.82E',2309,785),
    ('25L',253.46,760,45,'grass','490417.65N 0201444.72E',2299,785),
]:
    lat, lon = dms(position)
    opposite_elevation = {'09':2278.5,'27':2355.2,'07R':2299,'25L':2309}[designator]
    airport['runways'].append(dict(designator=designator,trueHeadingDeg=heading,lengthM=length,widthM=width,surface=surface,
        slopePct=round((opposite_elevation-elevation)*0.3048/length*100,5),toraM=length,todaM=toda,asdaM=length,ldaM=length,
        threshold=dict(lat=lat,lon=lon,elevationFt=elevation)))

frequencies=[]
for service, callsign, frequency, primary, notes in [
    ('tower','Tatry Tower','121.350',True,'Primary TWR/APP; AD 2.18'),
    ('tower','Tatry Tower','118.950',False,'Alternate TWR/APP; AD 2.18'),
    ('tower','Tatry Tower','118.630',False,'Alternate TWR/APP; AD 2.18'),
    ('atis','Poprad Tatry ATIS','133.130',True,'AD 2.18; phone +421/2/48 57 20 90'),
]:
    frequencies.append(dict(airport='LZTT',service=service,callsign=callsign,frequencyMhz=frequency,primary=primary,sector=None,notes=SOURCE+'; '+notes))

procedures=[]
fixes={}
for chart, runway, kind in [('5-5','09','SID'),('5-11','27','SID'),('6-3','09','STAR'),('6-9','27','STAR')]:
    with pdfplumber.open(CHARTS / ('LZ_AD_2_LZTT_'+chart+'_en.pdf')) as pdf:
        for page in pdf.pages[1:]:
            for table in page.dedupe_chars().extract_tables():
                titles=[c for row in table for c in row if c and 'Coding Table:' in c]
                if not titles: continue
                designator=titles[0].split('Coding Table:')[1].strip()
                legs=[]
                for row in table:
                    if row[0] not in ['IF','CF','TF']:continue
                    cells=[c.strip() for c in row if c is not None]
                    assert len(cells)==10 and cells[2]=='NO', cells
                    path, ident, _, coord, track, distance, turn, altitude, speed, spec=cells
                    assert re.fullmatch('[A-Z0-9]{2,5}',ident) and spec=='RNAV 1', cells
                    lat,lon=coordinates(coord)
                    alt=None
                    if altitude not in ['-', '']:
                        match=re.fullmatch(r'A(\d+)([+-]?)',altitude)
                        assert match, cells
                        alt=dict(raw=match[1]+'ft',type={'+':'atOrAbove','-':'atOrBelow','':'exact'}[match[2]])
                    assert speed in ['-', ''] or re.fullmatch(r'K\d+-',speed), cells
                    leg=dict(ident=ident,lat=lat,lon=lon,altitude=alt,speedKt=int(speed[1:-1]) if speed not in ['-', ''] else None,
                        trackMagDeg=float(re.match(r'\d+',track)[0]) if track!='-' else None,
                        distanceNm=float(distance.split()[0].replace(',','.')) if distance!='-' else None)
                    legs.append(leg)
                    fixes[ident]=(lat,lon)
                assert legs, designator
                procedures.append(dict(airport='LZTT',type=kind,id=designator.replace(' ',''),designator=designator,runways=[runway],legs=legs,
                    source=SOURCE+'; RNAV 1 / GNSS; AD 2-LZTT-'+chart+' PDF page '+str(page.page_number)))
assert len(procedures)==28, len(procedures)

navpoints=json.loads((DATA/'navpoints.json').read_text(encoding='utf-8'))
existing={p['ident']:p for p in navpoints}
new=[]
for ident,(lat,lon) in fixes.items():
    old=existing.get(ident)
    new.append(dict(ident=ident,aliases=old['aliases'] if old else [],name=ident,kind='navaid' if ident=='PPD' else 'ifr-waypoint',lat=lat,lon=lon,
        airport='LZTT' if ident.startswith('TT') else None,description='LZTT RNAV 1 SID/STAR fix',airways=old['airways'] if old else [],
        navaid=dict(type='VOR/DME',frequency='112.100',channel='58X') if ident=='PPD' else None,source=SOURCE))
for suffix,name,position in [
    ('A','Šuňava, church','490152N 0200447E'),('B','Dubina, quarry','490039N 0201710E'),
    ('C','Štrbské Pleso, ski jump','490741N 0200318E'),('D','Veľký Slavkov, church','490537N 0201656E'),
    ('E','Spišský Štvrtok, center','490006N 0202803E'),('N','Kežmarok, center','490807N 0202556E'),
    ('S','Vernár, center','485504N 0201611E'),('W','Liptovská Kokava, church','490514N 0194902E')]:
    lat,lon=dms(position)
    new.append(dict(ident='LZTT'+suffix,aliases=['LZTT '+suffix],name='LZTT '+suffix+' - '+name,kind='vfr-reporting-point',lat=lat,lon=lon,
        airport='LZTT',description='Intermediate holding point' if suffix in 'ABCD' else 'CTR entry/exit point',airways=[],navaid=None,source=SOURCE+'; AD 2.22.6'))
for runway in airport['runways']:
    new.append(dict(ident='RW'+runway['designator']+'/LZTT',aliases=[],name='RW'+runway['designator']+'/LZTT',kind='runway-threshold',
        lat=runway['threshold']['lat'],lon=runway['threshold']['lon'],airport='LZTT',description=None,airways=[],navaid=None,source=SOURCE+'; AD 2.12'))
ids={p['ident'] for p in new}
# Validate all PDF tables before replacing any bundled dataset.
update('airports',[airport],lambda r:r['ident']=='LZTT')
update('frequencies',frequencies,lambda r:r['airport']=='LZTT')
update('procedures',procedures,lambda r:r['airport']=='LZTT')
update('navpoints',new,lambda r:r['ident'] in ids or r['airport']=='LZTT')
print(f'LZTT: {len(airport["runways"])} open runway ends, {len(frequencies)} frequencies, {len(procedures)} RNAV procedures, {len(new)} fixes')
