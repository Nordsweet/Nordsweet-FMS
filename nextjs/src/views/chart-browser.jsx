// React view; original controls and IDs are preserved for the flight engine.

export default function ChartBrowserView(){return (<><style>{"\n:root {\n  --bg: #101820;\n  --panel: #f6f2e8;\n  --panel-2: #e7e1d3;\n  --ink: #111316;\n  --muted: #62717d;\n  --line: #1d242b;\n  --accent: #1f9d8a;\n  --accent-2: #2678b6;\n  --warn: #a95521;\n  --shadow: 0 18px 44px rgba(0, 0, 0, 0.32);\n}\n\n* {\n  box-sizing: border-box;\n}\n\nhtml,\nbody {\n  width: 100%;\n  height: 100%;\n  overflow: hidden;\n}\n\nbody {\n  margin: 0;\n  color: var(--ink);\n  background: #101820;\n  font-family: \"Bahnschrift\", \"Segoe UI\", Arial, sans-serif;\n}\n\nbutton,\nselect {\n  font: inherit;\n}\n\n.app {\n  height: 100vh;\n  height: 100dvh;\n  min-height: 0;\n  display: grid;\n  grid-template-rows: auto minmax(0, 1fr);\n  gap: 0.42rem;\n  padding: 0.42rem;\n  overflow: hidden;\n}\n\n.topbar,\n.viewer {\n  border: 2px solid var(--line);\n  border-radius: 8px;\n  background: var(--panel);\n  box-shadow: var(--shadow);\n}\n\n.topbar {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(11rem, 0.78fr) auto;\n  gap: 0.38rem;\n  align-items: end;\n  padding: 0.42rem;\n}\n\n.field {\n  min-width: 0;\n  display: grid;\n  gap: 0.22rem;\n}\n\n.field label,\n.meta-label {\n  color: var(--muted);\n  font-size: 0.68rem;\n  font-weight: 900;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n}\n\nselect {\n  width: 100%;\n  min-height: 2.08rem;\n  padding: 0.34rem 0.48rem;\n  color: var(--ink);\n  background: #fffaf0;\n  border: 1px solid var(--line);\n  border-radius: 6px;\n  font-weight: 850;\n}\n\n.status {\n  min-width: 11rem;\n  display: grid;\n  gap: 0.1rem;\n  padding: 0.32rem 0.48rem;\n  border: 1px solid var(--line);\n  border-radius: 6px;\n  background: #fffaf0;\n}\n\n.status strong {\n  font-size: 0.86rem;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n}\n\n.status span {\n  color: var(--muted);\n  font-size: 0.68rem;\n  font-weight: 800;\n}\n\n.viewer {\n  min-height: 0;\n  display: grid;\n  grid-template-rows: auto auto minmax(0, 1fr) auto;\n  overflow: hidden;\n}\n\n.viewer-grid {\n  min-height: 0;\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 0.42rem;\n  overflow: hidden;\n}\n\n.chart-head {\n  display: grid;\n  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.1fr) minmax(6.5rem, 0.65fr);\n  border-bottom: 2px solid var(--line);\n  background: #fffaf0;\n}\n\n.chart-head > div {\n  min-width: 0;\n  padding: 0.38rem 0.55rem;\n  border-right: 1px solid var(--line);\n}\n\n.chart-head > div:last-child {\n  border-right: 0;\n  text-align: right;\n}\n\n.chart-head strong,\n.chart-head span {\n  display: block;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.chart-head strong {\n  margin-top: 0.1rem;\n  font-size: 0.95rem;\n  letter-spacing: 0.03em;\n  text-transform: uppercase;\n}\n\n.chart-head span:not(.meta-label) {\n  margin-top: 0.08rem;\n  color: var(--muted);\n  font-size: 0.7rem;\n  font-weight: 800;\n}\n\n.tool-row {\n  display: grid;\n  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.92fr) minmax(0, 0.78fr);\n  border-bottom: 2px solid var(--line);\n  background: #fffaf0;\n}\n\n.tool-row > div {\n  min-width: 0;\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 0.34rem;\n  min-height: 2.45rem;\n  padding: 0.28rem 0.48rem;\n  border-right: 1px solid var(--line);\n  font-size: 0.72rem;\n  font-weight: 950;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n}\n\n.tool-row > div:last-child {\n  border-right: 0;\n}\n\n.load-pdf {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-height: 1.65rem;\n  padding: 0.18rem 0.42rem;\n  color: var(--ink);\n  background: #fffaf0;\n  border: 1px solid var(--line);\n  border-radius: 0;\n  cursor: pointer;\n}\n\n.load-pdf input {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  opacity: 0;\n  pointer-events: none;\n}\n\n.line-control input {\n  width: min(8rem, 100%);\n  accent-color: #58d27e;\n}\n\n.runway-control {\n  display: inline-flex;\n  align-items: center;\n  gap: 0.34rem;\n}\n\n.runway-control select {\n  width: auto;\n  min-width: 5.5rem;\n  min-height: 1.72rem;\n  padding: 0.18rem 0.36rem;\n  font-size: 0.72rem;\n}\n\n.stage {\n  position: relative;\n  z-index: 1;\n  min-height: 0;\n  display: grid;\n  grid-template-columns: 2.55rem minmax(0, 1fr) 2.55rem;\n  background: var(--panel-2);\n}\n\n.nav-btn {\n  width: 100%;\n  height: 100%;\n  min-width: 0;\n  min-height: 0;\n  margin: 0;\n  padding: 0;\n  color: var(--ink);\n  background: #fffaf0;\n  border: 0;\n  box-shadow: none;\n  font-size: 1.5rem;\n  font-weight: 950;\n  cursor: pointer;\n}\n\n.nav-btn:first-child {\n  border-right: 2px solid var(--line);\n}\n\n.nav-btn:last-child {\n  border-left: 2px solid var(--line);\n}\n\n.nav-btn:disabled {\n  color: rgba(17, 19, 22, 0.25);\n  cursor: default;\n}\n\n.document {\n  position: relative;\n  min-width: 0;\n  min-height: 0;\n  display: grid;\n  background: #fffaf0;\n  overflow: hidden;\n  touch-action: pan-y;\n  user-select: none;\n}\n\n.taxi-map {\n  position: relative;\n  width: 100%;\n  height: 100%;\n  min-height: 0;\n  overflow: hidden;\n  background: #fffaf0;\n  cursor: grab;\n  touch-action: none;\n  user-select: none;\n}\n\n.taxi-map.panning {\n  cursor: grabbing;\n}\n\n.taxi-layer {\n  position: absolute;\n  top: 0;\n  left: 0;\n  z-index: 0;\n  transform-origin: 0 0;\n  will-change: transform;\n}\n\n.map-controls {\n  position: absolute;\n  top: 0.55rem;\n  left: 0.55rem;\n  z-index: 2;\n  display: flex;\n  gap: 0.22rem;\n  padding: 0.18rem;\n  background: rgba(255, 250, 240, 0.94);\n  border: 1px solid var(--line);\n}\n\n.map-controls button {\n  width: 1.65rem;\n  min-width: 1.65rem;\n  height: 1.65rem;\n  min-height: 1.65rem;\n  padding: 0;\n  color: var(--ink);\n  background: #fffaf0;\n  border: 1px solid var(--line);\n  border-radius: 0;\n  box-shadow: none;\n  font-size: 0.78rem;\n  font-weight: 950;\n}\n\n.pdf-frame,\n.empty {\n  width: 100%;\n  height: 100%;\n  border: 0;\n}\n\n.pdf-frame {\n  display: block;\n  background: #fffaf0;\n  pointer-events: none;\n}\n\n.empty {\n  display: grid;\n  place-items: center;\n  padding: 1rem;\n  text-align: center;\n}\n\n.empty strong {\n  display: block;\n  margin-bottom: 0.25rem;\n  font-size: 1.1rem;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n}\n\n.empty span {\n  color: var(--muted);\n  font-weight: 800;\n}\n\n.taxi-overlay {\n  position: absolute;\n  inset: 0;\n  z-index: 1;\n  width: 100%;\n  height: 100%;\n  pointer-events: none;\n}\n\n.route-halo,\n.route-line {\n  fill: none;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n}\n\n.route-halo {\n  stroke: rgba(88, 210, 126, 0.24);\n}\n\n.route-line {\n  stroke: #58d27e;\n}\n\n.route-point {\n  fill: #fffaf0;\n  stroke: #58d27e;\n}\n\n.nord-procedure {\n  width: 100%;\n  height: 100%;\n  display: grid;\n  grid-template-rows: auto minmax(0, 1fr) auto;\n  background: #fffef7;\n}\n\n.nord-procedure-band,\n.nord-procedure-foot {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  gap: 0.55rem;\n  align-items: center;\n  min-height: 1.95rem;\n  padding: 0.28rem 0.5rem;\n  border-bottom: 1px solid var(--line);\n  color: var(--ink);\n  background: #fffaf0;\n  font-size: 0.72rem;\n  font-weight: 900;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n}\n\n.nord-procedure-foot {\n  min-height: 1.7rem;\n  border-top: 1px solid var(--line);\n  border-bottom: 0;\n  color: var(--muted);\n  font-size: 0.62rem;\n}\n\n.nord-procedure-band strong,\n.nord-procedure-band span,\n.nord-procedure-foot span {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.nord-procedure-svg {\n  width: 100%;\n  height: 100%;\n  min-height: 0;\n  display: block;\n  background: #fffef7;\n}\n\n.nord-procedure-map {\n  position: relative;\n  width: min(100%, calc(100vh * 0.92));\n  height: 100%;\n  justify-self: center;\n  min-width: 0;\n  min-height: 0;\n  overflow: hidden;\n  background: #fffef7;\n  border-left: 1px solid rgba(17, 19, 22, 0.18);\n  border-right: 1px solid rgba(17, 19, 22, 0.18);\n  cursor: grab;\n  touch-action: none;\n  user-select: none;\n}\n\n.nord-procedure-map.panning {\n  cursor: grabbing;\n}\n\n.nord-grid {\n  stroke: rgba(17, 19, 22, 0.16);\n  stroke-width: 1;\n}\n\n.nord-route-halo,\n.nord-route-line {\n  fill: none;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n}\n\n.nord-route-halo {\n  stroke: rgba(255, 254, 247, 0.92);\n  stroke-width: 7;\n}\n\n.nord-route-line {\n  stroke: #c3222a;\n  stroke-width: 2.2;\n}\n\n.nord-fix {\n  fill: #fffef7;\n  stroke: #111316;\n  stroke-width: 1.6;\n}\n\n.nord-airport {\n  fill: #72dfff;\n  stroke: #111316;\n  stroke-width: 1.8;\n}\n\n.nord-label {\n  fill: #111316;\n  paint-order: stroke;\n  stroke: #fffef7;\n  stroke-width: 3.6;\n  font-weight: 950;\n}\n\n.nord-segment-label-text {\n  stroke-width: 2.4;\n  font-weight: 850;\n}\n\n.nord-restriction {\n  fill: #0018ff;\n}\n\n.nord-speed {\n  fill: #c0003a;\n}\n\n.taxi-hint {\n  position: absolute;\n  right: 0.5rem;\n  bottom: 0.5rem;\n  z-index: 2;\n  max-width: min(23rem, calc(100% - 1rem));\n  padding: 0.28rem 0.42rem;\n  color: var(--ink);\n  background: rgba(255, 250, 240, 0.92);\n  border: 1px solid rgba(17, 19, 22, 0.35);\n  font-size: 0.62rem;\n  font-weight: 950;\n  letter-spacing: 0.05em;\n  text-transform: uppercase;\n  pointer-events: none;\n}\n\n.strip {\n  position: relative;\n  z-index: 5;\n  display: grid;\n  grid-auto-flow: column;\n  grid-auto-columns: minmax(5.55rem, 1fr);\n  gap: 0.24rem;\n  padding: 0.32rem;\n  overflow-x: auto;\n  border-top: 2px solid var(--line);\n  background: #fffaf0;\n}\n\n.step {\n  min-width: 0;\n  min-height: 2.24rem;\n  margin: 0;\n  padding: 0.2rem 0.28rem;\n  color: var(--ink);\n  background: var(--panel);\n  border: 1px solid var(--line);\n  border-radius: 6px;\n  font-size: 0.62rem;\n  font-weight: 950;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n  cursor: pointer;\n  touch-action: manipulation;\n}\n\n.step span,\n.step strong {\n  display: block;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.step span {\n  color: var(--muted);\n  font-size: 0.52rem;\n}\n\n.step.active {\n  color: #fffaf0;\n  background: var(--line);\n}\n\n.step.active span {\n  color: rgba(255, 250, 240, 0.72);\n}\n\n.open-link {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-height: 1.68rem;\n  margin-top: 0.24rem;\n  padding: 0.18rem 0.44rem;\n  color: #fffaf0;\n  background: var(--accent-2);\n  border: 1px solid var(--accent-2);\n  border-radius: 6px;\n  text-decoration: none;\n  font-size: 0.72rem;\n  font-weight: 900;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n}\n\n@media (max-width: 760px) {\n  .app {\n    padding: 0.32rem;\n    gap: 0.32rem;\n  }\n\n  .topbar,\n  .chart-head,\n  .tool-row {\n    grid-template-columns: 1fr;\n  }\n\n  .topbar {\n    gap: 0.26rem;\n    padding: 0.32rem;\n  }\n\n  .chart-head > div {\n    border-right: 0;\n    border-bottom: 1px solid var(--line);\n  }\n\n  .chart-head > div:last-child {\n    border-bottom: 0;\n    text-align: left;\n  }\n\n  .tool-row > div {\n    border-right: 0;\n    border-bottom: 1px solid var(--line);\n  }\n\n  .tool-row > div:last-child {\n    border-bottom: 0;\n  }\n\n  .nord-procedure-band,\n  .nord-procedure-foot {\n    grid-template-columns: 1fr;\n  }\n\n  .stage {\n    grid-template-columns: 2.1rem minmax(0, 1fr) 2.1rem;\n  }\n\n  .strip {\n    grid-auto-columns: minmax(4.65rem, 35vw);\n  }\n}\n"}</style>
<main className={"app"}>
<section className={"topbar"} aria-label={"Route airports"}>
<div className={"field"}>
<label htmlFor={"depSelect"}>{"DEP"}</label>
<select id={"depSelect"}></select>
</div>
<div className={"field"}>
<label htmlFor={"arrSelect"}>{"ARR"}</label>
<select id={"arrSelect"}></select>
</div>
<div className={"field"}>
<label htmlFor={"chartSourceSelect"}>{"Chart source"}</label>
<select id={"chartSourceSelect"}></select>
</div>
<div className={"status"} aria-live={"polite"}>
<span id={"progressLabel"}>{"Chart"}</span>
<strong id={"currentLabel"}>{"--"}</strong>
</div>
</section>
<section className={"viewer-grid"} aria-label={"Chart browser"}>
<section className={"viewer"} data-chart-pane={"0"} aria-label={"Chart browser left"}>
<div className={"chart-head"}>
<div>
<span data-header-source-label={""} className={"meta-label"}>{"NordChart"}</span>
<strong data-airport-label={""}>{"--"}</strong>
<span data-airport-role-label={""}>{"--"}</span>
</div>
<div>
<span className={"meta-label"}>{"Selected route / chart"}</span>
<strong data-chart-title={""}>{"--"}</strong>
<span data-chart-type-label={""}>{"--"}</span>
</div>
<div>
<span className={"meta-label"}>{"Not for navigation"}</span>
<strong data-file-label={""}>{"--"}</strong>
<a data-open-link={""} className={"open-link"} href={"#"} target={"_blank"} rel={"noopener"} hidden={true}>{"Open PDF"}</a>
</div>
</div>
<div data-tool-row={""} className={"tool-row"}></div>
<div className={"stage"}>
<button data-prev-btn={""} type={"button"} className={"nav-btn"} aria-label={"Previous chart"}>{"‹"}</button>
<div data-document-stage={""} className={"document"} tabIndex={"0"} role={"group"} aria-label={"Selected chart"}></div>
<button data-next-btn={""} type={"button"} className={"nav-btn"} aria-label={"Next chart"}>{"›"}</button>
</div>
<div data-strip={""} className={"strip"} aria-label={"Chart sequence"}></div>
</section>
<section className={"viewer"} data-chart-pane={"1"} aria-label={"Chart browser right"}>
<div className={"chart-head"}>
<div>
<span data-header-source-label={""} className={"meta-label"}>{"NordChart"}</span>
<strong data-airport-label={""}>{"--"}</strong>
<span data-airport-role-label={""}>{"--"}</span>
</div>
<div>
<span className={"meta-label"}>{"Selected route / chart"}</span>
<strong data-chart-title={""}>{"--"}</strong>
<span data-chart-type-label={""}>{"--"}</span>
</div>
<div>
<span className={"meta-label"}>{"Not for navigation"}</span>
<strong data-file-label={""}>{"--"}</strong>
<a data-open-link={""} className={"open-link"} href={"#"} target={"_blank"} rel={"noopener"} hidden={true}>{"Open PDF"}</a>
</div>
</div>
<div data-tool-row={""} className={"tool-row"}></div>
<div className={"stage"}>
<button data-prev-btn={""} type={"button"} className={"nav-btn"} aria-label={"Previous chart"}>{"‹"}</button>
<div data-document-stage={""} className={"document"} tabIndex={"0"} role={"group"} aria-label={"Selected chart"}></div>
<button data-next-btn={""} type={"button"} className={"nav-btn"} aria-label={"Next chart"}>{"›"}</button>
</div>
<div data-strip={""} className={"strip"} aria-label={"Chart sequence"}></div>
</section>
</section>
</main>




</>);}
