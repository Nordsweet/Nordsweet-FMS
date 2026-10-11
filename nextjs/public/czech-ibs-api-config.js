// Czech IBS uses a session cookie and CSRF token, so it is fetched through the
// local companion service instead of exposing that browser-only complexity.
(function () {
  "use strict";

  const localHost = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname) || window.location.protocol === "file:";
  window.NORDSWEET_CZECH_IBS_API_URL = localHost
    ? "http://127.0.0.1:8766/api/czech-ibs/datis"
    : "";
}());
