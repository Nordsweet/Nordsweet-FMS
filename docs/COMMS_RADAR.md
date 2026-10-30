# Warsaw Radar sector reference

The embedded LOW sector frequencies and interior sector coordinates are from PANSA eAIP
[ENR 2.1.2, AIRAC 11/2026](https://docs.pansa.pl/ais/eaipifr/AIRAC%20AMDT%2011-26_2026_10_29/eAIP/ENR%202.1.2-en-GB.html),
effective 29 October through 25 November 2026. The application refuses to suggest these
frequencies outside that period, above FL335, on ambiguous overlaps, or within 0.5 NM of
a sector boundary. New AIRAC data must be checked and regenerated before extending validity.

Some published sector edges follow the Warsaw FIR boundary. Their geometry was reconstructed
using the FIR maritime arc from the Lotnik OpenAir source and a simplified Polish land border
from © OpenStreetMap contributors (ODbL, https://www.openstreetmap.org/copyright). These are
approximations, not a certified boundary. The source-sector endpoints differed by up to
0.391 NM from the reconstructed border. The generator is `nextjs/scripts/build-warsaw-radar.py`;
it expects the referenced AIP HTML, Lotnik OpenAir data and Nominatim GeoJSON files in the
working directory under the filenames shown in the script.

These are published elementary primary channels, not a live sector configuration: ATC may
combine sectors and assign another frequency. Pilots must confirm the active channel with ATC.
The FL95 threshold uses actual pressure altitude, not GPS MSL altitude. GPS and older Connector
versions do not supply it; in that case the FL95 transition cannot be determined. Other FL-based
local airspace limits fall back to approximate MSL altitude when pressure altitude is missing. Forecasts
along a route use the current pressure-to-MSL offset as an approximation, not a future pressure
forecast. Local CTR, TMA, ATZ and TRA services continue to take precedence.
