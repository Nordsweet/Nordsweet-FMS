// The local collector is used only for local/file builds. GitHub Pages cannot
// reach this loopback address and uses the deployed proxy configuration instead.
const nordsweetLocalTrafficHost = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname) || window.location.protocol === "file:";
window.NORDSWEET_TRAFFIC_SERVER_URL = nordsweetLocalTrafficHost ? "http://127.0.0.1:8766/api/traffic" : "";

// Optional: set this to the HTTPS address of the deployed adsb-traffic-proxy-worker.js.
// When empty, the app uses Airplanes.live as the browser-compatible external fallback.
window.NORDSWEET_TRAFFIC_PROXY_URL = "";
