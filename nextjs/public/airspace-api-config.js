(function () {
  "use strict";

  window.NORDSWEET_AIRSPACE_API = {
    all: {
      url: "http://lotnik.org/strefy/Poland_Airspaces.txt",
      path: "import/Poland_Airspaces.txt",
      local: "airspace-data/Poland_Airspaces.txt",
      staticKey: "all",
      parser: "openair"
    },
    today: {
      url: "http://lotnik.org/strefy/Poland_Airspaces_TODAY.txt",
      path: "import/Poland_Airspaces_TODAY.txt",
      local: "airspace-data/Poland_Airspaces_TODAY.txt",
      staticKey: "today",
      parser: "openair"
    },
    tomorrow: {
      url: "http://lotnik.org/strefy/Poland_Airspaces_TOMORROW.txt",
      path: "import/Poland_Airspaces_TOMORROW.txt",
      local: "airspace-data/Poland_Airspaces_TOMORROW.txt",
      staticKey: "tomorrow",
      parser: "openair"
    },
    aup_today: {
      url: "https://airspace.pansa.pl/aup/current",
      path: "import/AUP_today.html",
      local: "airspace-data/pansa-aup-current.html",
      parser: "aup"
    },
    aup_tomorrow: {
      url: "https://airspace.pansa.pl/aup/next",
      path: "import/AUP_tomorrow.html",
      local: "airspace-data/pansa-aup-next.html",
      parser: "aup"
    },
    czech_geometry: {
      // Static Czech geometry. Keep activation data in the two separate AUP/UUP feeds below.
      local: "import/LKR320A.json",
      parser: "czech-lkr320a"
    },
    czech_aup_current: {
      url: "https://aup.ans.cz/",
      path: "airspace-data/czech-aup-current.json",
      local: "airspace-data/czech-aup-current.json",
      direct: false,
      parser: "czech-aup",
      kind: "czech-aup-current"
    },
    czech_aup_next: {
      url: "https://aup.ans.cz/",
      path: "airspace-data/czech-aup-next.json",
      local: "airspace-data/czech-aup-next.json",
      direct: false,
      parser: "czech-aup",
      kind: "czech-aup-next"
    },
    aerodromes: {
      url: "http://lotnik.org/pliki/Nasze_Trawniki_PunktyVFR_PL.cup",
      path: "import/Nasze_Trawniki_PunktyVFR_PL.cup",
      local: "Nasze_Trawniki_PunktyVFR_PL.cup",
      parser: "cup"
    }
  };
}());
