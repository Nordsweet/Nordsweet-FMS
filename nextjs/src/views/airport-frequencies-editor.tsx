// React view; original controls and IDs are preserved for the flight engine.

export default function AirportFrequenciesEditorView(){return (<><style>{"\n    :root {\n      --bg: #10141b;\n      --panel: #171d26;\n      --panel-2: #1d2530;\n      --panel-3: #222c38;\n      --line: #344253;\n      --line-soft: #293544;\n      --text: #eef4f8;\n      --muted: #aab7c4;\n      --muted-2: #7f8d9c;\n      --accent: #45c2b0;\n      --accent-2: #7dc9ff;\n      --warn: #f3bc5f;\n      --danger: #ef6b7b;\n      --ok: #78d889;\n      --violet: #b7a0ff;\n      --shadow: 0 20px 55px rgba(0, 0, 0, 0.28);\n    }\n\n    * {\n      box-sizing: border-box;\n    }\n\n    body {\n      margin: 0;\n      min-height: 100vh;\n      color: var(--text);\n      background:\n        linear-gradient(180deg, rgba(69, 194, 176, 0.09), transparent 18rem),\n        var(--bg);\n      font-family: \"Bahnschrift\", \"Segoe UI\", Arial, sans-serif;\n      letter-spacing: 0;\n    }\n\n    button,\n    input,\n    select,\n    textarea {\n      font: inherit;\n      letter-spacing: 0;\n    }\n\n    button {\n      min-height: 2.35rem;\n      border: 1px solid var(--line);\n      border-radius: 8px;\n      color: var(--text);\n      background: var(--panel-3);\n      cursor: pointer;\n    }\n\n    button:hover {\n      border-color: rgba(125, 201, 255, 0.65);\n    }\n\n    button:focus,\n    input:focus,\n    select:focus,\n    textarea:focus {\n      outline: 2px solid rgba(69, 194, 176, 0.6);\n      outline-offset: 2px;\n    }\n\n    button.primary {\n      color: #09201e;\n      border-color: transparent;\n      background: var(--accent);\n      font-weight: 800;\n    }\n\n    button.secondary {\n      background: transparent;\n    }\n\n    button.danger {\n      color: #ffdce1;\n      border-color: rgba(239, 107, 123, 0.5);\n      background: rgba(239, 107, 123, 0.12);\n    }\n\n    button.small {\n      min-height: 2rem;\n      padding: 0 0.65rem;\n      font-size: 0.82rem;\n    }\n\n    input,\n    select,\n    textarea {\n      width: 100%;\n      min-height: 2.35rem;\n      border: 1px solid var(--line);\n      border-radius: 8px;\n      color: var(--text);\n      background: #111821;\n      padding: 0.55rem 0.65rem;\n    }\n\n    textarea {\n      min-height: 4.5rem;\n      resize: vertical;\n    }\n\n    label {\n      display: grid;\n      gap: 0.32rem;\n      min-width: 0;\n      color: var(--muted);\n      font-size: 0.76rem;\n      font-weight: 800;\n      text-transform: uppercase;\n    }\n\n    .app-shell {\n      display: grid;\n      grid-template-rows: auto 1fr;\n      min-height: 100vh;\n    }\n\n    .topbar {\n      position: sticky;\n      top: 0;\n      z-index: 20;\n      display: grid;\n      grid-template-columns: minmax(16rem, 1fr) auto;\n      gap: 1rem;\n      align-items: center;\n      padding: 0.85rem 1rem;\n      border-bottom: 1px solid var(--line-soft);\n      background: rgba(16, 20, 27, 0.96);\n      backdrop-filter: blur(12px);\n    }\n\n    .brand {\n      min-width: 0;\n    }\n\n    .brand h1 {\n      margin: 0;\n      font-size: 1.18rem;\n      letter-spacing: 0;\n    }\n\n    .brand-row {\n      display: flex;\n      flex-wrap: wrap;\n      gap: 0.45rem;\n      align-items: center;\n      margin-top: 0.35rem;\n    }\n\n    .status-pill {\n      display: inline-flex;\n      align-items: center;\n      min-height: 1.45rem;\n      max-width: 100%;\n      border: 1px solid var(--line);\n      border-radius: 8px;\n      padding: 0 0.45rem;\n      color: var(--muted);\n      background: rgba(255, 255, 255, 0.03);\n      font-size: 0.75rem;\n      font-weight: 800;\n      overflow: hidden;\n      text-overflow: ellipsis;\n      white-space: nowrap;\n    }\n\n    .status-pill.ok {\n      color: var(--ok);\n      border-color: rgba(120, 216, 137, 0.32);\n      background: rgba(120, 216, 137, 0.08);\n    }\n\n    .status-pill.warn {\n      color: var(--warn);\n      border-color: rgba(243, 188, 95, 0.34);\n      background: rgba(243, 188, 95, 0.08);\n    }\n\n    .top-actions {\n      display: flex;\n      flex-wrap: wrap;\n      justify-content: flex-end;\n      gap: 0.5rem;\n    }\n\n    .top-actions button {\n      min-width: 7.2rem;\n      padding: 0 0.8rem;\n    }\n\n    .workspace {\n      display: grid;\n      grid-template-columns: minmax(15rem, 19rem) minmax(0, 1fr) minmax(20rem, 27rem);\n      gap: 1rem;\n      padding: 1rem;\n      align-items: start;\n    }\n\n    .panel {\n      min-width: 0;\n      border: 1px solid var(--line-soft);\n      border-radius: 8px;\n      background: rgba(23, 29, 38, 0.94);\n      box-shadow: var(--shadow);\n    }\n\n    .panel-head {\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n      gap: 0.7rem;\n      padding: 0.8rem;\n      border-bottom: 1px solid var(--line-soft);\n    }\n\n    .panel-head h2,\n    .panel-head h3 {\n      margin: 0;\n      font-size: 0.96rem;\n      letter-spacing: 0;\n    }\n\n    .panel-body {\n      padding: 0.8rem;\n    }\n\n    .sidebar {\n      position: sticky;\n      top: 5.4rem;\n    }\n\n    .airport-filter {\n      display: grid;\n      gap: 0.55rem;\n      padding: 0.8rem;\n      border-bottom: 1px solid var(--line-soft);\n    }\n\n    .airport-list {\n      display: grid;\n      max-height: calc(100vh - 14rem);\n      overflow: auto;\n    }\n\n    .airport-btn {\n      display: grid;\n      grid-template-columns: minmax(0, 1fr) auto;\n      gap: 0.55rem;\n      align-items: center;\n      width: 100%;\n      min-height: 3.15rem;\n      border: 0;\n      border-bottom: 1px solid var(--line-soft);\n      border-radius: 0;\n      padding: 0.55rem 0.75rem;\n      text-align: left;\n      background: transparent;\n    }\n\n    .airport-btn:hover,\n    .airport-btn.active {\n      background: rgba(69, 194, 176, 0.11);\n    }\n\n    .airport-title {\n      display: block;\n      overflow: hidden;\n      text-overflow: ellipsis;\n      white-space: nowrap;\n      font-weight: 800;\n    }\n\n    .airport-name {\n      display: block;\n      margin-top: 0.1rem;\n      overflow: hidden;\n      text-overflow: ellipsis;\n      white-space: nowrap;\n      color: var(--muted);\n      font-size: 0.77rem;\n    }\n\n    .count-badge {\n      display: inline-grid;\n      place-items: center;\n      min-width: 2rem;\n      height: 1.65rem;\n      border: 1px solid rgba(125, 201, 255, 0.32);\n      border-radius: 8px;\n      color: var(--accent-2);\n      background: rgba(125, 201, 255, 0.08);\n      font-size: 0.78rem;\n      font-weight: 800;\n      font-variant-numeric: tabular-nums;\n    }\n\n    .main-panel {\n      display: grid;\n      gap: 0.8rem;\n    }\n\n    .stats-grid {\n      display: grid;\n      grid-template-columns: repeat(6, minmax(0, 1fr));\n      gap: 0.7rem;\n    }\n\n    .stat {\n      min-height: 4rem;\n      border: 1px solid var(--line-soft);\n      border-radius: 8px;\n      background: var(--panel);\n      padding: 0.72rem;\n    }\n\n    .stat span {\n      display: block;\n      color: var(--muted);\n      font-size: 0.72rem;\n      font-weight: 800;\n      text-transform: uppercase;\n    }\n\n    .stat strong {\n      display: block;\n      margin-top: 0.35rem;\n      overflow: hidden;\n      text-overflow: ellipsis;\n      white-space: nowrap;\n      font-size: 1.28rem;\n      font-variant-numeric: tabular-nums;\n    }\n\n    .filter-grid {\n      display: grid;\n      grid-template-columns: minmax(12rem, 1fr) minmax(10rem, 14rem) minmax(9rem, 11rem);\n      gap: 0.7rem;\n      align-items: end;\n    }\n\n    .service-strip {\n      display: flex;\n      flex-wrap: wrap;\n      gap: 0.45rem;\n    }\n\n    .service-chip {\n      display: inline-flex;\n      gap: 0.35rem;\n      align-items: center;\n      width: auto;\n      min-height: 2rem;\n      padding: 0 0.6rem;\n      border-radius: 8px;\n      color: var(--muted);\n      background: var(--panel);\n      font-size: 0.8rem;\n      font-weight: 800;\n    }\n\n    .service-chip.active {\n      color: #08201d;\n      background: var(--accent);\n      border-color: transparent;\n    }\n\n    .group-list {\n      display: grid;\n      gap: 0.75rem;\n    }\n\n    .service-group {\n      border: 1px solid var(--line-soft);\n      border-radius: 8px;\n      overflow: hidden;\n      background: var(--panel);\n    }\n\n    .service-head {\n      display: flex;\n      justify-content: space-between;\n      gap: 0.75rem;\n      align-items: center;\n      min-height: 2.9rem;\n      padding: 0.65rem 0.75rem;\n      border-bottom: 1px solid var(--line-soft);\n      background: var(--panel-2);\n    }\n\n    .service-head-title {\n      display: flex;\n      gap: 0.55rem;\n      align-items: center;\n      min-width: 0;\n    }\n\n    .service-code {\n      display: inline-grid;\n      place-items: center;\n      width: 3.4rem;\n      height: 1.8rem;\n      border-radius: 8px;\n      color: #071d1a;\n      background: var(--accent);\n      font-size: 0.72rem;\n      font-weight: 900;\n    }\n\n    .service-head strong {\n      overflow: hidden;\n      text-overflow: ellipsis;\n      white-space: nowrap;\n      font-size: 0.98rem;\n    }\n\n    .entry-list {\n      display: grid;\n      gap: 0.45rem;\n      padding: 0.6rem;\n    }\n\n    .entry-row {\n      display: grid;\n      grid-template-columns: minmax(6rem, 7.5rem) minmax(0, 1fr) auto;\n      gap: 0.6rem;\n      align-items: center;\n      min-height: 3.3rem;\n      border: 1px solid transparent;\n      border-radius: 8px;\n      background: rgba(255, 255, 255, 0.035);\n      padding: 0.45rem;\n    }\n\n    .entry-row:hover {\n      border-color: rgba(125, 201, 255, 0.26);\n    }\n\n    .freq-button {\n      width: 100%;\n      min-height: 2.4rem;\n      padding: 0 0.55rem;\n      color: var(--accent-2);\n      background: rgba(125, 201, 255, 0.08);\n      border-color: rgba(125, 201, 255, 0.22);\n      font-size: 1rem;\n      font-weight: 900;\n      font-variant-numeric: tabular-nums;\n    }\n\n    .entry-meta {\n      min-width: 0;\n    }\n\n    .entry-meta strong,\n    .entry-meta span {\n      display: block;\n      overflow: hidden;\n      text-overflow: ellipsis;\n      white-space: nowrap;\n    }\n\n    .entry-meta strong {\n      font-size: 0.88rem;\n    }\n\n    .entry-meta span {\n      margin-top: 0.12rem;\n      color: var(--muted);\n      font-size: 0.78rem;\n    }\n\n    .entry-title {\n      display: flex;\n      gap: 0.4rem;\n      align-items: center;\n      min-width: 0;\n    }\n\n    .entry-title strong {\n      min-width: 0;\n    }\n\n    .priority-badge {\n      display: inline-flex;\n      align-items: center;\n      flex: 0 0 auto;\n      min-height: 1.25rem;\n      border: 1px solid rgba(125, 201, 255, 0.24);\n      border-radius: 8px;\n      padding: 0 0.42rem;\n      color: var(--accent-2);\n      background: rgba(125, 201, 255, 0.08);\n      font-size: 0.62rem;\n      font-weight: 900;\n    }\n\n    .priority-badge.secondary {\n      color: var(--warn);\n      border-color: rgba(243, 188, 95, 0.32);\n      background: rgba(243, 188, 95, 0.08);\n    }\n\n    .entry-actions {\n      display: flex;\n      gap: 0.35rem;\n      align-items: center;\n    }\n\n    .entry-actions button {\n      width: 2.35rem;\n      min-width: 2.35rem;\n      padding: 0;\n      font-weight: 900;\n    }\n\n    .editor-panel {\n      position: sticky;\n      top: 5.4rem;\n    }\n\n    .editor-form {\n      display: grid;\n      gap: 0.75rem;\n    }\n\n    .two-cols {\n      display: grid;\n      grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);\n      gap: 0.65rem;\n    }\n\n    .frequency-rows {\n      display: grid;\n      gap: 0.65rem;\n    }\n\n    .frequency-row {\n      display: grid;\n      gap: 0.55rem;\n      border: 1px solid var(--line-soft);\n      border-radius: 8px;\n      background: rgba(255, 255, 255, 0.025);\n      padding: 0.65rem;\n    }\n\n    .row-head {\n      display: grid;\n      grid-template-columns: minmax(7.5rem, 0.8fr) minmax(7rem, 0.7fr) minmax(10rem, 1.2fr) auto;\n      gap: 0.55rem;\n      align-items: end;\n    }\n\n    .form-actions {\n      display: grid;\n      grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);\n      gap: 0.6rem;\n    }\n\n    .message {\n      min-height: 2.35rem;\n      border: 1px solid var(--line);\n      border-radius: 8px;\n      padding: 0.58rem 0.65rem;\n      color: var(--muted);\n      background: rgba(255, 255, 255, 0.03);\n      font-size: 0.84rem;\n    }\n\n    .message.ok {\n      color: var(--ok);\n      border-color: rgba(120, 216, 137, 0.32);\n      background: rgba(120, 216, 137, 0.08);\n    }\n\n    .message.warn {\n      color: var(--warn);\n      border-color: rgba(243, 188, 95, 0.34);\n      background: rgba(243, 188, 95, 0.08);\n    }\n\n    .empty {\n      border: 1px dashed var(--line);\n      border-radius: 8px;\n      padding: 1rem;\n      color: var(--muted);\n      background: rgba(255, 255, 255, 0.02);\n    }\n\n    .hidden {\n      display: none !important;\n    }\n\n    @media (max-width: 1180px) {\n      .workspace {\n        grid-template-columns: minmax(14rem, 18rem) minmax(0, 1fr);\n      }\n\n      .editor-panel {\n        position: static;\n        grid-column: 1 / -1;\n      }\n    }\n\n    @media (max-width: 860px) {\n      .topbar,\n      .workspace,\n      .stats-grid,\n      .filter-grid,\n      .two-cols,\n      .row-head,\n      .form-actions {\n        grid-template-columns: 1fr;\n      }\n\n      .sidebar {\n        position: static;\n      }\n\n      .airport-list {\n        max-height: 18rem;\n      }\n\n      .entry-row {\n        grid-template-columns: 1fr;\n      }\n\n      .entry-actions {\n        justify-content: stretch;\n      }\n\n      .entry-actions button {\n        width: 100%;\n      }\n    }\n  "}</style>
<div className={"app-shell"}>
<header className={"topbar"}>
<div className={"brand"}>
<h1>{"Airport Frequencies Editor"}</h1>
<div className={"brand-row"}>
<span id={"sourceStatus"} className={"status-pill"}>{"Loading"}</span>
<span id={"draftStatus"} className={"status-pill"}>{"Draft"}</span>
<span id={"dbStatus"} className={"status-pill"}>{"DB"}</span>
</div>
</div>
<div className={"top-actions"}>
<button id={"loadDbBtn"} type={"button"} className={"secondary"}>{"Load DB"}</button>
<button id={"saveDbBtn"} type={"button"} className={"secondary"}>{"Save DB"}</button>
<button id={"exportJsonBtn"} type={"button"} className={"secondary"}>{"Export JSON"}</button>
<button id={"exportJsBtn"} type={"button"} className={"primary"}>{"Export JS"}</button>
</div>
</header>
<main className={"workspace"}>
<aside className={"panel sidebar"}>
<div className={"panel-head"}>
<h2>{"Lotniska"}</h2>
<button id={"allAirportsBtn"} type={"button"} className={"small secondary"}>{"All"}</button>
</div>
<div className={"airport-filter"}>
<label>{"\n            Szukaj lotniska\n            "}<input id={"airportSearch"} type={"search"} placeholder={"EPBA, Krakow, Tower"} />
</label>
</div>
<div id={"airportList"} className={"airport-list"}></div>
</aside>
<section className={"main-panel"}>
<div className={"stats-grid"}>
<div className={"stat"}><span>{"Lotniska"}</span><strong id={"airportCount"}>{"0"}</strong></div>
<div className={"stat"}><span>{"Czestotliwosci"}</span><strong id={"entryCount"}>{"0"}</strong></div>
<div className={"stat"}><span>{"Primary"}</span><strong id={"primaryCount"}>{"0"}</strong></div>
<div className={"stat"}><span>{"Secondary"}</span><strong id={"secondaryCount"}>{"0"}</strong></div>
<div className={"stat"}><span>{"Widoczne"}</span><strong id={"visibleCount"}>{"0"}</strong></div>
<div className={"stat"}><span>{"Wybrane"}</span><strong id={"selectedAirport"}>{"All"}</strong></div>
</div>
<section className={"panel"}>
<div className={"panel-body"}>
<div className={"filter-grid"}>
<label>{"\n                Szukaj wpisu\n                "}<input id={"entrySearch"} type={"search"} placeholder={"frequency, callsign, service"} />
</label>
<label>{"\n                Sluzba\n                "}<select id={"serviceFilter"}></select>
</label>
<label>{"\n                Sort\n                "}<select id={"sortMode"}>
<option value={"service"}>{"Sluzba"}</option>
<option value={"frequency"}>{"Czestotliwosc"}</option>
<option value={"airport"}>{"Lotnisko"}</option>
</select>
</label>
</div>
<div id={"serviceStrip"} className={"service-strip"} style={{"marginTop":"0.75rem"}}></div>
</div>
</section>
<section className={"panel"}>
<div className={"panel-head"}>
<h2>{"Lista"}</h2>
<button id={"clearLocalBtn"} type={"button"} className={"small danger"}>{"Reset local"}</button>
</div>
<div id={"frequencyGroups"} className={"panel-body group-list"}></div>
</section>
</section>
<aside className={"panel editor-panel"}>
<div className={"panel-head"}>
<h2 id={"editorTitle"}>{"Dodaj czestotliwosci"}</h2>
<button id={"cancelEditBtn"} type={"button"} className={"small secondary hidden"}>{"Cancel"}</button>
</div>
<div className={"panel-body"}>
<form id={"frequencyForm"} className={"editor-form"}>
<div className={"two-cols"}>
<label>{"\n                Kod lotniska\n                "}<input id={"airportCodeInput"} list={"airportCodeList"} autoComplete={"off"} placeholder={"EPBA"} />
</label>
<label>{"\n                Nazwa lotniska\n                "}<input id={"airportNameInput"} autoComplete={"off"} placeholder={"Bielsko Biala"} />
</label>
</div>
<datalist id={"airportCodeList"}></datalist>
<div id={"frequencyRows"} className={"frequency-rows"}></div>
<button id={"addServiceRowBtn"} type={"button"} className={"secondary"}>{"Add service row"}</button>
<div className={"form-actions"}>
<button id={"submitBtn"} type={"submit"} className={"primary"}>{"Zapisz wpisy"}</button>
<button id={"clearFormBtn"} type={"button"} className={"secondary"}>{"Clear form"}</button>
</div>
<div id={"formMessage"} className={"message"}>{"Ready"}</div>
</form>
</div>
</aside>
</main>
</div>



</>);}
