# Bright (OSM OpenMapTiles)

Source: https://github.com/openmaptiles/openmaptiles/tree/6c11838d38030148832c039c2ea367274db86a87/style
(the layer styles are `layers/*/style.json` in the same revision; `style/style-header.json` gives the
background).

`nextjs/src/features/map/deck/bright.ts` projects 90 of its 256 layers into the existing deck.gl
vector renderer (fill, line and place-label layers, in the style's own `order`). It is a light map
and the default basemap. Tiles are OpenFreeMap's, shared with Fjord and Dark Matter.

Left out so the map stays fast on a tablet: POIs, house numbers, mountain peaks, text along lines,
sprites and patterns, tunnels, roads under construction, footpaths/cycleways/steps, ferries, cable
cars and subway lines. Bridges are drawn as ordinary roads (the tunnel exclusion is the only
`brunnel` filter kept). Country labels use one size ramp instead of the style's rank expression.
Attribution/license shipped in `/bright-attribution.html`.
