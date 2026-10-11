// React view; original controls and IDs are preserved for the flight engine.

export default function AirspacesMapView(){return (<><style>{"\n    :root {\n      color-scheme: light;\n      --paper: #f7f4ea;\n      --panel: #ffffff;\n      --ink: #182230;\n      --muted: #657181;\n      --line: #d6d0c2;\n      --blue: #244f86;\n      --red: #bf304a;\n      --green: #23764d;\n      --amber: #9b680f;\n      --shadow: 0 18px 46px rgba(24, 32, 43, 0.15);\n    }\n\n    * {\n      box-sizing: border-box;\n    }\n\n    body {\n      margin: 0;\n      min-height: 100vh;\n      background: var(--paper);\n      color: var(--ink);\n      font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;\n    }\n\n    button,\n    input,\n    select,\n    textarea {\n      font: inherit;\n    }\n\n    button {\n      border: 1px solid #b9c4d1;\n      border-radius: 6px;\n      background: #fff;\n      color: var(--ink);\n      min-height: 34px;\n      padding: 7px 10px;\n      cursor: pointer;\n    }\n\n    button.primary {\n      border-color: var(--blue);\n      background: var(--blue);\n      color: #fff;\n    }\n\n    button.active {\n      border-color: var(--blue);\n      background: var(--blue);\n      color: #fff;\n    }\n\n    button:disabled {\n      cursor: not-allowed;\n      opacity: 0.6;\n    }\n\n    input,\n    select {\n      border: 1px solid #c5ced8;\n      border-radius: 6px;\n      background: #fff;\n      color: var(--ink);\n      min-height: 34px;\n      padding: 7px 9px;\n      width: 100%;\n    }\n\n    label {\n      display: inline-flex;\n      align-items: center;\n      gap: 6px;\n      min-height: 30px;\n      color: #344154;\n      font-size: 12px;\n      font-weight: 700;\n      white-space: nowrap;\n    }\n\n    label input[type=\"checkbox\"] {\n      width: auto;\n      min-height: auto;\n      padding: 0;\n    }\n\n    .app {\n      display: grid;\n      grid-template-rows: auto 1fr;\n      height: 100vh;\n      min-height: 720px;\n    }\n\n    header {\n      display: grid;\n      grid-template-columns: auto minmax(360px, 1fr) auto;\n      gap: 12px;\n      align-items: center;\n      padding: 12px 14px;\n      border-bottom: 1px solid var(--line);\n      background: rgba(255, 255, 255, 0.93);\n      backdrop-filter: blur(12px);\n      z-index: 5;\n    }\n\n    h1 {\n      margin: 0;\n      font-size: 19px;\n      letter-spacing: 0;\n    }\n\n    .route-bar {\n      display: grid;\n      grid-template-columns: minmax(240px, 1fr) auto auto auto;\n      gap: 8px;\n      align-items: center;\n    }\n\n    .file-button {\n      position: relative;\n      overflow: hidden;\n    }\n\n    .file-button input {\n      position: absolute;\n      inset: 0;\n      opacity: 0;\n      cursor: pointer;\n    }\n\n    .shell {\n      display: grid;\n      grid-template-columns: minmax(520px, 1fr) 390px;\n      gap: 12px;\n      min-height: 0;\n      padding: 12px;\n    }\n\n    .map-wrap,\n    .side {\n      border: 1px solid var(--line);\n      border-radius: 8px;\n      background: var(--panel);\n      box-shadow: var(--shadow);\n      min-height: 0;\n      overflow: hidden;\n    }\n\n    .map-wrap {\n      position: relative;\n    }\n\n    #mapCanvas {\n      touch-action: none;\n      overscroll-behavior: contain;\n      width: 100%;\n      height: 100%;\n      display: block;\n      cursor: grab;\n    }\n\n    #mapCanvas.dragging {\n      cursor: grabbing;\n    }\n\n    .gps-center-btn {\n      position: absolute;\n      left: 50%;\n      top: 96px;\n      bottom: auto;\n      z-index: 28;\n      min-height: 38px;\n      padding: 8px 14px;\n      border: 1px solid rgba(36, 79, 134, 0.75);\n      border-radius: 8px;\n      color: #f8fbff;\n      background: rgba(7, 17, 31, 0.92);\n      box-shadow: 0 8px 24px rgba(26, 34, 45, 0.25);\n      font-weight: 900;\n      letter-spacing: 0.06em;\n      transform: translateX(-50%);\n    }\n\n    .gps-center-btn[hidden] {\n      display: none;\n    }\n\n    .map-tools {\n      position: absolute;\n      left: 12px;\n      top: 12px;\n      display: grid;\n      gap: 8px;\n      max-width: calc(100% - 24px);\n    }\n\n    .tool-card {\n      display: flex;\n      flex-wrap: wrap;\n      gap: 7px;\n      align-items: center;\n      border: 1px solid rgba(52, 64, 80, 0.16);\n      border-radius: 8px;\n      background: rgba(255, 255, 255, 0.9);\n      padding: 8px;\n      box-shadow: 0 8px 24px rgba(26, 34, 45, 0.12);\n    }\n\n    .tool-card button {\n      min-height: 30px;\n      padding: 5px 8px;\n    }\n\n    .tool-card select,\n    .tool-card input[type=\"text\"],\n    .tool-card input[type=\"password\"] {\n      width: auto;\n      min-width: 190px;\n      min-height: 30px;\n      padding: 5px 8px;\n      font-size: 12px;\n    }\n\n    .tool-status {\n      color: var(--muted);\n      font-size: 12px;\n      max-width: 330px;\n      white-space: nowrap;\n      overflow: hidden;\n      text-overflow: ellipsis;\n    }\n\n    .traffic-attribution {\n      color: #17633f;\n      font-size: 11px;\n      font-weight: 800;\n      text-decoration: none;\n    }\n\n    .traffic-attribution:hover,\n    .traffic-attribution:focus-visible {\n      text-decoration: underline;\n    }\n\n    .safe-sky-key-row {\n      display: flex;\n      flex: 1 1 100%;\n      flex-wrap: wrap;\n      gap: 6px;\n      align-items: center;\n    }\n\n    .safe-sky-key-row input {\n      flex: 1 1 190px;\n    }\n\n    .tool-label {\n      color: #253246;\n      font-size: 12px;\n      font-weight: 800;\n      white-space: nowrap;\n    }\n\n    .point-menu {\n      position: absolute;\n      z-index: 4;\n      display: grid;\n      gap: 9px;\n      min-width: 230px;\n      max-width: min(310px, calc(100% - 24px));\n      border: 1px solid rgba(52, 64, 80, 0.2);\n      border-radius: 8px;\n      background: rgba(255, 255, 255, 0.96);\n      padding: 10px;\n      box-shadow: 0 14px 34px rgba(26, 34, 45, 0.18);\n    }\n\n    .point-menu[hidden] {\n      display: none;\n    }\n\n    .traffic-menu-details {\n      display: grid;\n      grid-template-columns: repeat(2, minmax(0, 1fr));\n      gap: 7px;\n    }\n\n    .traffic-menu-drag-handle {\n      cursor: grab;\n      touch-action: none;\n      user-select: none;\n    }\n\n    .traffic-menu-drag-handle.is-dragging {\n      cursor: grabbing;\n    }\n\n    .traffic-menu-detail {\n      display: grid;\n      gap: 2px;\n      min-width: 0;\n      padding: 6px 7px;\n      border: 1px solid rgba(52, 64, 80, 0.12);\n      border-radius: 7px;\n      background: rgba(238, 248, 249, 0.72);\n    }\n\n    .traffic-menu-detail span {\n      color: var(--muted);\n      font-size: 10px;\n      font-weight: 800;\n      letter-spacing: 0.04em;\n      text-transform: uppercase;\n    }\n\n    .traffic-menu-detail strong {\n      overflow: hidden;\n      color: #064f67;\n      font-size: 12px;\n      text-overflow: ellipsis;\n      white-space: nowrap;\n    }\n\n    .point-menu-head {\n      display: grid;\n      grid-template-columns: 1fr auto;\n      gap: 8px;\n      align-items: start;\n    }\n\n    .point-menu-title {\n      display: block;\n      color: #0f1f35;\n      font-size: 13px;\n      font-weight: 900;\n      line-height: 1.2;\n    }\n\n    .point-menu-meta {\n      display: block;\n      margin-top: 3px;\n      color: var(--muted);\n      font-size: 11px;\n      font-weight: 700;\n    }\n\n    .point-menu-close {\n      width: 28px;\n      min-height: 28px;\n      padding: 0;\n      font-weight: 900;\n    }\n\n    .point-menu-actions {\n      display: grid;\n      grid-template-columns: 1fr 1fr;\n      gap: 7px;\n    }\n\n    .point-menu-airport-actions {\n      display: grid;\n      grid-template-columns: repeat(2, minmax(0, 1fr));\n      gap: 7px;\n    }\n\n    .point-restriction-editor {\n      display: grid;\n      gap: 7px;\n      padding-top: 2px;\n      border-top: 1px solid rgba(52, 64, 80, 0.14);\n    }\n\n    .point-restriction-fields {\n      display: grid;\n      grid-template-columns: repeat(2, minmax(0, 1fr));\n      gap: 7px;\n    }\n\n    .point-restriction-fields label,\n    .point-restriction-label {\n      display: grid;\n      gap: 4px;\n      color: var(--muted);\n      font-size: 10px;\n      font-weight: 800;\n      letter-spacing: 0.04em;\n      text-transform: uppercase;\n    }\n\n    .point-restriction-fields input {\n      min-width: 0;\n    }\n\n    .point-restriction-mode {\n      display: grid;\n      grid-template-columns: repeat(3, minmax(0, 1fr));\n      gap: 6px;\n    }\n\n    .point-restriction-mode button {\n      min-height: 31px;\n      padding: 5px;\n      font-size: 11px;\n    }\n\n    .point-restriction-mode button.active {\n      border-color: #1f8293;\n      background: #d8f3f5;\n      color: #0f5867;\n    }\n\n    .point-restriction-actions {\n      display: grid;\n      grid-template-columns: repeat(2, minmax(0, 1fr));\n      gap: 7px;\n    }\n\n    .route-segment-menu {\n      min-width: 300px;\n    }\n\n    .route-segment-details {\n      display: grid;\n      grid-template-columns: repeat(3, minmax(0, 1fr));\n      gap: 7px;\n    }\n\n    .route-segment-detail {\n      display: grid;\n      gap: 2px;\n      min-width: 0;\n      padding: 7px;\n      border: 1px solid rgba(52, 64, 80, 0.12);\n      border-radius: 7px;\n      background: rgba(238, 248, 249, 0.72);\n    }\n\n    .route-segment-detail span {\n      color: var(--muted);\n      font-size: 10px;\n      font-weight: 800;\n      letter-spacing: 0.04em;\n      text-transform: uppercase;\n    }\n\n    .route-segment-detail strong {\n      overflow: hidden;\n      color: #064f67;\n      font-size: 12px;\n      text-overflow: ellipsis;\n      white-space: nowrap;\n    }\n\n    .route-segment-menu .primary {\n      grid-column: 1 / -1;\n    }\n\n    .airspace-inspector {\n      position: absolute;\n      z-index: 5;\n      display: grid;\n      gap: 10px;\n      width: min(720px, calc(100% - 24px));\n      max-height: min(620px, calc(100% - 24px));\n      overflow: auto;\n      border: 1px solid rgba(52, 64, 80, 0.22);\n      border-radius: 10px;\n      background: rgba(255, 255, 255, 0.97);\n      padding: 12px;\n      box-shadow: 0 18px 46px rgba(26, 34, 45, 0.24);\n    }\n\n    .airspace-inspector[hidden] {\n      display: none;\n    }\n\n    .airspace-inspector-body {\n      display: grid;\n      grid-template-columns: minmax(250px, 0.9fr) minmax(260px, 1.1fr);\n      gap: 12px;\n      align-items: start;\n    }\n\n    .airspace-profile-card,\n    .airspace-inspector-list {\n      min-width: 0;\n      border: 1px solid #d7dee7;\n      border-radius: 8px;\n      background: #fbfdff;\n      padding: 9px;\n    }\n\n    .airspace-profile-card {\n      display: grid;\n      gap: 7px;\n    }\n\n    .airspace-profile-title,\n    .airspace-inspector-list-title {\n      color: #344154;\n      font-size: 11px;\n      font-weight: 900;\n      letter-spacing: 0.06em;\n      text-transform: uppercase;\n    }\n\n    .airspace-profile {\n      display: block;\n      width: 100%;\n      min-height: 260px;\n    }\n\n    .airspace-profile-legend {\n      display: flex;\n      flex-wrap: wrap;\n      gap: 9px;\n      color: #526175;\n      font-size: 10px;\n      font-weight: 800;\n    }\n\n    .airspace-profile-legend span {\n      display: inline-flex;\n      align-items: center;\n      gap: 4px;\n    }\n\n    .airspace-profile-legend i {\n      display: inline-block;\n      width: 15px;\n      height: 3px;\n      border-radius: 99px;\n      background: #0f7898;\n    }\n\n    .airspace-profile-legend i.current {\n      background: #c4334d;\n    }\n\n    .airspace-zone-row {\n      display: grid;\n      grid-template-columns: auto minmax(0, 1fr);\n      gap: 8px;\n      padding: 8px 0;\n      border-top: 1px solid #edf0f4;\n    }\n\n    .airspace-zone-row:first-of-type {\n      border-top: 0;\n    }\n\n    .airspace-zone-swatch {\n      width: 9px;\n      min-height: 40px;\n      border-radius: 99px;\n    }\n\n    .airspace-zone-name {\n      color: #1c2c42;\n      font-size: 12px;\n      font-weight: 900;\n    }\n\n    .airspace-zone-limits {\n      margin-top: 2px;\n      color: #526175;\n      font-size: 11px;\n      font-weight: 800;\n    }\n\n    .airspace-service-list {\n      display: grid;\n      gap: 4px;\n      margin-top: 7px;\n    }\n\n    .airspace-service-row {\n      display: grid;\n      grid-template-columns: 46px minmax(0, 1fr) auto;\n      gap: 7px;\n      align-items: center;\n      padding: 5px 0 0;\n      border-top: 1px solid #edf0f4;\n      color: #526175;\n      font-size: 11px;\n    }\n\n    .airspace-service-row strong {\n      color: #334154;\n      font-size: 10px;\n      letter-spacing: 0.04em;\n    }\n\n    .airspace-service-row span {\n      overflow: hidden;\n      text-overflow: ellipsis;\n      white-space: nowrap;\n    }\n\n    .airspace-service-row b {\n      color: #064f67;\n      font-size: 12px;\n    }\n\n    .airspace-inspector-empty {\n      color: var(--muted);\n      font-size: 12px;\n    }\n\n    @media (max-width: 700px) {\n      .airspace-inspector-body {\n        grid-template-columns: 1fr;\n      }\n    }\n\n    .type-filter-card {\n      max-width: min(720px, calc(100vw - 24px));\n    }\n\n    .type-filters {\n      display: flex;\n      flex-wrap: wrap;\n      gap: 5px;\n      align-items: center;\n    }\n\n    .type-chip {\n      gap: 4px;\n      min-height: 28px;\n      border: 1px solid #ccd6e2;\n      border-radius: 999px;\n      background: #fff;\n      padding: 4px 7px;\n      color: #243247;\n    }\n\n    .type-chip input[type=\"checkbox\"] {\n      width: 13px;\n      height: 13px;\n    }\n\n    .type-chip small {\n      color: var(--muted);\n      font-size: 10px;\n      font-weight: 800;\n    }\n\n    .map-readout {\n      position: absolute;\n      left: 12px;\n      right: 12px;\n      bottom: 12px;\n      display: flex;\n      gap: 8px;\n      justify-content: space-between;\n      pointer-events: none;\n    }\n\n    .pill {\n      border: 1px solid rgba(52, 64, 80, 0.16);\n      border-radius: 999px;\n      background: rgba(255, 255, 255, 0.9);\n      padding: 6px 10px;\n      box-shadow: 0 8px 24px rgba(26, 34, 45, 0.12);\n      color: #334154;\n      font-size: 12px;\n      max-width: 70%;\n      white-space: nowrap;\n      overflow: hidden;\n      text-overflow: ellipsis;\n    }\n\n    .side {\n      display: grid;\n      grid-template-rows: auto auto 1fr;\n    }\n\n    .side-head {\n      display: grid;\n      gap: 9px;\n      padding: 12px;\n      border-bottom: 1px solid var(--line);\n    }\n\n    .source-row {\n      display: grid;\n      grid-template-columns: repeat(4, 1fr);\n      gap: 8px;\n    }\n\n    .tabs {\n      display: grid;\n      grid-template-columns: repeat(3, 1fr);\n      border-bottom: 1px solid var(--line);\n    }\n\n    .tab {\n      border: 0;\n      border-right: 1px solid var(--line);\n      border-radius: 0;\n      background: #fbfaf6;\n      min-height: 40px;\n      font-weight: 800;\n    }\n\n    .tab:last-child {\n      border-right: 0;\n    }\n\n    .tab.active {\n      background: #fff;\n      color: var(--blue);\n      box-shadow: inset 0 -3px 0 var(--blue);\n    }\n\n    .tab-body {\n      overflow: auto;\n      padding: 12px;\n      display: grid;\n      gap: 10px;\n      align-content: start;\n    }\n\n    .metric-grid {\n      display: grid;\n      grid-template-columns: repeat(3, 1fr);\n      gap: 8px;\n    }\n\n    .metric {\n      border: 1px solid #d7dee7;\n      border-radius: 8px;\n      padding: 9px;\n      background: #fbfdff;\n      display: grid;\n      gap: 3px;\n    }\n\n    .metric strong {\n      font-size: 18px;\n    }\n\n    .metric span {\n      color: var(--muted);\n      font-size: 11px;\n      font-weight: 800;\n      text-transform: uppercase;\n    }\n\n    .card {\n      border: 1px solid #d7dee7;\n      border-radius: 8px;\n      padding: 10px;\n      background: #fff;\n      display: grid;\n      gap: 7px;\n    }\n\n    .card-title {\n      display: flex;\n      justify-content: space-between;\n      gap: 8px;\n      font-weight: 800;\n    }\n\n    .muted {\n      color: var(--muted);\n      font-size: 12px;\n    }\n\n    .freq-line,\n    .zone-line,\n    .point-line {\n      display: grid;\n      grid-template-columns: 72px 1fr auto;\n      gap: 8px;\n      align-items: center;\n      padding: 6px 0;\n      border-top: 1px solid #edf0f4;\n      font-size: 12px;\n    }\n\n    .freq-line:first-of-type,\n    .zone-line:first-of-type,\n    .point-line:first-of-type {\n      border-top: 0;\n    }\n\n    .tag {\n      display: inline-flex;\n      align-items: center;\n      justify-content: center;\n      min-height: 20px;\n      border-radius: 999px;\n      padding: 2px 7px;\n      background: #eef3f8;\n      color: #344154;\n      font-size: 11px;\n      font-weight: 800;\n    }\n\n    .tag.hot {\n      background: #ffe8ec;\n      color: #a81731;\n    }\n\n    .status {\n      color: var(--muted);\n      font-size: 12px;\n    }\n\n    .embedded-layers-btn,\n    .embedded-layers-panel {\n      display: none;\n    }\n\n    body.embedded {\n      min-height: 100vh;\n      overflow: hidden;\n      background: #07111f;\n    }\n\n    body.embedded .app {\n      display: block;\n      height: 100vh;\n      min-height: 0;\n    }\n\n    body.embedded header,\n    body.embedded .map-tools,\n    body.embedded .side {\n      display: none;\n    }\n\n    body.embedded .shell {\n      display: block;\n      height: 100vh;\n      min-height: 0;\n      padding: 0;\n    }\n\n    body.embedded .map-wrap {\n      width: 100%;\n      height: 100vh;\n      border: 0;\n      border-radius: 0;\n      box-shadow: none;\n    }\n\n    body.embedded .map-readout {\n      left: 10px;\n      right: 5.4rem;\n      bottom: 10px;\n      max-width: calc(100% - 6rem);\n      flex-wrap: wrap;\n      justify-content: flex-start;\n    }\n\n    body.embedded .embedded-layers-btn {\n      position: absolute;\n      right: 12px;\n      bottom: 12px;\n      z-index: 30;\n      display: inline-flex;\n      align-items: center;\n      justify-content: center;\n      min-width: 64px;\n      min-height: 52px;\n      border: 1px solid rgba(185, 196, 209, 0.34);\n      border-radius: 12px;\n      color: #fff;\n      background: rgba(15, 29, 52, 0.96);\n      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);\n    }\n\n    body.embedded .embedded-layers-btn.active {\n      color: #07111f;\n      background: #7af3d3;\n    }\n\n    body.embedded .embedded-layers-panel {\n      position: absolute;\n      right: 12px;\n      bottom: 76px;\n      z-index: 29;\n      display: grid;\n      gap: 8px;\n      width: min(420px, calc(100% - 24px));\n      max-height: min(72vh, 620px);\n      overflow: auto;\n      padding: 10px;\n      border: 1px solid rgba(185, 196, 209, 0.28);\n      border-radius: 14px;\n      background: rgba(247, 244, 234, 0.96);\n      box-shadow: 0 22px 60px rgba(0, 0, 0, 0.28);\n      backdrop-filter: blur(16px);\n    }\n\n    body.embedded .embedded-layers-panel[hidden] {\n      display: none;\n    }\n\n    body.embedded .embedded-layer-section {\n      display: grid;\n      gap: 8px;\n    }\n\n    body.embedded .embedded-layer-section h1 {\n      font-size: 13px;\n      letter-spacing: 0.08em;\n      text-transform: uppercase;\n    }\n\n    body.embedded .embedded-layer-section .route-bar {\n      display: grid;\n      grid-template-columns: 1fr auto auto auto;\n      gap: 7px;\n    }\n\n    body.embedded .embedded-layer-section .source-row {\n      display: grid;\n      grid-template-columns: repeat(2, minmax(0, 1fr));\n      gap: 7px;\n    }\n\n    @media (max-width: 1100px) {\n      .app {\n        height: auto;\n      }\n\n      header,\n      .shell {\n        grid-template-columns: 1fr;\n      }\n\n      .map-wrap {\n        min-height: 620px;\n      }\n    }\n\n    @media (max-width: 700px) {\n      .route-bar,\n      .source-row,\n      .metric-grid {\n        grid-template-columns: 1fr;\n      }\n\n      .map-wrap {\n        min-height: 520px;\n      }\n    }\n  "}</style>
<div className={"app"}>
<header>
<h1>{"Airspace Map"}</h1>
<div className={"route-bar"}>
<input id={"routeInput"} type={"text"} defaultValue={"EPNT EPKK"} placeholder={"Trasa: EPNT 493000N 0194500E EPKK albo punkty IFR/VFR"} />
<button id={"buildRouteBtn"} className={"primary"} type={"button"}>{"Trasa"}</button>
<button id={"fitRouteBtn"} type={"button"}>{"Fit"}</button>
<label className={"file-button"}>
<button type={"button"}>{"GPX"}</button>
<input id={"gpxFile"} type={"file"} accept={".gpx,application/gpx+xml,text/xml"} />
</label>
</div>
<div className={"source-row"}>
<button id={"loadJsonBtn"} type={"button"}>{"airspaces.json"}</button>
<button id={"loadAllBtn"} type={"button"}>{"Wszystkie strefy"}</button>
<button id={"loadTodayBtn"} type={"button"}>{"Strefy dzisiaj"}</button>
<button id={"loadTomorrowBtn"} type={"button"}>{"Strefy jutro"}</button>
</div>
</header>
<main className={"shell"}>
<section className={"map-wrap"}>
<canvas id={"mapCanvas"}></canvas>
<button id={"embeddedLayersBtn"} className={"embedded-layers-btn"} type={"button"} hidden={true}>{"Layers"}</button>
<div id={"embeddedLayersPanel"} className={"embedded-layers-panel"} hidden={true}></div>
<button id={"gpsCenterBtn"} className={"gps-center-btn"} type={"button"} hidden={true}>{"CENTER"}</button>
<div className={"map-tools"}>
<div className={"tool-card"}>
<select id={"basemapSelect"} aria-label={"Basemap"}>
<option value={"osm"}>{"OpenStreetMap"}</option>
<option value={"black"}>{"Black"}</option>
</select>
<input id={"basemapTemplate"} type={"text"} placeholder={"XYZ URL {z}/{x}/{y}"} hidden={true} />
<input id={"basemapApiKey"} type={"password"} placeholder={"API key"} hidden={true} />
<button id={"saveBasemapBtn"} type={"button"} hidden={true}>{"OK"}</button>
<span id={"basemapStatus"} className={"tool-status"}></span>
</div>
<div className={"tool-card"}>
<label><input data-layer={"airspaces"} type={"checkbox"} defaultChecked={true} />{" Strefy"}</label>
<label><input data-layer={"airports"} type={"checkbox"} defaultChecked={true} />{" Lotniska"}</label>
<label><input data-layer={"vfr"} type={"checkbox"} defaultChecked={true} />{" VFR"}</label>
<label><input data-layer={"ifr"} type={"checkbox"} defaultChecked={true} />{" IFR"}</label>
<label><input data-layer={"navaids"} type={"checkbox"} defaultChecked={true} />{" Navaids"}</label>
<label><input data-layer={"route"} type={"checkbox"} defaultChecked={true} />{" Trasa"}</label>
<label><input data-layer={"traffic"} type={"checkbox"} defaultChecked={true} />{" Live traffic"}</label>
<label><input data-layer={"safeSkyTraffic"} type={"checkbox"} />{" SafeSky traffic"}</label>
<div className={"safe-sky-key-row"}>
<input id={"safeSkyTrafficApiKey"} type={"password"} autoComplete={"off"} placeholder={"SafeSky Public API key (lokalnie)"} />
<button id={"saveSafeSkyTrafficApiKeyBtn"} type={"button"}>{"Zapisz klucz"}</button>
<button id={"clearSafeSkyTrafficApiKeyBtn"} type={"button"}>{"Usun"}</button>
</div>
<span id={"trafficStatus"} className={"tool-status"}>{"ADSB.fi: off"}</span>
<a id={"trafficAttribution"} className={"traffic-attribution"} href={"https://airplanes.live/"} target={"_blank"} rel={"noopener noreferrer"}>{"Traffic source: Airplanes.live"}</a>
<span id={"safeSkyTrafficStatus"} className={"tool-status"}>{"SafeSky traffic: off"}</span>
<a id={"safeSkyTrafficAttribution"} className={"traffic-attribution"} href={"https://docs.safesky.app/books/safesky-public-api-for-traffic"} target={"_blank"} rel={"noopener noreferrer"}>{"Traffic: SafeSky Public API"}</a>
<label><input data-layer={"drones"} type={"checkbox"} />{" Drony SafeSky"}</label>
<div className={"safe-sky-key-row"}>
<input id={"safeSkyApiKey"} type={"password"} autoComplete={"off"} placeholder={"SafeSky API key (lokalnie)"} />
<button id={"saveSafeSkyApiKeyBtn"} type={"button"}>{"Zapisz klucz"}</button>
<button id={"clearSafeSkyApiKeyBtn"} type={"button"}>{"Usun"}</button>
</div>
<span id={"droneStatus"} className={"tool-status"}>{"SafeSky UAV: off"}</span>
<a id={"droneAttribution"} className={"traffic-attribution"} href={"https://docs.safesky.app/books/safesky-api-for-uav/page/live-uav-operations"} target={"_blank"} rel={"noopener noreferrer"}>{"Drony: SafeSky (kooperacyjne)"}</a>
<select id={"aupMode"}>
<option value={"current"}>{"AUP current"}</option>
<option value={"next"}>{"AUP next"}</option>
<option value={""}>{"Bez AUP"}</option>
</select>
</div>
<div className={"tool-card type-filter-card"}>
<span className={"tool-label"}>{"Typ strefy"}</span>
<div id={"airspaceTypeFilters"} className={"type-filters"}></div>
<button id={"selectAllTypesBtn"} type={"button"}>{"Wszystkie"}</button>
<button id={"clearTypesBtn"} type={"button"}>{"Wyczysc"}</button>
</div>
<div className={"tool-card"}>
<button id={"zoomInBtn"} type={"button"}>{"+"}</button>
<button id={"zoomOutBtn"} type={"button"}>{"-"}</button>
<button id={"resetViewBtn"} type={"button"}>{"Polska"}</button>
<button id={"gpsBtn"} type={"button"}>{"GPS"}</button>
<label><input id={"labelToggle"} type={"checkbox"} defaultChecked={true} />{" Etykiety"}</label>
</div>
</div>
<div className={"map-readout"}>
<div id={"mapStatus"} className={"pill"}>{"Gotowe."}</div>
<div id={"coordStatus"} className={"pill"}>{"--"}</div>
<div id={"gpsStatus"} className={"pill"}>{"GPS off"}</div>
</div>
<div id={"pointMenu"} className={"point-menu"} hidden={true}>
<div className={"point-menu-head"}>
<div>
<strong id={"pointMenuTitle"} className={"point-menu-title"}>{"Punkt"}</strong>
<span id={"pointMenuMeta"} className={"point-menu-meta"}>{"--"}</span>
</div>
<button id={"pointMenuCloseBtn"} className={"point-menu-close"} type={"button"} aria-label={"Zamknij"}>{"x"}</button>
</div>
<div className={"point-menu-actions"}>
<button id={"addPointToRouteBtn"} className={"primary"} type={"button"}>{"Add To Route"}</button>
<button id={"directToPointBtn"} type={"button"} disabled={true}>{"Direct to"}</button>
<button id={"pointWxBtn"} type={"button"} disabled={true} hidden={true}>{"WX"}</button>
<button id={"pointRestrictionBtn"} type={"button"} disabled={true} hidden={true}>{"Restriction"}</button>
<div id={"pointAirportActions"} className={"point-menu-airport-actions"} hidden={true}>
<button id={"pointNotamBtn"} type={"button"}>{"NOTAM"}</button>
<button id={"pointChartBtn"} type={"button"}>{"CHART"}</button>
</div>
</div>
<div id={"pointRestrictionEditor"} className={"point-restriction-editor"} hidden={true}>
<div className={"point-restriction-fields"}>
<label>{"Speed (kt)"}<input id={"pointRestrictionSpeed"} type={"number"} min={"1"} step={"1"} inputmode={"numeric"} placeholder={"--"} /></label>
<label>{"Altitude (ft)"}<input id={"pointRestrictionAltitude"} type={"number"} min={"0"} step={"100"} inputmode={"numeric"} placeholder={"--"} /></label>
</div>
<span className={"point-restriction-label"}>{"Altitude restriction"}</span>
<div id={"pointRestrictionMode"} className={"point-restriction-mode"}>
<button type={"button"} data-restriction-altitude-mode={"below"}>{"Below"}</button>
<button type={"button"} data-restriction-altitude-mode={"at"}>{"At"}</button>
<button type={"button"} data-restriction-altitude-mode={"above"}>{"Above"}</button>
</div>
<div className={"point-restriction-actions"}>
<button id={"pointRestrictionApplyBtn"} className={"primary"} type={"button"}>{"Apply"}</button>
<button id={"pointRestrictionClearBtn"} type={"button"}>{"Clear"}</button>
</div>
</div>
</div>
<div id={"routeSegmentMenu"} className={"point-menu route-segment-menu"} hidden={true}>
<div className={"point-menu-head"}>
<div>
<strong id={"routeSegmentMenuTitle"} className={"point-menu-title"}>{"Route segment"}</strong>
<span id={"routeSegmentMenuMeta"} className={"point-menu-meta"}>{"--"}</span>
</div>
<button id={"routeSegmentMenuCloseBtn"} className={"point-menu-close"} type={"button"} aria-label={"Close route segment"}>{"x"}</button>
</div>
<div id={"routeSegmentDetails"} className={"route-segment-details"}></div>
<div className={"point-menu-actions"}>
<button id={"routeCreateWaypointBtn"} className={"primary"} type={"button"}>{"Create waypoint"}</button>
</div>
</div>
<div id={"airspaceInspector"} className={"airspace-inspector"} hidden={true}>
<div className={"point-menu-head"}>
<div>
<strong id={"airspaceInspectorTitle"} className={"point-menu-title"}>{"Strefy w punkcie"}</strong>
<span id={"airspaceInspectorMeta"} className={"point-menu-meta"}>{"--"}</span>
</div>
<button id={"airspaceInspectorCloseBtn"} className={"point-menu-close"} type={"button"} aria-label={"Zamknij inspektor stref"}>{"x"}</button>
</div>
<div id={"airspaceInspectorBody"}></div>
</div>
<div id={"trafficMenu"} className={"point-menu"} hidden={true}>
<div id={"trafficMenuDragHandle"} className={"point-menu-head traffic-menu-drag-handle"}>
<div>
<strong id={"trafficMenuTitle"} className={"point-menu-title"}>{"Traffic"}</strong>
<span id={"trafficMenuMeta"} className={"point-menu-meta"}>{"--"}</span>
</div>
<button id={"trafficMenuCloseBtn"} className={"point-menu-close"} type={"button"} aria-label={"Close traffic details"}>{"x"}</button>
</div>
<div id={"trafficMenuDetails"} className={"traffic-menu-details"}></div>
</div>
</section>
<aside className={"side"}>
<div className={"side-head"}>
<div className={"metric-grid"}>
<div className={"metric"}><strong id={"metricAirspaces"}>{"0"}</strong><span>{"stref"}</span></div>
<div className={"metric"}><strong id={"metricRoute"}>{"0"}</strong><span>{"punktow trasy"}</span></div>
<div className={"metric"}><strong id={"metricCrossed"}>{"0"}</strong><span>{"przeciete"}</span></div>
</div>
<label className={"file-button"}>
<button type={"button"}>{"Wgraj OpenAir/JSON"}</button>
<input id={"openAirFile"} type={"file"} accept={".txt,.air,.openair,.json,text/plain,application/json"} />
</label>
<button id={"refreshCupBtn"} type={"button"}>{"Odswiez CUP API"}</button>
<div id={"sourceStatus"} className={"status"}>{"Ladowanie danych..."}</div>
</div>
<nav className={"tabs"}>
<button className={"tab active"} data-tab={"route"} type={"button"}>{"Trasa"}</button>
<button className={"tab"} data-tab={"radio"} type={"button"}>{"Radio"}</button>
<button className={"tab"} data-tab={"zones"} type={"button"}>{"Strefy"}</button>
</nav>
<div id={"tabBody"} className={"tab-body"}></div>
</aside>
</main>
</div>

















</>);}
