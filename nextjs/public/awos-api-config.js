// EPNT AWOS is queried only through the local companion service. This keeps
// credentials out of the browser bundle and out of GitHub Pages deployments.
(function () {
  "use strict";

  const localHost = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname) || window.location.protocol === "file:";
  window.NORDSWEET_AWOS_API_URL = localHost
    ? "http://127.0.0.1:8766/api/awos/metar"
    : "";
}());
