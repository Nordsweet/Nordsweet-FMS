# OpenFlightMaps overlay

Optional transparent aviation overlay above any selected basemap and below app airspace, navigation, terrain-clearance and traffic layers. Shared Map/Fly settings default off and persist locally. It also drapes over 3D terrain.

Source: https://openflightmaps.org/downloads/ep/
Official viewer source inspected 22 OCT 2026: https://openflightmaps.org/wp-content/plugins/ofmTileMap/ofmTileMap.js

XYZ raster endpoint: https://nwy-tiles-api.prod.newaydata.com/tiles/{z}/{x}/{y}.png?path={AIRAC}/aero/latest
512 px images in a 256 px logical XYZ grid (the official viewer uses tilePixelRatio 2); native zoom 7-13. CORS verified. No API token required. Geographic coverage and publication availability are determined by OFM; missing tiles leave the chosen basemap visible. Current AIRAC is calculated from the 28-day UTC cycle anchored 23 JAN 2003, with yearly numbering including 14-cycle years. The displayed AIRAC is the requested cycle; no silent fallback to an older edition.

Attribution: © open flightmaps association, with link to https://openflightmaps.org/ and the requested AIRAC. Existing basemap attribution remains. A visible Report an OFM error link opens mail to info@openflightmaps.org, the official contact published on OFM's site. Users can supply location, AIRAC and correction details in their mail client.

License explanation: https://openflightmaps.org/about/#general-users-license. It permits application use with attribution and requires an error-reporting channel. We display original tiles without modifying the OFM database. Data corrections are reported through the provided contact link.

Visited successful tiles use the existing bounded service-worker map cache; cycle-specific URL keys prevent reuse as a newer cycle. No bulk download or offline area prefetch is added. Unvisited areas still require network access.

Tests cover cycle boundaries/year rollover, optional loading, persistence, attribution/reporting links and 2D/3D shader compatibility. Browser tile fixture is an unchanged sample from cycle 2610, z7/x71/y43, retrieved 22 OCT 2026 from the above endpoint.
