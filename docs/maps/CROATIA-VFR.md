# Croatia significant VFR points

The user-supplied Croatia Control VFR Manual ENR 4.4 (pages 1–2), effective
15 MAY 2025, AMDT 6/25, supplies 84 significant VFR points. The original PDF is
retained at `sources/croatia-vfr-enr-4.4-2025-05-15.pdf`.

SHA256: `80bc1470481492fee70f4f26524a33928a38d3c6b5ea51ffc59f0ed5a008d9c0`.

`nextjs/scripts/import-croatia-vfr.py` reproduces the import with Python and
pdfplumber. It validates the count, unique identifiers, coordinate ranges and
collisions with existing records before writing `public/data/navpoints.json`.
Both PDF pages were rendered and inspected; their two columns are imported.
Coordinates are converted from published N/E DMS to decimal degrees, rounded to
eight decimal places. Repeat runs produce identical data.

Published identifiers are preserved (e.g. A1, L7, KONAS). These are VFR reporting
points, available in the existing Map/Fly VFR layer, search and route selection,
including without collector connectivity. ENR 4.4 does not assign them to
airports, so `airport` remains null. The two non-NIL remarks (I2, L7) are retained.
No altitude, frequency or mandatory-reporting status is inferred. This imports
the supplied edition; it does not assert currency beyond its effective date.
