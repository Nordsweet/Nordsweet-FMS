// React view; original controls and IDs are preserved for the flight engine.

export default function WaypointProcedureEditorView(){return (<><style>{"\n:root {\n  --bg: #07111f;\n  --card: rgba(13, 26, 44, 0.94);\n  --soft: rgba(255, 255, 255, 0.055);\n  --line: rgba(143, 193, 255, 0.18);\n  --line-strong: rgba(143, 193, 255, 0.34);\n  --text: #edf7ff;\n  --muted: #9fb0c6;\n  --accent: #76f2a4;\n  --blue: #7fc7ff;\n  --danger: #ff6c7a;\n  --warning: #ffd08a;\n}\n\n* {\n  box-sizing: border-box;\n}\n\nbody {\n  margin: 0;\n  min-height: 100vh;\n  color: var(--text);\n  background:\n    radial-gradient(circle at 16% 8%, rgba(118, 242, 164, 0.14), transparent 30rem),\n    radial-gradient(circle at 84% 10%, rgba(127, 199, 255, 0.15), transparent 28rem),\n    linear-gradient(145deg, #06101d, #0a1424 45%, #050a12);\n  font-family: \"Segoe UI\", sans-serif;\n}\n\n.app {\n  width: min(1240px, calc(100% - 2rem));\n  margin: 0 auto;\n  padding: 1.2rem 0 2rem;\n}\n\n.hero,\n.panel,\n.status,\n.export {\n  border: 1px solid var(--line);\n  border-radius: 22px;\n  background: var(--card);\n  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);\n}\n\n.hero {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) minmax(22rem, 0.85fr);\n  gap: 1rem;\n  align-items: end;\n  padding: 1.1rem;\n  margin-bottom: 1rem;\n}\n\n.hero h1 {\n  margin: 0.2rem 0 0.35rem;\n  font-size: clamp(1.8rem, 4vw, 3.1rem);\n}\n\n.hero p,\n.help {\n  margin: 0;\n  color: var(--muted);\n  line-height: 1.45;\n}\n\n.kicker {\n  color: var(--blue);\n  font-size: 0.76rem;\n  font-weight: 900;\n  letter-spacing: 0.12em;\n  text-transform: uppercase;\n}\n\n.toolbar {\n  display: grid;\n  grid-template-columns: minmax(9rem, 1fr) repeat(3, minmax(8rem, auto));\n  gap: 0.55rem;\n  align-items: end;\n}\n\n.panel {\n  padding: 1rem;\n}\n\n.top-row,\n.tabs,\n.actions,\n.mini-actions,\n.leg-actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 0.55rem;\n}\n\n.tabs {\n  margin-bottom: 0.85rem;\n}\n\n.layout {\n  display: grid;\n  grid-template-columns: minmax(20rem, 0.9fr) minmax(0, 1.1fr);\n  gap: 0.85rem;\n}\n\n.stack {\n  display: grid;\n  gap: 0.75rem;\n}\n\n.grid {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 0.65rem;\n}\n\n.grid.three {\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n}\n\n.grid.four {\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n}\n\n.restriction-grid {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 0.65rem;\n}\n\n.restriction-tile {\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr) minmax(6rem, 0.45fr);\n  gap: 0.5rem;\n  align-items: end;\n  padding: 0.65rem;\n  border: 1px solid var(--line);\n  border-radius: 14px;\n  background: rgba(255, 255, 255, 0.04);\n}\n\n.restriction-tile strong {\n  align-self: center;\n  min-width: 3.1rem;\n  color: var(--accent);\n  font-size: 0.84rem;\n  letter-spacing: 0.1em;\n}\n\n.static-field {\n  min-height: 2.8rem;\n  padding: 0.75rem;\n  border: 1px solid var(--line);\n  border-radius: 14px;\n  color: var(--muted);\n  background: rgba(255, 255, 255, 0.045);\n}\n\n.threshold-coordinate-list {\n  display: grid;\n  gap: 0.4rem;\n  font-size: 0.82rem;\n}\n\n.threshold-coordinate-row {\n  display: grid;\n  grid-template-columns: minmax(3.8rem, 0.42fr) minmax(0, 1.1fr) minmax(0, 1fr);\n  gap: 0.5rem;\n  align-items: center;\n  padding: 0.45rem 0;\n  border-top: 1px solid rgba(127, 199, 255, 0.12);\n}\n\n.threshold-coordinate-row:first-child {\n  border-top: 0;\n  padding-top: 0;\n}\n\n.threshold-coordinate-row strong {\n  color: var(--accent);\n}\n\n.threshold-coordinate-row span {\n  min-width: 0;\n  overflow-wrap: anywhere;\n}\n\n.threshold-coordinate-row small {\n  display: block;\n  color: var(--muted);\n  font-weight: 700;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n}\n\nlabel {\n  display: block;\n  margin: 0 0 0.28rem;\n  color: var(--muted);\n  font-size: 0.78rem;\n  font-weight: 800;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n}\n\nselect,\ninput,\ntextarea,\nbutton {\n  width: 100%;\n  border: 1px solid var(--line);\n  border-radius: 14px;\n  color: var(--text);\n  background: rgba(255, 255, 255, 0.06);\n  font: inherit;\n}\n\nselect,\ninput,\ntextarea {\n  padding: 0.75rem;\n}\n\nselect {\n  color-scheme: dark;\n  background-color: #101d2f;\n}\n\nselect option {\n  color: #06101b;\n  background: #f4f8ff;\n}\n\ntextarea {\n  min-height: 6.5rem;\n  resize: vertical;\n}\n\nbutton {\n  width: auto;\n  min-height: 2.9rem;\n  padding: 0.7rem 0.9rem;\n  font-weight: 900;\n  letter-spacing: 0.06em;\n  text-transform: uppercase;\n  cursor: pointer;\n}\n\nbutton.full {\n  width: 100%;\n}\n\nbutton.primary {\n  color: #06101b;\n  background: linear-gradient(135deg, rgba(118, 242, 164, 0.98), rgba(127, 199, 255, 0.92));\n}\n\nbutton.secondary {\n  background: rgba(127, 199, 255, 0.12);\n}\n\nbutton.danger {\n  background: rgba(255, 108, 122, 0.15);\n  border-color: rgba(255, 108, 122, 0.34);\n}\n\nbutton.active {\n  color: #06101b;\n  background: linear-gradient(135deg, rgba(118, 242, 164, 0.98), rgba(127, 199, 255, 0.92));\n}\n\nbutton.icon {\n  min-width: 2.7rem;\n  padding-inline: 0.6rem;\n}\n\nbutton:disabled,\ninput:disabled,\nselect:disabled,\ntextarea:disabled {\n  cursor: not-allowed;\n  opacity: 0.55;\n}\n\n.status {\n  min-height: 3.1rem;\n  padding: 0.85rem;\n  background: var(--soft);\n  color: var(--muted);\n  box-shadow: none;\n}\n\n.status.ok {\n  color: var(--accent);\n  border-color: rgba(118, 242, 164, 0.34);\n}\n\n.status.warn {\n  color: var(--warning);\n  border-color: rgba(255, 208, 138, 0.34);\n}\n\n.status.danger {\n  color: var(--danger);\n  border-color: rgba(255, 108, 122, 0.34);\n}\n\n.tab-panel[hidden],\n.approach-only[hidden],\n.dme-arc-only[hidden],\n.private-gate[hidden] {\n  display: none;\n}\n\n.private-gate {\n  margin-bottom: 1rem;\n}\n\n.item-list {\n  display: grid;\n  align-items: start;\n  grid-auto-rows: max-content;\n  gap: 0.55rem;\n  max-height: 34rem;\n  overflow: auto;\n  padding-right: 0.2rem;\n}\n\n.item-card,\n.leg-card,\n.empty-card,\n.export {\n  border: 1px solid var(--line);\n  border-radius: 18px;\n  background: var(--soft);\n}\n\n.item-card {\n  display: flex;\n  flex-direction: column;\n  gap: 0.4rem;\n  align-items: flex-start;\n  justify-content: flex-start;\n  min-height: 5.7rem;\n  padding: 0.75rem;\n  text-align: left;\n  cursor: pointer;\n  line-height: 1.25;\n}\n\n.item-card:focus-visible {\n  outline: 2px solid var(--blue);\n  outline-offset: 2px;\n}\n\n.item-card.active {\n  border-color: var(--line-strong);\n  background: rgba(127, 199, 255, 0.12);\n}\n\n.item-card strong,\n.leg-card strong {\n  letter-spacing: 0.04em;\n}\n\n.waypoint-card-title {\n  display: block;\n  width: 100%;\n  color: var(--text);\n  font-size: 1rem;\n  line-height: 1.25;\n}\n\n.meta-line {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 0.35rem;\n  align-items: center;\n  width: 100%;\n  color: var(--muted);\n  font-size: 0.9rem;\n  line-height: 1.3;\n}\n\n.waypoint-position {\n  min-width: min(100%, 12rem);\n  overflow-wrap: anywhere;\n  color: #b8d6ff;\n  font-weight: 800;\n  letter-spacing: 0.02em;\n}\n\n.pill {\n  display: inline-flex;\n  align-items: center;\n  min-height: 1.55rem;\n  padding: 0.18rem 0.48rem;\n  border: 1px solid rgba(127, 199, 255, 0.18);\n  border-radius: 999px;\n  color: var(--blue);\n  background: rgba(127, 199, 255, 0.08);\n  font-size: 0.78rem;\n  font-weight: 800;\n}\n\n.empty-card {\n  padding: 0.9rem;\n  color: var(--muted);\n}\n\n.leg-list {\n  display: grid;\n  gap: 0.55rem;\n}\n\n.leg-card {\n  display: grid;\n  grid-template-columns: 2.4rem minmax(0, 1fr) auto;\n  gap: 0.6rem;\n  align-items: center;\n  padding: 0.6rem;\n}\n\n.leg-index {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 2.1rem;\n  height: 2.1rem;\n  border-radius: 50%;\n  color: #06101b;\n  background: var(--blue);\n  font-weight: 900;\n}\n\n.export {\n  width: 100%;\n  min-height: 16rem;\n  box-shadow: none;\n  font: 0.82rem/1.45 Consolas, \"Cascadia Mono\", monospace;\n}\n\n.file-input {\n  position: absolute;\n  inline-size: 1px;\n  block-size: 1px;\n  overflow: hidden;\n  clip: rect(0 0 0 0);\n  white-space: nowrap;\n}\n\n.small {\n  width: 100%;\n  font-size: 0.86rem;\n  line-height: 1.35;\n  overflow-wrap: anywhere;\n}\n\n.restriction-line {\n  color: var(--warning);\n}\n\n#airportProcedureList {\n  gap: 0.7rem;\n}\n\n#airportProcedureList .item-card {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);\n  align-content: start;\n  min-height: 0;\n  height: auto;\n  overflow: hidden;\n}\n\n#airportProcedureList .item-card > * {\n  min-width: 0;\n}\n\n#airportProcedureList .item-card strong,\n#airportProcedureList .small {\n  display: block;\n  width: 100%;\n}\n\n.vfr-layout {\n  display: grid;\n  grid-template-columns: minmax(18rem, 0.62fr) minmax(0, 1.38fr);\n  gap: 0.85rem;\n}\n\n.chart-map {\n  --chart-aspect-ratio: 1.7777778;\n  position: relative;\n  min-height: 28rem;\n  aspect-ratio: var(--chart-aspect-ratio);\n  overflow: hidden;\n  border: 1px solid var(--line);\n  border-radius: 18px;\n  background: #f4f8ff;\n  touch-action: none;\n}\n\n.chart-map.panning {\n  cursor: grabbing;\n}\n\n.chart-map-layer {\n  position: absolute;\n  inset: 0;\n  transform-origin: 0 0;\n}\n\n.chart-pdf-frame,\n.chart-overlay-svg {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n}\n\n.chart-pdf-frame {\n  border: 0;\n  background: #fff;\n}\n\n.chart-overlay-svg {\n  z-index: 2;\n  pointer-events: auto;\n}\n\n.chart-map-controls {\n  position: absolute;\n  top: 0.75rem;\n  left: 0.75rem;\n  z-index: 4;\n  display: flex;\n  gap: 0.35rem;\n}\n\n.chart-map-controls button {\n  min-width: 2.4rem;\n  min-height: 2.4rem;\n  padding: 0.35rem;\n  border-radius: 12px;\n  color: var(--text);\n  background: rgba(6, 16, 29, 0.84);\n}\n\n.chart-overlay-hitbox {\n  fill: transparent;\n  pointer-events: all;\n}\n\n.chart-overlay-grid {\n  stroke: rgba(6, 16, 29, 0.24);\n  stroke-dasharray: 10 10;\n  pointer-events: none;\n}\n\n.intersection-marker {\n  cursor: grab;\n}\n\n.intersection-marker.dragging {\n  cursor: grabbing;\n}\n\n.intersection-marker .intersection-hitbox {\n  fill: transparent;\n  stroke: transparent;\n  stroke-width: 22;\n  pointer-events: stroke;\n}\n\n.intersection-marker .intersection-cross-halo {\n  stroke: rgba(5, 10, 18, 0.66);\n  stroke-width: 8;\n  stroke-linecap: round;\n  pointer-events: none;\n}\n\n.intersection-marker .intersection-cross {\n  stroke: rgba(118, 242, 164, 0.72);\n  stroke-width: 3.8;\n  stroke-linecap: round;\n  pointer-events: none;\n}\n\n.intersection-marker.active .intersection-cross,\n.intersection-marker.dragging .intersection-cross {\n  stroke: #ffdf8a;\n  stroke-width: 4.6;\n}\n\n.vfr-circuit-line,\n.vfr-circuit-halo {\n  fill: none;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n  pointer-events: none;\n}\n\n.vfr-circuit-halo {\n  stroke: rgba(5, 10, 18, 0.78);\n}\n\n.vfr-circuit-line {\n  stroke: #ff6c7a;\n}\n\n.vfr-construction-line,\n.vfr-construction-line-preview {\n  fill: none;\n  stroke: #ff2f4f;\n  stroke-linecap: round;\n  pointer-events: none;\n}\n\n.vfr-construction-line-preview {\n  stroke: #ff6c7a;\n}\n\n.vfr-line-intersection-target {\n  fill: rgba(255, 208, 138, 0.22);\n  stroke: #ffd08a;\n  cursor: crosshair;\n}\n\n.vfr-line-endpoint {\n  fill: #ff2f4f;\n  stroke: #06101b;\n  cursor: grab;\n}\n\n.vfr-line-endpoint.dragging {\n  fill: #ffd08a;\n}\n\n.vfr-line-endpoint-hitbox {\n  fill: transparent;\n  stroke: transparent;\n  pointer-events: all;\n  cursor: grab;\n}\n\n.vfr-circuit-point {\n  fill: #06101b;\n  stroke: #ff6c7a;\n  pointer-events: none;\n}\n\n.vfr-circuit-point.endpoint {\n  fill: #ff6c7a;\n  stroke: #06101b;\n}\n\n.vfr-circuit-label {\n  fill: #edf7ff;\n  stroke: rgba(5, 10, 18, 0.88);\n  stroke-width: 3;\n  paint-order: stroke;\n  font: 800 22px \"Segoe UI\", sans-serif;\n  pointer-events: none;\n}\n\n.circuit-actions {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: 0.55rem;\n}\n\n.chart-file-input {\n  min-height: 2.9rem;\n}\n\n@media (max-width: 960px) {\n  .hero,\n  .layout,\n  .vfr-layout,\n  .toolbar,\n  .grid,\n  .grid.three,\n  .grid.four,\n  .restriction-grid,\n  .restriction-tile,\n  .circuit-actions {\n    grid-template-columns: 1fr;\n  }\n\n  button,\n  .top-row button,\n  .actions button,\n  .mini-actions button {\n    width: 100%;\n  }\n}\n"}</style>
<div className={"app"}>
<section className={"hero"}>
<div>
<div className={"kicker"}>{"Private local data"}</div>
<h1>{"Waypoint / Procedure Editor"}</h1>
<p>{"Waypointy zapisane sa per kraj w folderze "}<strong>{"Waypoints"}</strong>{". Procedury korzystaja z punktow z tego samego pliku kraju."}</p>
</div>
<div className={"stack"}>
<div className={"toolbar"}>
<div>
<label htmlFor={"countryInput"}>{"Country file"}</label>
<input id={"countryInput"} type={"text"} defaultValue={"Poland"} autoComplete={"off"} spellCheck={"false"} />
</div>
<button id={"openFileBtn"} type={"button"} className={"secondary"}>{"Open JS"}</button>
<button id={"chooseDirBtn"} type={"button"} className={"secondary"}>{"Use Waypoints"}</button>
<button id={"saveFileBtn"} type={"button"} className={"primary"}>{"Save country"}</button>
</div>
<div id={"status"} className={"status"}>{"Loaded local editor."}</div>
<input id={"openFileInput"} className={"file-input"} type={"file"} accept={".js,.json,application/javascript,application/json"} />
</div>
</section>
<section id={"privateGate"} className={"panel private-gate"} hidden={true}>
<div className={"stack"}>
<div className={"kicker"}>{"Local only"}</div>
<p className={"help"}>{"Ten edytor jest wylaczony poza lokalnym plikiem lub localhost. Otworz "}<strong>{"waypoint-procedure-editor.html"}</strong>{" lokalnie, aby edytowac dane."}</p>
</div>
</section>
<main id={"editorShell"}>
<div className={"tabs"} role={"tablist"} aria-label={"Editor tabs"}>
<button id={"waypointsTabBtn"} type={"button"} className={"active"} role={"tab"} aria-controls={"waypointsPanel"} aria-selected={"true"}>{"Waypoints"}</button>
<button id={"proceduresTabBtn"} type={"button"} className={"secondary"} role={"tab"} aria-controls={"proceduresPanel"} aria-selected={"false"}>{"Procedures"}</button>
<button id={"vfrTabBtn"} type={"button"} className={"secondary"} role={"tab"} aria-controls={"vfrPanel"} aria-selected={"false"}>{"VFR Circuits"}</button>
<button id={"downloadBtn"} type={"button"} className={"secondary"}>{"Download JS"}</button>
<button id={"copyBtn"} type={"button"} className={"secondary"}>{"Copy export"}</button>
</div>
<section id={"waypointsPanel"} className={"tab-panel"} role={"tabpanel"} aria-labelledby={"waypointsTabBtn"}>
<div className={"layout"}>
<section className={"panel stack"}>
<div>
<div className={"kicker"}>{"Waypoint"}</div>
<p className={"help"}>{"Nazwa ma maksymalnie 6 znakow. Grupa ICAO tworzy kod VFR, np EPKK + BRAVO = EPKKB. Thresholdy pasow zostaja jako RW30/EPNT."}</p>
</div>
<div className={"grid four"}>
<div>
<label htmlFor={"waypointNameInput"}>{"Name"}</label>
<input id={"waypointNameInput"} type={"text"} maxLength={"6"} autoComplete={"off"} spellCheck={"false"} placeholder={"NAVUR"} />
</div>
<div>
<label htmlFor={"waypointGroupInput"}>{"Group"}</label>
<input id={"waypointGroupInput"} type={"text"} maxLength={"4"} autoComplete={"off"} spellCheck={"false"} placeholder={"EPNT"} />
</div>
<div>
<label htmlFor={"waypointRulesSelect"}>{"Rules"}</label>
<select id={"waypointRulesSelect"}>
<option value={"IFR"}>{"IFR"}</option>
<option value={"VFR"}>{"VFR"}</option>
<option value={"BOTH"}>{"IFR + VFR"}</option>
</select>
</div>
<div>
<label htmlFor={"waypointOriginSelect"}>{"Data origin"}</label>
<select id={"waypointOriginSelect"}>
<option value={"PRIVATE"}>{"Private"}</option>
<option value={"NAVDATA"}>{"NAVDATA"}</option>
</select>
</div>
</div>
<div>
<label htmlFor={"waypointSourceInput"}>{"Source"}</label>
<input id={"waypointSourceInput"} type={"text"} autoComplete={"off"} spellCheck={"false"} placeholder={"AIP / own"} />
</div>
<div className={"grid three"}>
<div>
<label htmlFor={"waypointLatInput"}>{"Latitude"}</label>
<input id={"waypointLatInput"} type={"number"} step={"0.000001"} placeholder={"50.077700"} />
</div>
<div>
<label htmlFor={"waypointLonInput"}>{"Longitude"}</label>
<input id={"waypointLonInput"} type={"number"} step={"0.000001"} placeholder={"19.784800"} />
</div>
<div>
<label htmlFor={"waypointCoordInput"}>{"Coord"}</label>
<input id={"waypointCoordInput"} type={"text"} autoComplete={"off"} spellCheck={"false"} placeholder={"PO632, 52 12 37.2 N, 016 52 33.1 E"} />
</div>
</div>
<div>
<label htmlFor={"waypointNoteInput"}>{"Note"}</label>
<textarea id={"waypointNoteInput"} spellCheck={"false"} placeholder={"Optional note"} defaultValue={""}></textarea>
</div>
<div className={"actions"}>
<button id={"saveWaypointBtn"} type={"button"} className={"primary"}>{"Save waypoint"}</button>
<button id={"newWaypointBtn"} type={"button"} className={"secondary"}>{"New"}</button>
<button id={"deleteWaypointBtn"} type={"button"} className={"danger"}>{"Delete"}</button>
</div>
</section>
<section className={"panel stack"}>
<div className={"grid"}>
<div>
<label htmlFor={"waypointSearchInput"}>{"Search"}</label>
<input id={"waypointSearchInput"} type={"text"} autoComplete={"off"} spellCheck={"false"} placeholder={"Point name"} />
</div>
<div>
<label htmlFor={"waypointFilterSelect"}>{"Filter"}</label>
<select id={"waypointFilterSelect"}>
<option value={"ALL"}>{"All"}</option>
<option value={"IFR"}>{"IFR"}</option>
<option value={"VFR"}>{"VFR"}</option>
<option value={"BOTH"}>{"IFR + VFR"}</option>
</select>
</div>
</div>
<div id={"waypointList"} className={"item-list"}></div>
</section>
</div>
</section>
<section id={"proceduresPanel"} className={"tab-panel"} role={"tabpanel"} aria-labelledby={"proceduresTabBtn"} hidden={true}>
<div className={"layout"}>
<section className={"panel stack"}>
<div>
<div className={"kicker"}>{"Procedure"}</div>
<p className={"help"}>{"SID, STAR i approach budowane sa tylko z punktow zapisanych w aktywnym kraju."}</p>
</div>
<div className={"grid three"}>
<div>
<label htmlFor={"procedureAirportInput"}>{"Airport"}</label>
<input id={"procedureAirportInput"} type={"text"} maxLength={"4"} autoComplete={"off"} spellCheck={"false"} placeholder={"EPKK"} />
</div>
<div>
<label htmlFor={"procedureDesignatorInput"}>{"Designator"}</label>
<input id={"procedureDesignatorInput"} type={"text"} autoComplete={"off"} spellCheck={"false"} placeholder={"NAVUR 1A"} />
</div>
<div>
<label htmlFor={"procedureCategorySelect"}>{"Type"}</label>
<select id={"procedureCategorySelect"}>
<option value={"SID"}>{"SID"}</option>
<option value={"STAR"}>{"STAR"}</option>
<option value={"APPROACH"}>{"Approach"}</option>
<option value={"DME_ARC"}>{"DME Arc"}</option>
</select>
</div>
</div>
<div className={"grid four"}>
<div>
<label htmlFor={"procedureRunwayInput"}>{"Runway"}</label>
<input id={"procedureRunwayInput"} type={"text"} autoComplete={"off"} spellCheck={"false"} placeholder={"25"} />
</div>
<div>
<label htmlFor={"procedureDirectionSelect"}>{"Direction"}</label>
<select id={"procedureDirectionSelect"}>
<option value={"ONE_WAY"}>{"One-way"}</option>
<option value={"BIDIRECTIONAL"}>{"Bidirectional"}</option>
</select>
</div>
<div>
<label htmlFor={"approachTypeSelect"}>{"Approach type"}</label>
<select id={"approachTypeSelect"}>
<option value={"ILS"}>{"ILS"}</option>
<option value={"RNP"}>{"RNP"}</option>
<option value={"VOR"}>{"VOR"}</option>
<option value={"VIS"}>{"VIS"}</option>
<option value={"LOC"}>{"LOC"}</option>
<option value={"NDB"}>{"NDB"}</option>
<option value={"RNAV"}>{"RNAV"}</option>
<option value={"OTHER"}>{"Other"}</option>
</select>
</div>
<div>
<label htmlFor={"approachOtherInput"}>{"Other approach"}</label>
<input id={"approachOtherInput"} type={"text"} autoComplete={"off"} spellCheck={"false"} placeholder={"Type"} />
</div>
</div>
<div className={"grid approach-only"}>
<div>
<label htmlFor={"finalGlideSlopeInput"}>{"Final glide slope"}</label>
<input id={"finalGlideSlopeInput"} type={"text"} inputmode={"decimal"} autoComplete={"off"} spellCheck={"false"} placeholder={"3.0"} />
</div>
<div>
<label>{"Glide slope start"}</label>
<div id={"finalGlideSlopeStartPill"} className={"static-field"}>{"Select FAF on a route point"}</div>
</div>
</div>
<div>
<label htmlFor={"procedureTitleInput"}>{"Title / note"}</label>
<input id={"procedureTitleInput"} type={"text"} autoComplete={"off"} spellCheck={"false"} placeholder={"Optional title"} />
</div>
<div id={"dmeArcFields"} className={"stack dme-arc-only"} hidden={true}>
<div className={"grid four"}>
<div>
<label htmlFor={"dmeSourceSelect"}>{"DME Source"}</label>
<select id={"dmeSourceSelect"}></select>
</div>
<div>
<label htmlFor={"dmeDistanceInput"}>{"DME Distance"}</label>
<input id={"dmeDistanceInput"} type={"text"} autoComplete={"off"} spellCheck={"false"} placeholder={"10"} />
</div>
<div>
<label htmlFor={"dmeEntryRadialInput"}>{"Entry Radial"}</label>
<input id={"dmeEntryRadialInput"} type={"text"} autoComplete={"off"} spellCheck={"false"} placeholder={"123"} />
</div>
<div>
<label htmlFor={"dmeExitRadialInput"}>{"Exit Radial"}</label>
<input id={"dmeExitRadialInput"} type={"text"} autoComplete={"off"} spellCheck={"false"} placeholder={"276"} />
</div>
</div>
<div className={"actions"}>
<button id={"addDmeArcPointsBtn"} type={"button"} className={"secondary"}>{"Add arc points"}</button>
</div>
</div>
<div className={"grid"}>
<div>
<label htmlFor={"procedureSelect"}>{"Existing procedure"}</label>
<select id={"procedureSelect"}></select>
</div>
<div>
<label htmlFor={"procedureSourceInput"}>{"Source"}</label>
<input id={"procedureSourceInput"} type={"text"} autoComplete={"off"} spellCheck={"false"} placeholder={"AIP / own"} />
</div>
</div>
<div className={"actions"}>
<button id={"saveProcedureBtn"} type={"button"} className={"primary"}>{"Save procedure"}</button>
<button id={"newProcedureBtn"} type={"button"} className={"secondary"}>{"New"}</button>
<button id={"deleteProcedureBtn"} type={"button"} className={"danger"}>{"Delete"}</button>
</div>
<div className={"stack"}>
<div className={"top-row"}>
<span className={"pill"}>{"Loaded for airport"}</span>
<span id={"airportProcedureCountPill"} className={"pill"}>{"0 procedures"}</span>
</div>
<div id={"airportProcedureList"} className={"item-list"}></div>
</div>
</section>
<section className={"panel stack"}>
<div className={"grid"}>
<div>
<label htmlFor={"legWaypointSelect"}>{"Waypoint"}</label>
<select id={"legWaypointSelect"}></select>
</div>
<div className={"approach-only"}>
<label htmlFor={"legRoleSelect"}>{"Approach point"}</label>
<select id={"legRoleSelect"}>
<option value={""}>{"No role"}</option>
<option value={"IAF"}>{"IAF"}</option>
<option value={"IF"}>{"IF"}</option>
<option value={"FAF"}>{"FAF"}</option>
</select>
</div>
<div>
<label htmlFor={"legNoteInput"}>{"Leg note"}</label>
<input id={"legNoteInput"} type={"text"} autoComplete={"off"} spellCheck={"false"} placeholder={"Turn / remark"} />
</div>
</div>
<div className={"restriction-grid"}>
<div className={"restriction-tile"}>
<strong>{"ALT"}</strong>
<div>
<label htmlFor={"legAltitudeTypeSelect"}>{"Altitude restriction"}</label>
<select id={"legAltitudeTypeSelect"}>
<option value={"AT"}>{"At"}</option>
<option value={"AT_OR_BELOW"}>{"At or Below"}</option>
<option value={"AT_OR_ABOVE"}>{"At or Above"}</option>
</select>
</div>
<div>
<label htmlFor={"legAltitudeValueInput"}>{"ALT / FL"}</label>
<input id={"legAltitudeValueInput"} type={"text"} inputmode={"text"} autoComplete={"off"} spellCheck={"false"} placeholder={"3000 / FL130"} />
</div>
</div>
<div className={"restriction-tile"}>
<strong>{"SPD"}</strong>
<div>
<label htmlFor={"legSpeedTypeSelect"}>{"Speed Restriction"}</label>
<select id={"legSpeedTypeSelect"}>
<option value={"MORE_THAN"}>{"More than"}</option>
<option value={"LESS_THAN"}>{"Less than"}</option>
<option value={"MAINTAIN"}>{"Maintain"}</option>
</select>
</div>
<div>
<label htmlFor={"legSpeedValueInput"}>{"KT"}</label>
<input id={"legSpeedValueInput"} type={"text"} inputmode={"numeric"} autoComplete={"off"} spellCheck={"false"} placeholder={"220"} />
</div>
</div>
</div>
<div className={"leg-actions"}>
<button id={"addLegBtn"} type={"button"} className={"secondary"}>{"Add to route"}</button>
<button id={"addMissedLegBtn"} type={"button"} className={"secondary approach-only"}>{"Add to missed"}</button>
</div>
<div className={"stack"}>
<div className={"top-row"}>
<span className={"pill"}>{"Route"}</span>
<span id={"routeCount"} className={"pill"}>{"0 legs"}</span>
</div>
<div id={"procedureLegList"} className={"leg-list"}></div>
</div>
<div id={"missedApproachBlock"} className={"stack approach-only"}>
<div className={"top-row"}>
<span className={"pill"}>{"Missed Approach"}</span>
<span id={"missedCount"} className={"pill"}>{"0 legs"}</span>
</div>
<div id={"missedLegList"} className={"leg-list"}></div>
</div>
</section>
</div>
</section>
<section id={"vfrPanel"} className={"tab-panel"} role={"tabpanel"} aria-labelledby={"vfrTabBtn"} hidden={true}>
<div className={"vfr-layout"}>
<section className={"panel stack"}>
<div>
<div className={"kicker"}>{"VFR circuits"}</div>
<p className={"help"}>{"Kragi nadlotniskowe sa zapisywane w pliku kraju. Punkty mozna oprzec o intersections albo klikac bezposrednio na chart."}</p>
</div>
<div className={"grid"}>
<div>
<label htmlFor={"vfrAirportSelect"}>{"Airport"}</label>
<select id={"vfrAirportSelect"}></select>
</div>
<div>
<label htmlFor={"vfrAirportInput"}>{"ICAO"}</label>
<input id={"vfrAirportInput"} type={"text"} maxLength={"4"} autoComplete={"off"} spellCheck={"false"} placeholder={"EPKR"} />
</div>
</div>
<div>
<label htmlFor={"vfrChartPdfInput"}>{"Chart PDF"}</label>
<input id={"vfrChartPdfInput"} className={"chart-file-input"} type={"file"} accept={"application/pdf"} />
</div>
<div className={"grid"}>
<div>
<label htmlFor={"vfrChartSourceInput"}>{"Chart source"}</label>
<input id={"vfrChartSourceInput"} type={"text"} autoComplete={"off"} spellCheck={"false"} placeholder={"./charts/Poland/EPKR/National%20AIP/AD13.pdf"} />
</div>
<div>
<label htmlFor={"vfrChartTitleInput"}>{"Chart title"}</label>
<input id={"vfrChartTitleInput"} type={"text"} autoComplete={"off"} spellCheck={"false"} placeholder={"Upscaled chart"} />
</div>
</div>
<div className={"grid three"}>
<div>
<label htmlFor={"vfrCircuitSelect"}>{"Circuit / runway"}</label>
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
</div>
<div className={"circuit-actions"}>
<button id={"addNewVfrCircuitBtn"} type={"button"} className={"secondary"}>{"Add new circuit"}</button>
<button id={"addRunwayVfrCircuitsBtn"} type={"button"} className={"secondary"}>{"Add circuits for runways"}</button>
</div>
<div id={"vfrRunwayMeta"} className={"static-field"}>{"Runways will load from ground-data.js for the selected airport."}</div>
<div>
<label>{"Threshold coordinates for chart alignment"}</label>
<div id={"vfrThresholdCoordinateList"} className={"static-field threshold-coordinate-list"}>{"No runway threshold coordinates loaded."}</div>
</div>
<div className={"actions"}>
<button id={"saveVfrCircuitBtn"} type={"button"} className={"primary"}>{"Save circuit"}</button>
<button id={"startVfrCircuitBtn"} type={"button"} className={"primary"}>{"Start drawing"}</button>
<button id={"stopVfrCircuitBtn"} type={"button"} className={"secondary"}>{"Stop"}</button>
</div>
<div className={"circuit-actions"}>
<button id={"undoVfrCircuitPointBtn"} type={"button"} className={"secondary"}>{"Undo point"}</button>
<button id={"clearVfrCircuitBtn"} type={"button"} className={"danger"}>{"Clear circuit"}</button>
<button id={"deleteVfrCircuitBtn"} type={"button"} className={"danger"}>{"Delete circuit"}</button>
<button id={"deleteVfrIntersectionBtn"} type={"button"} className={"danger"}>{"Delete intersection"}</button>
</div>
<div className={"circuit-actions"}>
<button id={"startVfrLineModeBtn"} type={"button"} className={"secondary"}>{"Draw lines"}</button>
<button id={"stopVfrLineModeBtn"} type={"button"} className={"secondary"}>{"Stop lines"}</button>
<button id={"clearVfrLinesBtn"} type={"button"} className={"danger"}>{"Clear lines"}</button>
</div>
<div className={"grid"}>
<div>
<label htmlFor={"vfrPatternPointSelect"}>{"Traffic pattern point"}</label>
<select id={"vfrPatternPointSelect"}>
<option value={"TURN1"}>{"1st turn"}</option>
<option value={"TURN2"}>{"2nd turn"}</option>
<option value={"TURN3"}>{"3rd turn"}</option>
<option value={"TURN4"}>{"4th turn / Final"}</option>
</select>
</div>
<div>
<label>{"Pattern actions"}</label>
<div className={"actions"}>
<button id={"pickVfrPatternPointBtn"} type={"button"} className={"secondary"}>{"Pick turn"}</button>
<button id={"clearVfrPatternBtn"} type={"button"} className={"danger"}>{"Clear pattern"}</button>
</div>
</div>
</div>
<div id={"vfrPatternMeta"} className={"static-field"}>{"Set turns 1-4 to build traffic pattern points automatically."}</div>
<div className={"circuit-actions"}>
<button id={"pickVfrTouchdownBtn"} type={"button"} className={"secondary"}>{"Pick touchdown"}</button>
<button id={"autoVfrTouchdownBtn"} type={"button"} className={"secondary"}>{"Auto touchdown"}</button>
<button id={"clearVfrTouchdownBtn"} type={"button"} className={"danger"}>{"Clear touchdown"}</button>
</div>
<div className={"circuit-actions"}>
<button id={"pickVfrThresholdBtn"} type={"button"} className={"secondary"}>{"Pick threshold"}</button>
<button id={"clearVfrThresholdBtn"} type={"button"} className={"danger"}>{"Clear threshold"}</button>
</div>
<div id={"vfrTouchdownMeta"} className={"static-field"}>{"Manual touchdown uses chart intersection. Auto uses runway length and threshold rule."}</div>
<div className={"grid"}>
<div>
<label htmlFor={"vfrIntersectionSelect"}>{"Intersection"}</label>
<select id={"vfrIntersectionSelect"}></select>
</div>
<div>
<label>{"Map status"}</label>
<div id={"vfrChartMeta"} className={"static-field"}>{"Load a chart or choose an airport."}</div>
</div>
</div>
</section>
<section className={"panel stack"}>
<div className={"top-row"}>
<span className={"pill"} id={"vfrAirportPill"}>{"No airport"}</span>
<span className={"pill"} id={"vfrCircuitPill"}>{"0 circuits"}</span>
<span className={"pill"} id={"vfrIntersectionPill"}>{"0 intersections"}</span>
<span className={"pill"} id={"vfrLinePill"}>{"0 lines"}</span>
</div>
<div id={"vfrChartMap"} className={"chart-map"} aria-label={"VFR circuit chart overlay"}>
<div className={"chart-map-controls"} aria-label={"Chart zoom controls"}>
<button type={"button"} data-vfr-chart-zoom={"in"} aria-label={"Zoom in"}>{"+"}</button>
<button type={"button"} data-vfr-chart-zoom={"out"} aria-label={"Zoom out"}>{"-"}</button>
<button type={"button"} data-vfr-chart-zoom={"reset"} aria-label={"Reset chart zoom"}>{"R"}</button>
</div>
<div id={"vfrChartMapLayer"} className={"chart-map-layer"} data-chart-map-layer={""}>
<object id={"vfrChartPdfFrame"} className={"chart-pdf-frame"} type={"application/pdf"} aria-label={"Airport VFR chart"}></object>
<svg id={"vfrChartOverlaySvg"} className={"chart-overlay-svg"} viewBox={"0 0 1000 1000"} preserveAspectRatio={"none"} aria-label={"VFR circuit overlay"}></svg>
</div>
</div>
</section>
</div>
</section>
<section className={"panel stack"} style={{"marginTop":"0.85rem"}}>
<div className={"top-row"}>
<span className={"pill"} id={"fileNamePill"}>{"Poland.js"}</span>
<span className={"pill"} id={"waypointCountPill"}>{"0 waypoints"}</span>
<span className={"pill"} id={"procedureCountPill"}>{"0 procedures"}</span>
</div>
<label htmlFor={"exportText"}>{"Generated country file"}</label>
<textarea id={"exportText"} className={"export"} spellCheck={"false"} defaultValue={""}></textarea>
</section>
</main>
</div>

</>);}
