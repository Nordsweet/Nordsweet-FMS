// Local traffic identity database. Keys are normalized ICAO 24-bit HEX addresses.
// A live callsign remains the preferred display label; registration is the fallback.
window.NORDSWEET_TRAFFIC_IDENTITY_DATABASE = Object.freeze({
  D031DB: Object.freeze({
    registration: "SP-4015"
  }),
  "3ED229": Object.freeze({
    registration: "D-KUNX"
  }),
  "52C7A8": Object.freeze({
    registration: "SP-3181"
  }),
  "48F9CD": Object.freeze({
    registration: "SP-SMON"
  }),
  DDEAF9: Object.freeze({
    registration: "D-KWOS"
  })
});
