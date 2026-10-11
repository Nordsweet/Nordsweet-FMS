// React view; original controls and IDs are preserved for the flight engine.

export default function TrafficView(){return (<><style>{"\n    :root {\n      color-scheme: dark;\n      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;\n      background: #07111f;\n    }\n\n    html,\n    body {\n      width: 100%;\n      height: 100%;\n      margin: 0;\n      overflow: hidden;\n      background: #07111f;\n    }\n\n    .traffic-shell {\n      position: relative;\n      width: 100vw;\n      height: 100vh;\n    }\n\n    .traffic-map {\n      display: block;\n      width: 100%;\n      height: 100%;\n      border: 0;\n      background: #07111f;\n    }\n  "}</style>
<main className={"traffic-shell"}>
<iframe className={"traffic-map"} title={"Live traffic map"} src={"./airspaces.html?embed=1&traffic=1&trafficOnly=1"} loading={"eager"}></iframe>
</main>
</>);}
