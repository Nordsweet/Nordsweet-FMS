// React view; original controls and IDs are preserved for the flight engine.

export default function PFDView(){return (<><style>{"\n    :root {\n      color-scheme: dark;\n      --bg: #06070a;\n      --panel: #101419;\n      --line: #39424d;\n      --text: #eef5ff;\n      --muted: #9facba;\n      --cyan: #23d8ff;\n      --green: #39ff7d;\n      --amber: #ffd24d;\n      --red: #ff4646;\n      --magenta: #ff40ff;\n    }\n\n    * {\n      box-sizing: border-box;\n    }\n\n    html,\n    body {\n      width: 100%;\n      min-height: 100%;\n      margin: 0;\n      background: radial-gradient(circle at 50% 0%, #161b21 0, var(--bg) 44rem);\n      color: var(--text);\n      font-family: \"Segoe UI\", Roboto, Arial, sans-serif;\n      letter-spacing: 0;\n    }\n\n    body {\n      min-height: 100vh;\n      overflow-x: hidden;\n    }\n\n    button,\n    input {\n      font: inherit;\n    }\n\n    .shell {\n      width: 100%;\n      max-width: 100vw;\n      min-height: 100vh;\n      display: grid;\n      grid-template-columns: minmax(28rem, 1fr) 18.5rem;\n      gap: 1rem;\n      align-items: center;\n      padding: 1rem;\n    }\n\n    .pfd-stage {\n      min-width: 0;\n      width: 100%;\n      display: flex;\n      justify-content: center;\n      align-items: center;\n    }\n\n    .display-frame {\n      min-width: 0;\n      max-width: 100%;\n      width: min(100%, calc((100vh - 2rem) * 4 / 3));\n      max-height: calc(100vh - 2rem);\n      aspect-ratio: 4 / 3;\n      padding: 0.55rem;\n      border: 1px solid #48525d;\n      border-radius: 0.5rem;\n      background:\n        linear-gradient(145deg, #202833, #050608 40%, #141a20),\n        #07090c;\n      box-shadow:\n        inset 0 0 0 1px rgba(255,255,255,0.05),\n        inset 0 0 3rem rgba(0,0,0,0.85),\n        0 1.25rem 3rem rgba(0,0,0,0.48);\n    }\n\n    canvas {\n      display: block;\n      min-width: 0;\n      max-width: 100%;\n      width: 100%;\n      height: 100%;\n      border-radius: 0.25rem;\n      background: #000;\n      touch-action: manipulation;\n    }\n\n    .control-panel {\n      min-width: 0;\n      align-self: stretch;\n      min-height: min(46rem, calc(100vh - 2rem));\n      display: flex;\n      flex-direction: column;\n      gap: 0.85rem;\n      padding: 1rem;\n      border: 1px solid #313a44;\n      border-radius: 0.5rem;\n      background: rgba(12, 15, 19, 0.94);\n      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.035);\n    }\n\n    .brand {\n      display: flex;\n      justify-content: space-between;\n      gap: 0.8rem;\n      align-items: flex-start;\n      border-bottom: 1px solid #26303a;\n      padding-bottom: 0.75rem;\n    }\n\n    .brand h1 {\n      margin: 0;\n      font-size: 1rem;\n      line-height: 1.15;\n      font-weight: 700;\n    }\n\n    .brand span {\n      display: block;\n      margin-top: 0.25rem;\n      color: var(--muted);\n      font-size: 0.75rem;\n      text-transform: uppercase;\n    }\n\n    .status-pill {\n      flex: 0 0 auto;\n      min-width: 4.7rem;\n      padding: 0.35rem 0.55rem;\n      border: 1px solid #596675;\n      border-radius: 0.3rem;\n      color: var(--amber);\n      background: #0b0f14;\n      text-align: center;\n      font-size: 0.78rem;\n      font-weight: 700;\n    }\n\n    .status-pill.live {\n      color: var(--green);\n      border-color: rgba(57,255,125,0.7);\n    }\n\n    .status-pill.fail {\n      color: var(--red);\n      border-color: rgba(255,70,70,0.7);\n    }\n\n    .button-grid {\n      display: grid;\n      grid-template-columns: 1fr 1fr;\n      gap: 0.55rem;\n    }\n\n    .button-grid button,\n    .wide-button {\n      min-height: 2.6rem;\n      border: 1px solid #465463;\n      border-radius: 0.35rem;\n      color: var(--text);\n      background: linear-gradient(#222a33, #111820);\n      box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);\n      cursor: pointer;\n      font-weight: 700;\n    }\n\n    .button-grid button:hover,\n    .wide-button:hover {\n      border-color: #7e8c9b;\n      background: linear-gradient(#2b3540, #151d26);\n    }\n\n    .button-grid button.active {\n      color: #001808;\n      border-color: rgba(57,255,125,0.9);\n      background: linear-gradient(#6fff9e, #2fce63);\n    }\n\n    .hidden-file {\n      position: absolute;\n      width: 1px;\n      height: 1px;\n      overflow: hidden;\n      opacity: 0;\n      pointer-events: none;\n    }\n\n    .wide-button {\n      width: 100%;\n    }\n\n    .data-table {\n      display: grid;\n      grid-template-columns: 1fr 1fr;\n      gap: 0.45rem;\n    }\n\n    .field {\n      min-width: 0;\n      border: 1px solid #26303a;\n      border-radius: 0.35rem;\n      padding: 0.55rem;\n      background: #070a0e;\n    }\n\n    .field label {\n      display: block;\n      margin-bottom: 0.3rem;\n      color: var(--muted);\n      font-size: 0.68rem;\n      font-weight: 700;\n      text-transform: uppercase;\n    }\n\n    .field output,\n    .field input {\n      display: block;\n      width: 100%;\n      min-width: 0;\n      color: var(--text);\n      background: transparent;\n      border: 0;\n      padding: 0;\n      font-size: 1rem;\n      font-weight: 800;\n      overflow-wrap: anywhere;\n    }\n\n    .field input {\n      border-bottom: 1px solid #405061;\n      outline: none;\n    }\n\n    .field input:focus {\n      border-bottom-color: var(--cyan);\n    }\n\n    .message {\n      min-height: 4.75rem;\n      margin-top: auto;\n      padding: 0.7rem;\n      border: 1px solid #343e48;\n      border-radius: 0.35rem;\n      background: #070a0e;\n      color: var(--muted);\n      font-size: 0.82rem;\n      line-height: 1.42;\n    }\n\n    .message strong {\n      color: var(--amber);\n    }\n\n    @media (max-width: 900px) {\n      body {\n        overflow-y: auto;\n      }\n\n      .shell {\n        grid-template-columns: 1fr;\n        align-items: start;\n        min-height: 100vh;\n      }\n\n      .display-frame {\n        width: min(100%, calc(100vw - 2rem));\n        max-height: none;\n      }\n\n      .control-panel {\n        width: min(100%, calc(100vw - 2rem));\n        min-height: 0;\n      }\n    }\n\n    @media (max-width: 520px) {\n      .shell {\n        padding: 0.55rem;\n        gap: 0.55rem;\n      }\n\n      .display-frame,\n      .control-panel {\n        border-radius: 0.35rem;\n      }\n\n      .display-frame {\n        width: calc(100vw - 1.4rem);\n        padding: 0.35rem;\n      }\n\n      .control-panel {\n        width: calc(100vw - 1.4rem);\n      }\n\n      .brand {\n        display: block;\n      }\n\n      .status-pill {\n        width: 4.7rem;\n        margin-top: 0.65rem;\n      }\n\n      .button-grid,\n      .data-table {\n        grid-template-columns: 1fr;\n      }\n    }\n  "}</style>
<main className={"shell"}>
<section className={"pfd-stage"} aria-label={"Primary flight display"}>
<div className={"display-frame"}>
<canvas id={"pfdCanvas"} width={"1024"} height={"768"} aria-label={"GPS primary flight display"}></canvas>
</div>
</section>
<aside className={"control-panel"} aria-label={"PFD controls"}>
<div className={"brand"}>
<div>
<h1>{"GPS PFD"}</h1>
<span>{"glass cockpit style"}</span>
</div>
<div id={"sourcePill"} className={"status-pill"}>{"OFF"}</div>
</div>
<div className={"button-grid"}>
<button id={"gpsButton"} type={"button"}>{"GPS"}</button>
<button id={"demoButton"} type={"button"}>{"SIM"}</button>
<button id={"gpxButton"} type={"button"}>{"GPX"}</button>
<button id={"attitudeButton"} type={"button"}>{"ATT"}</button>
<button id={"resetButton"} type={"button"}>{"RST"}</button>
</div>
<input id={"gpxInput"} className={"hidden-file"} type={"file"} accept={".gpx,application/gpx+xml,application/xml,text/xml"} />
<div className={"data-table"}>
<div className={"field"}>
<label htmlFor={"crsInput"}>{"CRS"}</label>
<input id={"crsInput"} type={"number"} min={"0"} max={"359"} defaultValue={"000"} inputmode={"numeric"} />
</div>
<div className={"field"}>
<label>{"UTC"}</label>
<output id={"utcValue"}>{"--:--:--"}</output>
</div>
<div className={"field"}>
<label>{"LAT"}</label>
<output id={"latValue"}>{"--"}</output>
</div>
<div className={"field"}>
<label>{"LON"}</label>
<output id={"lonValue"}>{"--"}</output>
</div>
<div className={"field"}>
<label>{"ACC"}</label>
<output id={"accValue"}>{"--"}</output>
</div>
<div className={"field"}>
<label>{"AGE"}</label>
<output id={"ageValue"}>{"--"}</output>
</div>
<div className={"field"}>
<label>{"GPX"}</label>
<output id={"gpxValue"}>{"--"}</output>
</div>
<div className={"field"}>
<label>{"LEG"}</label>
<output id={"legValue"}>{"--"}</output>
</div>
<div className={"field"}>
<label>{"DTK"}</label>
<output id={"dtkValue"}>{"--"}</output>
</div>
<div className={"field"}>
<label>{"DIS"}</label>
<output id={"disValue"}>{"--"}</output>
</div>
</div>
<button id={"copyButton"} className={"wide-button"} type={"button"}>{"COPY POS"}</button>
<div id={"statusMessage"} className={"message"} role={"status"} aria-live={"polite"}>
<strong>{"STBY"}</strong><br />{"\n        GPS OFF\n      "}</div>
</aside>
</main>

</>);}
