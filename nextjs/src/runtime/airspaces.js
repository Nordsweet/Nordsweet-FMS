export async function start(loadScript) {

    (function () {
      "use strict";
      const target = new URL("./airspaces-map.html", window.location.href);
      target.search = window.location.search;
      target.hash = window.location.hash;
      window.location.replace(target.toString());
    }());
  
}
