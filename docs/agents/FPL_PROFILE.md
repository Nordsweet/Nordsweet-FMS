# FPL profile — 2026-10-20

Owner-requested extension of the typed app; no legacy behaviour replaces these requirements.

- TOC/TOD map labels inherit the route marker font, size, weight and letter spacing. Their dots stay on the rendered route; only the label has a vertical offset.
- FPL interleaves display-only TOC/TOD rows at their planned altitude. The rows have no delete/options buttons and never become navigation or insertion targets. Real waypoint actions and active indexes stay unchanged.
- The vertical chart below FPL follows the active fly-by path, with distance in NM and altitude in ft AMSL. The aircraft uses its actual fresh position and AMSL altitude, projected onto the sequenced leg. Off-route projection is identified explicitly; missing altitude/position is unavailable.
- DEM sampling shares the existing Mapzen/AWS Terrarium decoder and IndexedDB cache. Each station uses the maximum terrain envelope from the previous station, including boundary pixels. Missing data creates gaps, never zero-height terrain. Downloads are bounded and concurrent; sampling coarsens for very long routes. This is a sampled route profile, not a certified obstacle-clearance calculation.
- Return flights select the arrival occurrence of a repeated airport. Direct/Divert excludes profile events from abandoned legs. Coincident events are still shown beside their real fix.
- FPL uses the available panel height, keeps the chart below a scrolling waypoint list and adapts to desktop, tablet and phone.

Validation: domain tests cover profile order/heights, unchanged navigation indexes, coincident events, return/direct routes, curved-path projection and DEM gaps. Browser tests cover computed font parity, live aircraft movement/altitude, real PNG terrain decoding, missing terrain, cache reuse after reload and responsive layout. Existing FPL actions, waypoint insertion, marker anchoring, altitude notifications and tablet navigation are included in regression checks. Full repository gates run before merging to develop.
