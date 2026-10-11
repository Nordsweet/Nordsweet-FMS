// React view; original controls and IDs are preserved for the flight engine.

export default function AirspacesEditorView(){return (<><style>{"\n    :root {\n      color-scheme: light;\n      --bg: #f4f1e8;\n      --panel: #ffffff;\n      --ink: #1e2732;\n      --muted: #677281;\n      --line: #d7d2c6;\n      --accent: #234f8f;\n      --accent-2: #b82f48;\n      --soft: #eef3f8;\n      --shadow: 0 18px 42px rgba(28, 38, 50, 0.14);\n    }\n\n    * {\n      box-sizing: border-box;\n    }\n\n    body {\n      margin: 0;\n      min-height: 100vh;\n      background: var(--bg);\n      color: var(--ink);\n      font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;\n    }\n\n    button,\n    input,\n    select,\n    textarea {\n      font: inherit;\n    }\n\n    button {\n      border: 1px solid #b9c3cf;\n      border-radius: 6px;\n      background: #fff;\n      color: var(--ink);\n      min-height: 34px;\n      padding: 7px 10px;\n      cursor: pointer;\n    }\n\n    button.primary {\n      border-color: var(--accent);\n      background: var(--accent);\n      color: #fff;\n    }\n\n    button.danger {\n      border-color: var(--accent-2);\n      color: var(--accent-2);\n    }\n\n    button:disabled {\n      opacity: 0.45;\n      cursor: default;\n    }\n\n    input,\n    select,\n    textarea {\n      width: 100%;\n      border: 1px solid #c6ced8;\n      border-radius: 6px;\n      background: #fff;\n      color: var(--ink);\n      padding: 8px 9px;\n    }\n\n    textarea {\n      min-height: 118px;\n      resize: vertical;\n      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;\n      font-size: 12px;\n      line-height: 1.35;\n    }\n\n    label {\n      display: grid;\n      gap: 5px;\n      color: var(--muted);\n      font-size: 12px;\n      font-weight: 700;\n      letter-spacing: 0.02em;\n      text-transform: uppercase;\n    }\n\n    .app {\n      display: grid;\n      grid-template-rows: auto 1fr;\n      height: 100vh;\n      min-height: 720px;\n    }\n\n    header {\n      display: grid;\n      grid-template-columns: minmax(260px, 1fr) auto;\n      gap: 16px;\n      align-items: center;\n      padding: 14px 18px;\n      border-bottom: 1px solid var(--line);\n      background: rgba(255, 255, 255, 0.92);\n      backdrop-filter: blur(12px);\n      position: sticky;\n      top: 0;\n      z-index: 5;\n    }\n\n    h1 {\n      margin: 0;\n      font-size: 20px;\n      letter-spacing: 0;\n    }\n\n    .subtitle {\n      color: var(--muted);\n      font-size: 12px;\n      margin-top: 2px;\n    }\n\n    .top-actions,\n    .row {\n      display: flex;\n      gap: 8px;\n      align-items: center;\n      flex-wrap: wrap;\n    }\n\n    .layout {\n      display: grid;\n      grid-template-columns: 340px minmax(420px, 1fr) 390px;\n      gap: 12px;\n      padding: 12px;\n      height: 100%;\n      min-height: 0;\n    }\n\n    .panel {\n      background: var(--panel);\n      border: 1px solid var(--line);\n      border-radius: 8px;\n      box-shadow: var(--shadow);\n      min-height: 0;\n    }\n\n    .source-panel,\n    .edit-panel {\n      display: grid;\n      grid-template-rows: auto auto 1fr;\n      overflow: hidden;\n    }\n\n    .panel-head {\n      padding: 12px;\n      border-bottom: 1px solid var(--line);\n      display: grid;\n      gap: 8px;\n    }\n\n    .panel-head strong {\n      font-size: 13px;\n    }\n\n    .source-grid,\n    .form-grid {\n      display: grid;\n      gap: 9px;\n    }\n\n    .source-grid {\n      grid-template-columns: 1fr 1fr;\n    }\n\n    .zone-list {\n      overflow: auto;\n      padding: 8px;\n      display: grid;\n      gap: 6px;\n      align-content: start;\n    }\n\n    .zone-item {\n      width: 100%;\n      text-align: left;\n      display: grid;\n      gap: 4px;\n      border-color: #d6dce4;\n      background: #fff;\n    }\n\n    .zone-item.active {\n      border-color: var(--accent);\n      box-shadow: inset 3px 0 0 var(--accent);\n      background: #f5f8fc;\n    }\n\n    .zone-title {\n      display: flex;\n      justify-content: space-between;\n      gap: 8px;\n      font-weight: 700;\n      font-size: 12px;\n    }\n\n    .zone-meta {\n      color: var(--muted);\n      font-size: 11px;\n      white-space: nowrap;\n      overflow: hidden;\n      text-overflow: ellipsis;\n    }\n\n    .badge {\n      display: inline-flex;\n      align-items: center;\n      justify-content: center;\n      min-height: 20px;\n      border-radius: 999px;\n      padding: 2px 7px;\n      background: #eef3f8;\n      color: #304154;\n      font-size: 11px;\n      font-weight: 800;\n    }\n\n    .badge.hot {\n      background: #ffe7eb;\n      color: #a81731;\n    }\n\n    .map-panel {\n      position: relative;\n      overflow: hidden;\n      height: 100%;\n      min-height: 520px;\n    }\n\n    #mapCanvas {\n      width: 100%;\n      height: 100%;\n      display: block;\n      cursor: crosshair;\n    }\n\n    .map-tools {\n      position: absolute;\n      left: 12px;\n      top: 12px;\n      display: grid;\n      gap: 8px;\n      max-width: calc(100% - 24px);\n      z-index: 2;\n    }\n\n    .tool-card {\n      display: flex;\n      flex-wrap: wrap;\n      gap: 7px;\n      align-items: center;\n      border: 1px solid rgba(42, 55, 70, 0.16);\n      border-radius: 8px;\n      background: rgba(255, 255, 255, 0.9);\n      padding: 8px;\n      box-shadow: 0 8px 24px rgba(24, 33, 44, 0.12);\n    }\n\n    .tool-card button {\n      min-height: 30px;\n      padding: 5px 8px;\n    }\n\n    .tool-card select,\n    .tool-card input[type=\"text\"],\n    .tool-card input[type=\"password\"] {\n      width: auto;\n      min-width: 190px;\n      min-height: 30px;\n      padding: 5px 8px;\n      font-size: 12px;\n    }\n\n    .tool-status {\n      color: var(--muted);\n      font-size: 12px;\n      max-width: 320px;\n      white-space: nowrap;\n      overflow: hidden;\n      text-overflow: ellipsis;\n    }\n\n    .map-status {\n      position: absolute;\n      left: 12px;\n      right: 12px;\n      bottom: 12px;\n      display: flex;\n      gap: 8px;\n      justify-content: space-between;\n      align-items: center;\n      pointer-events: none;\n    }\n\n    .pill {\n      max-width: 100%;\n      border: 1px solid rgba(42, 55, 70, 0.16);\n      border-radius: 999px;\n      background: rgba(255, 255, 255, 0.88);\n      padding: 6px 10px;\n      color: #334154;\n      font-size: 12px;\n      box-shadow: 0 8px 24px rgba(24, 33, 44, 0.12);\n      white-space: nowrap;\n      overflow: hidden;\n      text-overflow: ellipsis;\n    }\n\n    .edit-scroll {\n      overflow: auto;\n      padding: 12px;\n    }\n\n    .two {\n      display: grid;\n      grid-template-columns: 1fr 1fr;\n      gap: 9px;\n    }\n\n    .three {\n      display: grid;\n      grid-template-columns: 1fr 1fr 1fr;\n      gap: 9px;\n    }\n\n    .section {\n      display: grid;\n      gap: 9px;\n      padding: 12px 0;\n      border-top: 1px solid var(--line);\n    }\n\n    .section:first-child {\n      border-top: 0;\n      padding-top: 0;\n    }\n\n    .section-title {\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      gap: 8px;\n      font-weight: 800;\n      font-size: 13px;\n    }\n\n    .freq-results,\n    .freq-picked {\n      display: grid;\n      gap: 5px;\n      max-height: 150px;\n      overflow: auto;\n    }\n\n    .freq-picked {\n      margin-bottom: 8px;\n    }\n\n    .freq-picker-row {\n      display: grid;\n      grid-template-columns: minmax(0, 1fr) auto;\n      gap: 8px;\n      align-items: center;\n    }\n\n    .freq-picker-row select {\n      min-width: 0;\n    }\n\n    .freq-picker-row button {\n      white-space: nowrap;\n    }\n\n    .freq-source-row {\n      display: flex;\n      flex-wrap: wrap;\n      gap: 8px;\n      align-items: center;\n    }\n\n    .freq-source-row button {\n      min-height: 30px;\n      padding: 5px 9px;\n      font-size: 12px;\n    }\n\n    .freq-row,\n    .freq-chip {\n      display: grid;\n      grid-template-columns: 1fr auto;\n      align-items: center;\n      gap: 8px;\n      border: 1px solid #d7dfe8;\n      border-radius: 6px;\n      padding: 6px 8px;\n      background: #fbfdff;\n      font-size: 12px;\n    }\n\n    .freq-chip {\n      border-color: #79bd8d;\n      background: #e8f7ee;\n      color: #164a2c;\n      font-weight: 700;\n    }\n\n    .freq-chip button {\n      border-color: #8fc89e;\n      background: #ffffff;\n      color: #164a2c;\n    }\n\n    .freq-row button,\n    .freq-chip button {\n      min-height: 26px;\n      padding: 3px 7px;\n      font-size: 12px;\n    }\n\n    .status {\n      color: var(--muted);\n      font-size: 12px;\n    }\n\n    .file-inline {\n      position: relative;\n      overflow: hidden;\n    }\n\n    .file-inline input {\n      position: absolute;\n      inset: 0;\n      opacity: 0;\n      cursor: pointer;\n    }\n\n    @media (max-width: 1180px) {\n      .layout {\n        grid-template-columns: 320px 1fr;\n      }\n\n      .edit-panel {\n        grid-column: 1 / -1;\n        min-height: 560px;\n      }\n    }\n\n    @media (max-width: 760px) {\n      header,\n      .layout {\n        grid-template-columns: 1fr;\n      }\n\n      .map-panel {\n        min-height: 420px;\n      }\n    }\n  "}</style>
<div className={"app"}>
<header>
<div>
<h1>{"Airspaces Editor"}</h1>
<div className={"subtitle"}>{"airspaces.json + PANSA AUP + lokalne czestotliwosci"}</div>
</div>
<div className={"top-actions"}>
<button id={"saveLocalBtn"} type={"button"}>{"Zapis lokalny"}</button>
<button id={"loadLocalBtn"} type={"button"}>{"Wczytaj lokalny"}</button>
<button id={"exportJsonBtn"} className={"primary"} type={"button"}>{"Eksport JSON"}</button>
</div>
</header>
<main className={"layout"}>
<section className={"panel source-panel"}>
<div className={"panel-head"}>
<strong>{"Zrodla"}</strong>
<div className={"source-grid"}>
<button data-api-source={"all"} data-label={"Poland_Airspaces API"}>{"Pelny plik API"}</button>
<button data-day-filter={"current"} type={"button"}>{"Pokaz dzisiaj"}</button>
<button data-day-filter={"next"} type={"button"}>{"Pokaz jutro"}</button>
<label className={"file-inline"}>
<button type={"button"}>{"Wgraj OpenAir/JSON"}</button>
<input id={"openAirFile"} type={"file"} accept={".txt,.air,.openair,.json,text/plain,application/json"} />
</label>
</div>
<div className={"source-grid"}>
<button data-api-aup={"aup_today"} data-api-aup-mode={"currentAup"} data-label={"PANSA current API"}>{"AUP dzisiaj"}</button>
<button data-api-aup={"aup_tomorrow"} data-api-aup-mode={"nextAup"} data-label={"PANSA next API"}>{"AUP jutro"}</button>
</div>
<label>{"\n            Aktywny AUP\n            "}<select id={"aupMode"}>
<option value={"current"}>{"Dzisiaj"}</option>
<option value={"next"}>{"Jutro"}</option>
<option value={""}>{"Bez AUP"}</option>
</select>
</label>
<div id={"aupStatus"} className={"status"}>{"AUP nie wczytany."}</div>
<textarea id={"pasteArea"} placeholder={"Wklej OpenAir, airspaces.json albo HTML AUP i nacisnij import."} defaultValue={""}></textarea>
<div className={"row"}>
<button id={"importPasteOpenAirBtn"} type={"button"}>{"Import OpenAir/JSON"}</button>
<button id={"importPasteAupBtn"} type={"button"}>{"Import AUP"}</button>
</div>
<label>{"\n            Filtr\n            "}<input id={"zoneSearch"} type={"search"} placeholder={"Nazwa, typ, wysokosc"} />
</label>
<label>{"\n            Typ\n            "}<select id={"typeFilter"}></select>
</label>
<div id={"sourceStatus"} className={"status"}>{"Gotowe."}</div>
</div>
<div id={"zoneList"} className={"zone-list"}></div>
</section>
<section className={"panel map-panel"}>
<canvas id={"mapCanvas"}></canvas>
<div className={"map-tools"}>
<div className={"tool-card"}>
<select id={"basemapSelect"} aria-label={"Basemap"}>
<option value={"chart"}>{"Lotniczy szkic"}</option>
<option value={"osm"}>{"OpenStreetMap"}</option>
<option value={"openaip"}>{"OpenAIP"}</option>
<option value={"skyvector"}>{"SkyVector"}</option>
<option value={"google_roadmap"}>{"Google Maps"}</option>
<option value={"google_satellite"}>{"Google Satellite"}</option>
</select>
<input id={"basemapTemplate"} type={"text"} placeholder={"XYZ URL {z}/{x}/{y}"} hidden={true} />
<input id={"basemapApiKey"} type={"password"} placeholder={"API key"} hidden={true} />
<button id={"saveBasemapBtn"} type={"button"} hidden={true}>{"OK"}</button>
<button id={"resetEditorViewBtn"} type={"button"}>{"Polska"}</button>
<button id={"fitZonesBtn"} type={"button"}>{"Fit strefy"}</button>
<span id={"basemapStatus"} className={"tool-status"}></span>
</div>
</div>
<div className={"map-status"}>
<div id={"mapHint"} className={"pill"}>{"Kliknij polygon, aby dodac wierzcholek; kliknij circle, aby ustawic srodek."}</div>
<div id={"mapCount"} className={"pill"}>{"0 stref"}</div>
</div>
</section>
<section className={"panel edit-panel"}>
<div className={"panel-head"}>
<strong>{"Edycja strefy"}</strong>
<div className={"row"}>
<button id={"newPolygonBtn"} className={"primary"} type={"button"}>{"Nowy polygon"}</button>
<button id={"newCircleBtn"} className={"primary"} type={"button"}>{"Nowy circle"}</button>
<button id={"duplicateBtn"} type={"button"}>{"Duplikuj"}</button>
<button id={"deleteBtn"} className={"danger"} type={"button"}>{"Usun"}</button>
</div>
<div id={"editorStatus"} className={"status"}>{"Wybierz strefe z listy albo dodaj nowa."}</div>
</div>
<div className={"edit-scroll"}>
<div className={"section"}>
<div className={"two"}>
<label>{"\n                Nazwa / designator\n                "}<input id={"zoneName"} type={"text"} placeholder={"EPXX ATZ"} />
</label>
<label>{"\n                Klasyfikacja\n                "}<select id={"zoneKind"}></select>
</label>
</div>
<div className={"three"}>
<label>{"\n                OpenAir AC\n                "}<input id={"zoneClass"} type={"text"} placeholder={"G"} />
</label>
<label>{"\n                Dolna granica\n                "}<input id={"zoneLower"} type={"text"} placeholder={"GND"} />
</label>
<label>{"\n                Gorna granica\n                "}<input id={"zoneUpper"} type={"text"} placeholder={"FL95"} />
</label>
</div>
<label>{"\n              Ksztalt\n              "}<select id={"zoneShape"}>
<option value={"polygon"}>{"Wielokat"}</option>
<option value={"circle"}>{"Okrag"}</option>
</select>
</label>
</div>
<div id={"polygonSection"} className={"section"}>
<div className={"section-title"}>
<span>{"Wielokat"}</span>
<button id={"reversePointsBtn"} type={"button"}>{"Odwroc kolejnosc"}</button>
</div>
<label>{"\n              Wspolrzedne punktow\n              "}<textarea id={"polygonPoints"} placeholder={"52:34:53 N 014:38:00 E\n52.5000, 19.0000"} defaultValue={""}></textarea>
</label>
</div>
<div id={"circleSection"} className={"section"} hidden={true}>
<div className={"section-title"}>{"Okrag"}</div>
<div className={"three"}>
<label>{"\n                Srodek lat\n                "}<input id={"circleLat"} type={"number"} step={"0.000001"} placeholder={"52.000000"} />
</label>
<label>{"\n                Srodek lon\n                "}<input id={"circleLon"} type={"number"} step={"0.000001"} placeholder={"19.000000"} />
</label>
<label>{"\n                Promien NM\n                "}<input id={"circleRadius"} type={"number"} step={"0.1"} min={"0"} placeholder={"5"} />
</label>
</div>
</div>
<div className={"section"}>
<div className={"section-title"}>{"Czestotliwosci"}</div>
<div id={"freqPicked"} className={"freq-picked"}></div>
<label>{"\n              Szukaj w airport-frequencies-data\n              "}<input id={"freqSearch"} type={"search"} placeholder={"EPKK, Tower, 123.250, Krakow"} />
</label>
<div className={"freq-source-row"}>
<button id={"reloadFrequenciesBtn"} type={"button"} className={"secondary"}>{"Odswiez dane"}</button>
<div id={"freqSourceStatus"} className={"status"}>{"airport-frequencies-data.js"}</div>
</div>
<div className={"freq-picker-row"}>
<select id={"freqSelect"} aria-label={"Wybierz czestotliwosc"}></select>
<button id={"addSelectedFreqBtn"} type={"button"}>{"Dodaj wybrana"}</button>
</div>
<div id={"freqResults"} className={"freq-results"}></div>
</div>
</div>
</section>
</main>
</div>









</>);}
