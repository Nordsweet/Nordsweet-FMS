// React view; original controls and IDs are preserved for the flight engine.

export default function ChecklistEditorView(){return (<><style>{"\n:root {\n  --bg: #07111f;\n  --card: rgba(13, 26, 44, 0.94);\n  --soft: rgba(255, 255, 255, 0.055);\n  --line: rgba(143, 193, 255, 0.18);\n  --line-strong: rgba(143, 193, 255, 0.34);\n  --text: #edf7ff;\n  --muted: #9fb0c6;\n  --accent: #76f2a4;\n  --blue: #7fc7ff;\n  --danger: #ff6c7a;\n  --warning: #ffd08a;\n}\n\n* {\n  box-sizing: border-box;\n}\n\nbody {\n  margin: 0;\n  min-height: 100vh;\n  color: var(--text);\n  background:\n    radial-gradient(circle at 15% 8%, rgba(118, 242, 164, 0.15), transparent 30rem),\n    radial-gradient(circle at 84% 10%, rgba(127, 199, 255, 0.14), transparent 28rem),\n    linear-gradient(145deg, #06101d, #0a1424 45%, #050a12);\n  font-family: \"Segoe UI\", sans-serif;\n}\n\n.app {\n  width: min(1180px, calc(100% - 2rem));\n  margin: 0 auto;\n  padding: 1.2rem 0 2rem;\n}\n\n.hero,\n.panel {\n  border: 1px solid var(--line);\n  border-radius: 22px;\n  background: var(--card);\n  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);\n}\n\n.hero {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  gap: 1rem;\n  align-items: end;\n  padding: 1.1rem;\n  margin-bottom: 1rem;\n}\n\n.hero h1 {\n  margin: 0.2rem 0 0.35rem;\n  font-size: clamp(1.8rem, 4vw, 3.1rem);\n}\n\n.hero p,\n.help {\n  margin: 0;\n  color: var(--muted);\n  line-height: 1.45;\n}\n\n.toolbar {\n  display: grid;\n  grid-template-columns: minmax(11rem, 0.9fr) auto minmax(14rem, 1.1fr) auto;\n  gap: 0.75rem;\n  align-items: end;\n}\n\n.panel {\n  padding: 1rem;\n}\n\n.layout {\n  display: grid;\n  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);\n  gap: 0.85rem;\n}\n\n.stack {\n  display: grid;\n  gap: 0.75rem;\n}\n\nlabel {\n  display: block;\n  margin: 0 0 0.28rem;\n  color: var(--muted);\n  font-size: 0.78rem;\n  font-weight: 800;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n}\n\nselect,\ninput,\ntextarea,\nbutton {\n  width: 100%;\n  border: 1px solid var(--line);\n  border-radius: 14px;\n  color: var(--text);\n  background: rgba(255, 255, 255, 0.06);\n  font: inherit;\n}\n\nselect,\ninput,\ntextarea {\n  padding: 0.75rem;\n}\n\nselect {\n  color-scheme: dark;\n  background-color: #101d2f;\n}\n\nselect option {\n  color: #06101b;\n  background: #f4f8ff;\n}\n\ntextarea {\n  min-height: 7rem;\n  resize: vertical;\n}\n\nbutton {\n  min-height: 2.9rem;\n  padding: 0.7rem 0.9rem;\n  font-weight: 900;\n  letter-spacing: 0.06em;\n  text-transform: uppercase;\n  cursor: pointer;\n}\n\nbutton.primary {\n  color: #06101b;\n  background: linear-gradient(135deg, rgba(118, 242, 164, 0.98), rgba(127, 199, 255, 0.92));\n}\n\nbutton.secondary {\n  background: rgba(127, 199, 255, 0.12);\n}\n\nbutton.danger {\n  background: rgba(255, 108, 122, 0.15);\n  border-color: rgba(255, 108, 122, 0.34);\n}\n\n.row {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  gap: 0.55rem;\n  align-items: end;\n}\n\n.actions {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));\n  gap: 0.55rem;\n}\n\n.profile-grid {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 0.65rem;\n}\n\n.section-card,\n.item-card,\n.status,\n.export {\n  border: 1px solid var(--line);\n  border-radius: 18px;\n  background: var(--soft);\n}\n\n.section-card {\n  display: grid;\n  gap: 0.65rem;\n  padding: 0.75rem;\n}\n\n.section-head {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  gap: 0.55rem;\n  align-items: center;\n}\n\n.section-head strong {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.item-card {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;\n  gap: 0.45rem;\n  padding: 0.55rem;\n}\n\n.item-card button,\n.section-head button {\n  width: auto;\n  min-width: 2.6rem;\n  min-height: 2.4rem;\n  padding: 0.45rem 0.7rem;\n}\n\n.muted {\n  color: var(--muted);\n}\n\n.status {\n  min-height: 2.7rem;\n  padding: 0.72rem 0.85rem;\n  color: var(--muted);\n}\n\n.status.ok {\n  color: var(--accent);\n  border-color: rgba(118, 242, 164, 0.28);\n}\n\n.status.warn {\n  color: var(--warning);\n  border-color: rgba(255, 208, 138, 0.34);\n}\n\n.export {\n  min-height: 25rem;\n  font-family: Consolas, \"SFMono-Regular\", monospace;\n  font-size: 0.76rem;\n  line-height: 1.45;\n}\n\n@media (max-width: 900px) {\n  .hero,\n  .toolbar,\n  .layout,\n  .item-card,\n  .actions {\n    grid-template-columns: 1fr;\n  }\n}\n"}</style>
<main className={"app"}>
<section className={"hero"}>
<div>
<p>{"Local tool"}</p>
<h1>{"Airplane Data Editor"}</h1>
<p>{"Edytor checklist zapisujacy gotowy plik aircraft-data dla wybranego samolotu lub rejestracji."}</p>
</div>
<div className={"toolbar"}>
<div>
<label htmlFor={"aircraftSelect"}>{"Typ samolotu"}</label>
<select id={"aircraftSelect"}></select>
</div>
<button type={"button"} className={"secondary"} id={"addAircraftBtn"}>{"Add aircraft"}</button>
<div>
<label htmlFor={"checklistSelect"}>{"Edytowana checklista"}</label>
<select id={"checklistSelect"}></select>
</div>
<button type={"button"} className={"primary"} id={"addChecklistBtn"}>{"Add new"}</button>
</div>
</section>
<section className={"layout"}>
<div className={"panel stack"}>
<div className={"profile-grid"}>
<div>
<label htmlFor={"profileScopeSelect"}>{"Profile type"}</label>
<select id={"profileScopeSelect"}>
<option value={"basic"}>{"Basic aircraft"}</option>
<option value={"specific"}>{"Specific registration"}</option>
</select>
</div>
<div>
<label htmlFor={"powerplantSelect"}>{"Powerplant"}</label>
<select id={"powerplantSelect"}>
<option value={"reciprocating"}>{"Reciprocating"}</option>
<option value={"turbine"}>{"Turbine"}</option>
<option value={"jet"}>{"Jet"}</option>
</select>
</div>
<div>
<label htmlFor={"engineCountSelect"}>{"Engines"}</label>
<select id={"engineCountSelect"}>
<option value={"1"}>{"1 engine"}</option>
<option value={"2"}>{"2 engines"}</option>
<option value={"3"}>{"3 engines"}</option>
<option value={"4"}>{"4 engines"}</option>
</select>
</div>
<div>
<label htmlFor={"aircraftTypeInput"}>{"Type"}</label>
<input id={"aircraftTypeInput"} type={"text"} placeholder={"P2006T"} />
</div>
<div>
<label htmlFor={"aircraftRegistrationInput"}>{"Registration"}</label>
<input id={"aircraftRegistrationInput"} type={"text"} placeholder={"SP-SMW"} />
</div>
<div>
<label htmlFor={"displayNameInput"}>{"Display name"}</label>
<input id={"displayNameInput"} type={"text"} placeholder={"Tecnam P2006T"} />
</div>
<div>
<label htmlFor={"icaoTypeInput"}>{"ICAO type"}</label>
<input id={"icaoTypeInput"} type={"text"} placeholder={"P06T"} />
</div>
<div>
<label htmlFor={"basicFuelFlowSlLphInput"}>{"Fuel flow S.L. (L/h)"}</label>
<input id={"basicFuelFlowSlLphInput"} type={"number"} min={"0"} step={"0.1"} placeholder={"35"} />
</div>
<div>
<label htmlFor={"headwindLimitKtInput"}>{"Headwind limit (kt)"}</label>
<input id={"headwindLimitKtInput"} type={"number"} min={"0"} step={"1"} placeholder={"No limit"} />
</div>
<div>
<label htmlFor={"tailwindLimitKtInput"}>{"Tailwind limit (kt)"}</label>
<input id={"tailwindLimitKtInput"} type={"number"} min={"0"} step={"1"} placeholder={"10"} />
</div>
<div>
<label htmlFor={"crosswindLimitKtInput"}>{"Crosswind limit (kt)"}</label>
<input id={"crosswindLimitKtInput"} type={"number"} min={"0"} step={"1"} placeholder={"15"} />
</div>
</div>
<button type={"button"} className={"secondary"} id={"saveProfileBtn"}>{"Update profile"}</button>
<div className={"row"}>
<div>
<label htmlFor={"checklistNameInput"}>{"Checklist name"}</label>
<input id={"checklistNameInput"} type={"text"} placeholder={"Before Takeoff"} />
</div>
<button type={"button"} className={"secondary"} id={"renameChecklistBtn"}>{"Rename"}</button>
</div>
<div>
<label htmlFor={"checklistPhaseSelect"}>{"Flight phase / category"}</label>
<select id={"checklistPhaseSelect"}></select>
</div>
<div className={"actions"}>
<button type={"button"} className={"primary"} id={"addSectionBtn"}>{"Add section"}</button>
<button type={"button"} className={"secondary"} id={"duplicateChecklistBtn"}>{"Duplicate"}</button>
<button type={"button"} className={"danger"} id={"deleteChecklistBtn"}>{"Delete"}</button>
</div>
<div id={"sectionList"} className={"stack"}></div>
<div className={"status"} id={"statusBox"}>{"Ready."}</div>
</div>
<div className={"panel stack"}>
<div>
<label htmlFor={"exportBox"}>{"Export aircraft data file"}</label>
<textarea id={"exportBox"} className={"export"} spellCheck={"false"} defaultValue={""}></textarea>
</div>
<div className={"actions"}>
<button type={"button"} className={"primary"} id={"saveFileBtn"}>{"Save file"}</button>
<button type={"button"} className={"secondary"} id={"downloadBtn"}>{"Download JS"}</button>
<button type={"button"} className={"secondary"} id={"copyBtn"}>{"Copy export"}</button>
<button type={"button"} className={"danger"} id={"resetBtn"}>{"Reset local"}</button>
</div>
<p className={"help"}>{"Ten plik jest lokalnym edytorem. `Save file` dla profilu bazowego zapisuje istniejacy plik typu `aircraft-data/HUSK data.js`; dla konkretnej rejestracji zapisuje `aircraft-data/[ICAO].[REG]-data.js`, np. `P06T.SP-SMW-data.js`. `Download JS` jest fallbackiem, gdy przegladarka nie pozwala zapisac bezposrednio."}</p>
</div>
</section>
</main>














</>);}
