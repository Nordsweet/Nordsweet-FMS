// React view; original controls and IDs are preserved for the flight engine.

export default function GroundEditorView(){return (<><style>{"\n:root {\n  --bg: #07111f;\n  --card: rgba(13, 26, 44, 0.94);\n  --card-soft: rgba(255, 255, 255, 0.045);\n  --line: rgba(143, 193, 255, 0.18);\n  --line-strong: rgba(143, 193, 255, 0.34);\n  --text: #edf7ff;\n  --muted: #9fb0c6;\n  --accent: #76f2a4;\n  --blue: #7fc7ff;\n  --danger: #ff6c7a;\n  --chip: 4.2rem;\n}\n\n* {\n  box-sizing: border-box;\n}\n\nbody {\n  margin: 0;\n  min-height: 100vh;\n  color: var(--text);\n  background:\n    radial-gradient(circle at 18% 10%, rgba(118, 242, 164, 0.14), transparent 30rem),\n    radial-gradient(circle at 82% 6%, rgba(127, 199, 255, 0.14), transparent 28rem),\n    linear-gradient(145deg, #06101d, #0a1424 45%, #050a12);\n  font-family: \"Segoe UI\", sans-serif;\n}\n\n.app {\n  width: min(1180px, calc(100% - 2rem));\n  margin: 0 auto;\n  padding: 1.2rem 0 2rem;\n}\n\n.hero,\n.panel {\n  border: 1px solid var(--line);\n  border-radius: 22px;\n  background: var(--card);\n  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);\n}\n\n.hero {\n  padding: 1.1rem;\n  margin-bottom: 1rem;\n}\n\n.hero h1 {\n  margin: 0.3rem 0 0.35rem;\n  font-size: clamp(1.7rem, 3.8vw, 3rem);\n}\n\n.hero p,\n.help {\n  color: var(--muted);\n  line-height: 1.45;\n}\n\n.panel {\n  padding: 1rem;\n}\n\n.grid {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 0.85rem;\n}\n\n.add-thing-grid {\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n}\n\n.editor-layout {\n  display: grid;\n  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);\n  gap: 0.85rem;\n  margin-top: 0.85rem;\n}\n\nlabel {\n  display: block;\n  margin: 0 0 0.28rem;\n  color: var(--muted);\n  font-size: 0.78rem;\n  font-weight: 800;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n}\n\nselect,\ninput,\ntextarea,\nbutton {\n  width: 100%;\n  border: 1px solid var(--line);\n  border-radius: 14px;\n  color: var(--text);\n  background: rgba(255, 255, 255, 0.06);\n  font: inherit;\n}\n\nselect,\ninput,\ntextarea {\n  padding: 0.75rem;\n}\n\nselect {\n  color-scheme: dark;\n  background-color: #101d2f;\n}\n\nselect option {\n  color: #06101b;\n  background: #f4f8ff;\n}\n\nbutton {\n  min-height: 2.9rem;\n  padding: 0.7rem 0.9rem;\n  font-weight: 900;\n  letter-spacing: 0.06em;\n  text-transform: uppercase;\n  cursor: pointer;\n}\n\nbutton.primary {\n  color: #06101b;\n  background: linear-gradient(135deg, rgba(118, 242, 164, 0.98), rgba(127, 199, 255, 0.92));\n}\n\nbutton.secondary {\n  background: rgba(127, 199, 255, 0.12);\n}\n\ndetails.weather-source-options {\n  border: 1px solid var(--line);\n  border-radius: 14px;\n  background: rgba(127, 199, 255, 0.08);\n}\n\ndetails.weather-source-options summary {\n  min-height: 2.9rem;\n  padding: 0.78rem 0.9rem;\n  font-weight: 900;\n  letter-spacing: 0.06em;\n  list-style: none;\n  text-transform: uppercase;\n  cursor: pointer;\n}\n\ndetails.weather-source-options summary::-webkit-details-marker {\n  display: none;\n}\n\ndetails.weather-source-options .weather-source-options-body {\n  padding: 0 0.75rem 0.75rem;\n}\n\nbutton.danger {\n  background: rgba(255, 108, 122, 0.15);\n  border-color: rgba(255, 108, 122, 0.34);\n}\n\n#addAirportBtn {\n  margin-top: 0.55rem;\n}\n\n.tab-row {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 0.55rem;\n}\n\n.tab-button {\n  width: auto;\n  min-width: 10rem;\n  background: rgba(127, 199, 255, 0.12);\n}\n\n.tab-button.active {\n  color: #06101b;\n  background: linear-gradient(135deg, rgba(118, 242, 164, 0.98), rgba(127, 199, 255, 0.92));\n}\n\n.stack {\n  display: grid;\n  gap: 0.75rem;\n}\n\n.actions {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 0.55rem;\n}\n\n.runway-editor {\n  display: grid;\n  gap: 0.65rem;\n}\n\n.runway-editor-row {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(5.25rem, 1fr));\n  gap: 0.45rem;\n  align-items: end;\n}\n\n.runway-editor-row + .runway-editor-row {\n  padding-top: 0.45rem;\n  border-top: 1px solid var(--line);\n}\n\n.runway-editor-row button {\n  min-height: 2.75rem;\n}\n\n.connection-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(var(--chip), var(--chip)));\n  gap: 0.45rem;\n  justify-content: start;\n  padding: 0.75rem;\n  border: 1px solid var(--line);\n  border-radius: 18px;\n  background: var(--card-soft);\n}\n\n.chart-map-panel {\n  grid-column: 1 / -1;\n}\n\n.chart-map-actions {\n  display: grid;\n  grid-template-columns: minmax(11rem, 14rem) minmax(0, 1fr) auto;\n  gap: 0.65rem;\n  align-items: end;\n}\n\n.chart-map-actions input[type=\"file\"] {\n  min-height: 2.9rem;\n}\n\n.chart-route-panel {\n  display: grid;\n  gap: 0.45rem;\n  padding: 0.75rem;\n  border: 1px solid var(--line);\n  border-radius: 18px;\n  background: var(--card-soft);\n}\n\n.chart-map {\n  position: relative;\n  aspect-ratio: var(--chart-aspect-ratio, 16 / 9);\n  min-height: 0;\n  overflow: hidden;\n  border: 1px solid var(--line);\n  border-radius: 18px;\n  background:\n    linear-gradient(135deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.015)),\n    #081421;\n  cursor: crosshair;\n}\n\n.chart-map.panning {\n  cursor: grabbing;\n}\n\n.chart-map-controls {\n  position: absolute;\n  top: 0.7rem;\n  left: 0.7rem;\n  z-index: 30;\n  display: inline-grid;\n  grid-template-columns: repeat(3, 2.25rem);\n  gap: 0.35rem;\n  padding: 0.35rem;\n  border: 1px solid var(--line-strong);\n  border-radius: 14px;\n  background: rgba(6, 16, 27, 0.9);\n  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.34);\n  pointer-events: auto;\n}\n\n.chart-map-controls button {\n  width: 2.25rem;\n  min-width: 2.25rem;\n  height: 2.25rem;\n  min-height: 2.25rem;\n  padding: 0;\n  border-radius: 10px;\n  font-size: 0.9rem;\n  background: rgba(255, 255, 255, 0.08);\n}\n\n.chart-map-layer {\n  position: absolute;\n  top: 0;\n  left: 0;\n  z-index: 1;\n  width: 800%;\n  height: 800%;\n  transform-origin: 0 0;\n  will-change: transform;\n}\n\n.chart-pdf-frame,\n.chart-overlay-svg {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n}\n\n.chart-pdf-frame {\n  border: 0;\n  background: rgba(255, 255, 255, 0.03);\n  pointer-events: none;\n}\n\n.chart-overlay-svg {\n  z-index: 2;\n  touch-action: none;\n}\n\n.chart-floating-editor {\n  position: absolute;\n  z-index: 40;\n  top: 1rem;\n  right: 1rem;\n  width: min(30rem, calc(100% - 2rem));\n  max-height: calc(100% - 2rem);\n  overflow: auto;\n  padding: 0.85rem;\n  border: 1px solid var(--line-strong);\n  border-radius: 18px;\n  background: rgba(6, 16, 27, 0.94);\n  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.4);\n}\n\n.chart-floating-header {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  gap: 0.55rem;\n  align-items: start;\n  margin-bottom: 0.7rem;\n}\n\n.chart-floating-header strong {\n  display: block;\n}\n\n.chart-floating-close {\n  width: var(--chip);\n  min-width: var(--chip);\n  height: var(--chip);\n  min-height: var(--chip);\n  padding: 0.35rem;\n  color: #ffffff;\n  background: rgba(255, 108, 122, 0.16);\n  border-color: rgba(255, 108, 122, 0.34);\n}\n\n.chart-overlay-hitbox {\n  fill: transparent;\n  pointer-events: all;\n}\n\n.chart-overlay-grid {\n  stroke: rgba(127, 199, 255, 0.16);\n}\n\n.chart-route-halo {\n  fill: none;\n  stroke: rgba(118, 242, 164, 0.26);\n  stroke-linecap: round;\n  stroke-linejoin: round;\n  pointer-events: none;\n}\n\n.chart-route-line {\n  fill: none;\n  stroke: #76f2a4;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n  pointer-events: none;\n}\n\n.chart-route-point {\n  fill: #06101b;\n  stroke: #76f2a4;\n  pointer-events: none;\n}\n\n.taxiway-path-line {\n  fill: none;\n  stroke: #7fc7ff;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n  pointer-events: none;\n}\n\n.taxiway-path-halo {\n  fill: none;\n  stroke: rgba(5, 10, 18, 0.78);\n  stroke-linecap: round;\n  stroke-linejoin: round;\n  pointer-events: none;\n}\n\n.taxiway-path-point {\n  fill: #06101b;\n  stroke: #7fc7ff;\n  pointer-events: none;\n}\n\n.taxiway-path-point.endpoint {\n  fill: #7fc7ff;\n  stroke: #06101b;\n}\n\n.vfr-circuit-line {\n  fill: none;\n  stroke: #ff6c7a;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n  pointer-events: none;\n}\n\n.vfr-circuit-halo {\n  fill: none;\n  stroke: rgba(5, 10, 18, 0.78);\n  stroke-linecap: round;\n  stroke-linejoin: round;\n  pointer-events: none;\n}\n\n.vfr-circuit-point {\n  fill: #06101b;\n  stroke: #ff6c7a;\n  pointer-events: none;\n}\n\n.vfr-circuit-point.endpoint {\n  fill: #ff6c7a;\n  stroke: #06101b;\n}\n\n.taxiway-path-panel {\n  display: grid;\n  gap: 0.65rem;\n  padding: 0.75rem;\n  border: 1px solid var(--line);\n  border-radius: 18px;\n  background: var(--card-soft);\n}\n\n.taxiway-path-actions {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: 0.55rem;\n}\n\n.taxiway-path-validation {\n  padding: 0.68rem 0.78rem;\n  border: 1px solid rgba(255, 208, 138, 0.34);\n  border-radius: 14px;\n  color: #ffd08a;\n  background: rgba(255, 208, 138, 0.08);\n}\n\n.intersection-marker {\n  cursor: grab;\n}\n\n.intersection-marker.dragging {\n  cursor: grabbing;\n}\n\n.intersection-marker .intersection-hitbox {\n  fill: transparent;\n  stroke: transparent;\n  stroke-width: 22;\n  pointer-events: stroke;\n}\n\n.intersection-marker .intersection-cross-halo {\n  stroke: rgba(5, 10, 18, 0.56);\n  stroke-width: 8;\n  stroke-linecap: round;\n  pointer-events: none;\n}\n\n.intersection-marker .intersection-cross {\n  stroke: rgba(118, 242, 164, 0.62);\n  stroke-width: 3.6;\n  stroke-linecap: round;\n  pointer-events: none;\n}\n\n.intersection-marker.dragging .intersection-cross,\n.intersection-marker.active .intersection-cross {\n  stroke: #ffdf8a;\n  stroke-width: 4.4;\n}\n\n.intersection-marker.dragging .intersection-cross-halo,\n.intersection-marker.active .intersection-cross-halo {\n  stroke: rgba(5, 10, 18, 0.86);\n}\n\n.chart-file-input {\n  min-height: 2.9rem;\n}\n\n.chip {\n  width: var(--chip);\n  min-width: var(--chip);\n  height: var(--chip);\n  min-height: var(--chip);\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  text-align: center;\n  padding: 0.4rem;\n  border-radius: 14px;\n  font-size: 0.75rem;\n  overflow-wrap: anywhere;\n}\n\n.chip.active {\n  color: #06101b;\n  background: linear-gradient(135deg, rgba(118, 242, 164, 0.98), rgba(127, 199, 255, 0.92));\n  border-color: rgba(255, 255, 255, 0.42);\n}\n\n.meta {\n  display: grid;\n  gap: 0.45rem;\n  padding: 0.75rem;\n  border: 1px solid var(--line);\n  border-radius: 18px;\n  background: var(--card-soft);\n}\n\n.status {\n  min-height: 2.7rem;\n  padding: 0.72rem 0.85rem;\n  border: 1px solid var(--line);\n  border-radius: 14px;\n  color: var(--muted);\n  background: rgba(255, 255, 255, 0.04);\n}\n\n.status.ok {\n  color: var(--accent);\n  border-color: rgba(118, 242, 164, 0.28);\n}\n\n.status.warn {\n  color: #ffd08a;\n  border-color: rgba(255, 208, 138, 0.34);\n}\n\n.export {\n  min-height: 24rem;\n  font-family: Consolas, \"SFMono-Regular\", monospace;\n  font-size: 0.76rem;\n  line-height: 1.45;\n}\n\n@media (max-width: 900px) {\n  .grid,\n  .add-thing-grid,\n  .editor-layout,\n  .actions,\n  .chart-map-actions,\n  .runway-editor-row {\n    grid-template-columns: 1fr;\n  }\n}\n"}</style>
<main className={"app"}>
<section className={"hero"}>
<span className={"help"}>{"Local-only developer tool"}</span>
<h1>{"Nordsweet Ground Data Editor"}</h1>
<p>{"\n      This file is intentionally separate from the public app. Use it locally to edit\n      "}<strong>{"ground-data.js"}</strong>{", then put that database file into the release package.\n    "}</p>
</section>
<section className={"panel stack"}>
<div className={"grid"}>
<div>
<label htmlFor={"airportSelect"}>{"Airport"}</label>
<select id={"airportSelect"}></select>
<button id={"addAirportBtn"} type={"button"} className={"secondary"}>{"Add New Airport"}</button>
</div>
<div>
<label htmlFor={"thingSelect"}>{"Thing"}</label>
<select id={"thingSelect"}></select>
</div>
<div>
<label htmlFor={"typeSelect"}>{"New thing type"}</label>
<select id={"typeSelect"}></select>
</div>
</div>
<div className={"grid add-thing-grid"}>
<div>
<label htmlFor={"newThingInput"}>{"Add thing"}</label>
<input id={"newThingInput"} autoComplete={"off"} placeholder={"np. F, HP07, B1"} />
</div>
<div>
<label htmlFor={"newThingLabelInput"}>{"Optional label"}</label>
<input id={"newThingLabelInput"} autoComplete={"off"} placeholder={"np. Taxiway F"} />
</div>
<div>
<label htmlFor={"newThingGroupSelect"}>{"Group / apron"}</label>
<select id={"newThingGroupSelect"}></select>
</div>
<div data-new-vor-field={""} hidden={true}>
<label htmlFor={"newThingVorCodeInput"}>{"VOR code"}</label>
<input id={"newThingVorCodeInput"} autoComplete={"off"} maxLength={3} placeholder={"np. KRK"} />
</div>
<div data-new-vor-field={""} hidden={true}>
<label htmlFor={"newThingVorFrequencyInput"}>{"VOR frequency"}</label>
<input id={"newThingVorFrequencyInput"} autoComplete={"off"} inputMode={"decimal"} placeholder={"np. 115.800"} />
</div>
<div>
<label>
</label>
<button id={"addThingBtn"} type={"button"} className={"secondary"}>{"Add thing"}</button>
</div>
</div>
<div className={"actions"}>
<button id={"openFileBtn"} type={"button"} className={"secondary"}>{"Open ground-data.js"}</button>
<button id={"saveFileBtn"} type={"button"} className={"primary"}>{"Save selected file"}</button>
<button id={"downloadBtn"} type={"button"} className={"secondary"}>{"Download ground-data.js"}</button>
</div>
<div id={"status"} className={"status"}>{"Loaded default data from ground-data.js in this folder."}</div>
</section>
<section className={"panel stack"}>
<div className={"meta"}>
<strong>{"Airport / Runways"}</strong>
<span className={"help"}>{"These values are written into ground-data.js and loaded by index.html for performance calculations."}</span>
</div>
<div className={"grid"}>
<div>
<label htmlFor={"airportNameInput"}>{"Airport name"}</label>
<input id={"airportNameInput"} autoComplete={"off"} placeholder={"np. Krakow"} />
</div>
<div>
<label htmlFor={"airportElevationInput"}>{"Elevation [ft]"}</label>
<input id={"airportElevationInput"} type={"number"} step={"1"} inputMode={"numeric"} />
</div>
<div>
<label htmlFor={"airportAtisProfileInput"}>{"ATIS profile"}</label>
<input id={"airportAtisProfileInput"} autoComplete={"off"} placeholder={"PL"} />
</div>
</div>
<div className={"grid"}>
<div>
<label htmlFor={"airportLatInput"}>{"ARP Latitude / Coordinate"}</label>
<input id={"airportLatInput"} autoComplete={"off"} placeholder={"50°04'40\" N or 50.077778"} />
</div>
<div>
<label htmlFor={"airportLonInput"}>{"ARP Longitude"}</label>
<input id={"airportLonInput"} autoComplete={"off"} placeholder={"019°47'05\" E or 19.784722"} />
</div>
<div>
<label htmlFor={"airportSampleMetarInput"}>{"Sample METAR"}</label>
<input id={"airportSampleMetarInput"} autoComplete={"off"} placeholder={"EPXX 241000Z 36008KT 9999 SCT025 16/07 Q1013"} />
</div>
</div>
<div className={"grid"}>
<div>
<label htmlFor={"airportWeatherSourceInput"}>{"Fetch D-ATIS/METAR from"}</label>
<input id={"airportWeatherSourceInput"} autoComplete={"off"} maxLength={4} placeholder={"blank = this airport"} />
</div>
<div>
<label>
</label>
<details className={"weather-source-options"}>
<summary>{"Options"}</summary>
<div className={"weather-source-options-body"}>
<label htmlFor={"airportTemperatureOffsetInput"}>{"Change Temperature by [C]"}</label>
<input id={"airportTemperatureOffsetInput"} type={"number"} step={"1"} inputMode={"numeric"} placeholder={"0"} />
</div>
</details>
</div>
</div>
<div className={"runway-editor"}>
<div className={"meta"}>
<strong>{"Runways"}</strong>
<span id={"airportRunwayMeta"} className={"help"}>{"Add runway directions and declared distances. TORA/TODA/ASDA/LDA are in meters."}</span>
</div>
<div id={"airportRunways"}></div>
<div className={"actions"}>
<button id={"addRunwayBtn"} type={"button"} className={"secondary"}>{"Add runway"}</button>
<button id={"saveAirportProfileBtn"} type={"button"} className={"primary"}>{"Save airport data"}</button>
</div>
</div>
</section>
<div className={"tab-row"} role={"tablist"} aria-label={"Ground editor sections"}>
<button id={"networkTabBtn"} type={"button"} className={"tab-button active"} data-editor-tab={"network"}>{"Ground Network"}</button>
<button id={"chartTabBtn"} type={"button"} className={"tab-button"} data-editor-tab={"chart"}>{"Chart Overlay"}</button>
</div>
<section id={"networkTabPanel"} className={"editor-layout"}>
<div className={"panel stack"}>
<div className={"meta"}>
<strong id={"thingTitle"}>{"No thing selected"}</strong>
<span id={"thingMeta"} className={"help"}>{"Choose an airport and a thing."}</span>
</div>
<div className={"grid"}>
<div>
<label htmlFor={"thingLabelInput"}>{"Selected label"}</label>
<input id={"thingLabelInput"} autoComplete={"off"} placeholder={"np. Taxiway F"} />
</div>
<div data-selected-vor-field={""} hidden={true}>
<label htmlFor={"thingVorCodeInput"}>{"VOR code"}</label>
<input id={"thingVorCodeInput"} autoComplete={"off"} maxLength={3} placeholder={"np. KRK"} />
</div>
<div data-selected-vor-field={""} hidden={true}>
<label htmlFor={"thingVorFrequencyInput"}>{"VOR frequency"}</label>
<input id={"thingVorFrequencyInput"} autoComplete={"off"} inputMode={"decimal"} placeholder={"np. 115.800"} />
</div>
<div>
<label>
</label>
<button id={"updateThingBtn"} type={"button"} className={"primary"}>{"Update thing"}</button>
</div>
</div>
<div>
<label>{"Connections"}</label>
<div id={"connections"} className={"connection-grid"}></div>
</div>
<div className={"help"}>{"\n        Connections are saved bidirectionally. Example: choose "}<strong>{"EPKK"}</strong>{", choose\n        "}<strong>{"F"}</strong>{", then click "}<strong>{"HP07"}</strong>{" and "}<strong>{"B1"}</strong>{".\n        Stands can connect only with taxiways.\n      "}</div>
</div>
<div className={"panel stack"}>
<label htmlFor={"exportText"}>{"Generated ground-data.js"}</label>
<textarea id={"exportText"} className={"export"} spellCheck={"false"} defaultValue={""}></textarea>
</div>
</section>
<section id={"chartTabPanel"} className={"editor-layout"} hidden={true}>
<div className={"panel stack chart-map-panel"}>
<div className={"meta"}>
<strong>{"Chart map"}</strong>
<span id={"chartMapMeta"} className={"help"}>{"Click the chart to create an intersection. Drag an existing intersection to move it."}</span>
</div>
<div className={"chart-map-actions"}>
<div>
<label htmlFor={"chartSourceSelect"}>{"Chart source"}</label>
<select id={"chartSourceSelect"}></select>
</div>
<div>
<label htmlFor={"chartPdfInput"}>{"Chart PDF"}</label>
<input id={"chartPdfInput"} className={"chart-file-input"} type={"file"} accept={"application/pdf"} />
</div>
<button id={"clearChartSelectionBtn"} type={"button"} className={"secondary"}>{"Clear selection"}</button>
</div>
<div className={"chart-route-panel"}>
<label htmlFor={"chartRouteInput"}>{"Route preview"}</label>
<input id={"chartRouteInput"} autoComplete={"off"} placeholder={"np. Stand 2L -> W -> B -> A -> HP25"} />
<div id={"chartRouteMeta"} className={"help"}>{"Enter routing to draw it through chart intersections."}</div>
</div>
<div id={"chartMap"} className={"chart-map"} aria-label={"Interactive airport chart overlay"}>
<div className={"chart-map-controls"} aria-label={"Chart zoom controls"}>
<button type={"button"} data-chart-zoom={"in"} aria-label={"Zoom in"}>{"+"}</button>
<button type={"button"} data-chart-zoom={"out"} aria-label={"Zoom out"}>{"-"}</button>
<button type={"button"} data-chart-zoom={"reset"} aria-label={"Reset chart zoom"}>{"R"}</button>
</div>
<div id={"chartMapLayer"} className={"chart-map-layer"} data-chart-map-layer={""}>
<object id={"chartPdfFrame"} className={"chart-pdf-frame"} type={"application/pdf"} aria-label={"Airport chart"}></object>
<svg id={"chartOverlaySvg"} className={"chart-overlay-svg"} viewBox={"0 0 1000 1000"} preserveAspectRatio={"none"} aria-label={"Intersection overlay"}></svg>
</div>
<div id={"chartFloatingEditor"} className={"chart-floating-editor"} hidden={true}>
<div className={"chart-floating-header"}>
<div>
<strong id={"chartFloatingTitle"}>{"Intersection"}</strong>
<span id={"chartFloatingMeta"} className={"help"}>{"Select crossing taxiways."}</span>
</div>
<button id={"closeChartFloatingEditorBtn"} type={"button"} className={"chart-floating-close"}>{"Close"}</button>
</div>
<label>{"Crossing elements"}</label>
<div id={"chartFloatingMembers"} className={"connection-grid"}></div>
</div>
</div>
<div className={"taxiway-path-panel"}>
<div className={"meta"}>
<strong>{"Taxiway path builder"}</strong>
<span id={"taxiwayPathMeta"} className={"help"}>{"Choose a taxiway, start drawing, then click existing intersections or empty chart points in driving order. First and last points are both taxiway ends."}</span>
</div>
<div className={"grid"}>
<div>
<label htmlFor={"taxiwayPathSelect"}>{"Taxiway"}</label>
<select id={"taxiwayPathSelect"}></select>
</div>
<div>
<label htmlFor={"taxiwayPathPointCount"}>{"Path points"}</label>
<input id={"taxiwayPathPointCount"} type={"text"} readOnly={true} defaultValue={"0"} />
</div>
<div>
<label>
</label>
<button id={"startTaxiwayPathBtn"} type={"button"} className={"primary"}>{"Start drawing"}</button>
</div>
</div>
<div className={"taxiway-path-actions"}>
<button id={"stopTaxiwayPathBtn"} type={"button"} className={"secondary"}>{"Stop"}</button>
<button id={"undoTaxiwayPathPointBtn"} type={"button"} className={"secondary"}>{"Undo point"}</button>
<button id={"clearTaxiwayPathBtn"} type={"button"} className={"danger"}>{"Clear path"}</button>
<button id={"useSelectedTaxiwayBtn"} type={"button"} className={"secondary"}>{"Use selected thing"}</button>
</div>
<div id={"taxiwayPathValidation"} className={"taxiway-path-validation"} hidden={true}></div>
</div>
<div className={"taxiway-path-panel"} hidden={true}>
<div className={"meta"}>
<strong>{"VFR circuit builder"}</strong>
<span id={"vfrCircuitMeta"} className={"help"}>{"Create a VFR airport traffic circuit from chart intersections or raw chart points. Draw downwind, base, final and any published visual reporting points in sequence."}</span>
</div>
<div className={"grid"}>
<div>
<label htmlFor={"vfrCircuitSelect"}>{"Circuit"}</label>
<select id={"vfrCircuitSelect"}></select>
</div>
<div>
<label htmlFor={"vfrCircuitIdInput"}>{"ID"}</label>
<input id={"vfrCircuitIdInput"} autoComplete={"off"} placeholder={"RWY25-L"} />
</div>
<div>
<label htmlFor={"vfrCircuitPointCount"}>{"Points"}</label>
<input id={"vfrCircuitPointCount"} type={"text"} readOnly={true} defaultValue={"0"} />
</div>
</div>
<div className={"grid"}>
<div>
<label htmlFor={"vfrCircuitRunwayInput"}>{"Runway"}</label>
<input id={"vfrCircuitRunwayInput"} autoComplete={"off"} placeholder={"25"} />
</div>
<div>
<label htmlFor={"vfrCircuitDirectionSelect"}>{"Direction"}</label>
<select id={"vfrCircuitDirectionSelect"}>
<option value={"LEFT"}>{"Left-hand"}</option>
<option value={"RIGHT"}>{"Right-hand"}</option>
<option value={"BOTH"}>{"Both / as published"}</option>
</select>
</div>
<div>
<label>
</label>
<button id={"saveVfrCircuitBtn"} type={"button"} className={"primary"}>{"Save circuit"}</button>
</div>
</div>
<div className={"taxiway-path-actions"}>
<button id={"startVfrCircuitBtn"} type={"button"} className={"primary"}>{"Start drawing"}</button>
<button id={"stopVfrCircuitBtn"} type={"button"} className={"secondary"}>{"Stop"}</button>
<button id={"undoVfrCircuitPointBtn"} type={"button"} className={"secondary"}>{"Undo point"}</button>
<button id={"clearVfrCircuitBtn"} type={"button"} className={"danger"}>{"Clear circuit"}</button>
</div>
</div>
</div>
<div className={"panel stack"}>
<div className={"meta"}>
<strong>{"Chart overlay editor"}</strong>
<span className={"help"}>{"Create intersections for chart routing. One stand member marks the stand position; stand + taxiway marks a stand exit. One taxiway only is a centerline shaping point."}</span>
</div>
<div>
<label htmlFor={"intersectionSelect"}>{"Intersection"}</label>
<select id={"intersectionSelect"}></select>
</div>
<div className={"grid"}>
<div>
<label htmlFor={"intersectionIdInput"}>{"Intersection ID"}</label>
<input id={"intersectionIdInput"} autoComplete={"off"} placeholder={"INT-F-B1"} />
</div>
<div>
<label htmlFor={"intersectionXInput"}>{"Overlay X (0-1000)"}</label>
<input id={"intersectionXInput"} type={"number"} min={"0"} max={"1000"} step={"0.001"} defaultValue={"0"} />
</div>
<div>
<label htmlFor={"intersectionYInput"}>{"Overlay Y (0-1000)"}</label>
<input id={"intersectionYInput"} type={"number"} min={"0"} max={"1000"} step={"0.001"} defaultValue={"0"} />
</div>
</div>
<div>
<label htmlFor={"intersectionLabelInput"}>{"Optional label"}</label>
<input id={"intersectionLabelInput"} autoComplete={"off"} placeholder={"F / B1"} />
</div>
<div className={"actions"}>
<button id={"addIntersectionBtn"} type={"button"} className={"secondary"}>{"Add intersection"}</button>
<button id={"updateIntersectionBtn"} type={"button"} className={"primary"}>{"Update selected"}</button>
<button id={"deleteIntersectionBtn"} type={"button"} className={"danger"}>{"Delete selected"}</button>
</div>
</div>
<div className={"panel stack"}>
<div className={"meta"}>
<strong id={"intersectionTitle"}>{"No intersection selected"}</strong>
<span id={"intersectionMeta"} className={"help"}>{"Choose or add an intersection, then select crossing elements."}</span>
</div>
<div>
<label>{"Crossing elements"}</label>
<div id={"intersectionMembers"} className={"connection-grid"}></div>
</div>
<div className={"help"}>{"\n        Example routing: "}<strong>{"HP07-F-B-G-Z-Stand1"}</strong>{" can be resolved via intersections like\n        "}<strong>{"F/B1"}</strong>{", "}<strong>{"B1/B2"}</strong>{", "}<strong>{"B4/G"}</strong>{", "}<strong>{"G/Z1"}</strong>{" and\n        "}<strong>{"Z1/Stand1"}</strong>{". Add single-member points like "}<strong>{"Z3"}</strong>{" when the line needs to follow a bend between two crossings.\n      "}</div>
</div>
</section>
</main>


</>);}
