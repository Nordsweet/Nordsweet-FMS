# Dark Matter

Source: https://github.com/openmaptiles/dark-matter-gl-style/tree/d17442cb66bad8c82bda59d199d5dafeead410cf

Original `style.json` and licence preserved here. `nextjs/src/features/map/deck/dark-matter.ts`
projects its 41 drawable fill/line/place layers into the existing deck.gl vector renderer.
OpenFreeMap supplies OpenMapTiles-schema tiles without a MapTiler token; existing raw tile cache
and local MVT parser are shared with Fjord. No extra worker CDN or request for private credentials.
Same renderer limitations as Fjord: system font, point-place decluttering, no road/water text along
lines, sprite symbols, wood pattern or blur. Main source colours, zoom/filter/opacity/width stops and
layer order retained. Attribution/license shipped in `/dark-matter-attribution.html`.
