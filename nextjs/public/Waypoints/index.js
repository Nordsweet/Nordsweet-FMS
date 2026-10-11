(function () {
  const packageFiles = [
    "Poland.js"
  ];
  const baseUrl = document.currentScript && document.currentScript.src
    ? new URL(".", document.currentScript.src).href
    : "./waypoints/";

  window.NORDSWEET_WAYPOINT_PACKAGE_FILES = packageFiles.slice();

  packageFiles.forEach((src) => {
    document.write('<script src="' + baseUrl + src + '"></script>');
  });
})();
