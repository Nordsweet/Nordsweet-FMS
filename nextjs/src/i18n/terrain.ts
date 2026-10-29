import { type Message } from "./translate";

export const terrainEn = {
  "terrain.3d": "Terrain 3D",
  "terrain.source":
    "Terrain: Mapzen / AWS · Copernicus EU-DEM, USGS and other providers",
  "terrain.attribution": "Terrain data sources and licences",
  "terrain.loading": "Loading terrain / calculating glide reach…",
  "terrain.missing":
    "Terrain unavailable / incomplete — unknown cells are excluded",
  "terrain.windMissing":
    "Wind unavailable — enter wind below or wait for a valid live estimate",
  "terrain.ready":
    "Terrain/wind glide footprint · grid {resolution} m · clearance {clearance} ft",
  "terrain.limited":
    "Calculation boundary reached; range beyond it has not been evaluated",
  "terrain.model":
    "Current-trend model, not an aircraft polar. Wind held constant; no thermals, buildings, wires or guarantee of landing. Turns include time loss and a conservative terrain envelope.",
  "terrain.windFrom": "Wind FROM (° true)",
  "terrain.windSpeed": "Wind speed (kt)",
  "terrain.applyWind": "Use this wind (0 kt confirms calm)",
  "terrain.clearance": "Terrain clearance (ft)",
  "terrain.liveWind": "Wind: live GPS estimate",
  "terrain.manualWind": "Wind: pilot input (expires after 10 min)",
  "terrain.noInputs":
    "Glide footprint unavailable — fresh AMSL altitude, descent, GS, track and wind are required",
  "terrain.gps":
    "Altitude: GNSS + coarse EGM96 correction; descent from 10 s GPS trend",
  "terrain.instrument": "Altitude/descent: current pilot instrument readings",
  "terrain.prepare": "Cache terrain for flight route",
  "terrain.cached": {
    one: "Terrain cached: {count} tile; unavailable: {missing}",
    other: "Terrain cached: {count} tiles; unavailable: {missing}",
  } as Message,
  "terrain.noRoute": "Add route points or enable GPS to download terrain",
  "terrain.error3d": "3D terrain tile unavailable; use 2D if relief is missing",
};
export const terrainPl: Record<keyof typeof terrainEn, Message> = {
  "terrain.3d": "Teren 3D",
  "terrain.source":
    "Teren: Mapzen / AWS · Copernicus EU-DEM, USGS i inni dostawcy",
  "terrain.attribution": "Źródła i licencje danych terenu",
  "terrain.loading": "Pobieranie terenu / obliczanie zasięgu dolotu…",
  "terrain.missing":
    "Teren niedostępny / niepełny — obszary bez danych są wykluczone",
  "terrain.windMissing":
    "Wiatr niedostępny — wprowadź go poniżej lub poczekaj na aktualny pomiar",
  "terrain.ready":
    "Zasięg z terenem i wiatrem · siatka {resolution} m · zapas {clearance} ft",
  "terrain.limited":
    "Osiągnięto granicę obliczeń; dalszy zasięg nie został oceniony",
  "terrain.model":
    "Model bieżącego trendu, bez biegunowej samolotu. Wiatr stały; bez termiki, budynków, przewodów i gwarancji lądowania. Zakręty uwzględniają utratę czasu i ostrożną obwiednię terenu.",
  "terrain.windFrom": "Wiatr Z kierunku (° geograficzne)",
  "terrain.windSpeed": "Prędkość wiatru (kt)",
  "terrain.applyWind": "Użyj tego wiatru (0 kt potwierdza ciszę)",
  "terrain.clearance": "Zapas nad terenem (ft)",
  "terrain.liveWind": "Wiatr: aktualne oszacowanie z GPS",
  "terrain.manualWind": "Wiatr: dane pilota (ważne 10 min)",
  "terrain.noInputs":
    "Zasięg niedostępny — wymagane aktualne AMSL, opadanie, GS, track i wiatr",
  "terrain.gps":
    "Wysokość: GNSS + zgrubna korekta EGM96; opadanie z trendu GPS 10 s",
  "terrain.instrument":
    "Wysokość/opadanie: bieżące wskazania przyrządów podane przez pilota",
  "terrain.prepare": "Zapisz teren dla trasy offline",
  "terrain.cached": {
    one: "Zapisano teren: {count} kafelek; niedostępne: {missing}",
    few: "Zapisano teren: {count} kafelki; niedostępne: {missing}",
    many: "Zapisano teren: {count} kafelków; niedostępne: {missing}",
    other: "Zapisano teren: {count} kafelka; niedostępne: {missing}",
  },
  "terrain.noRoute": "Dodaj punkty trasy lub włącz GPS, aby pobrać teren",
  "terrain.error3d":
    "Brak kafelka terenu 3D; przełącz na 2D, jeśli brakuje rzeźby",
};
