import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const root = path.resolve("out");
if (!fs.existsSync(path.join(root, "index.html")))
  throw Error("Next.js export missing");
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : [path.join(dir, e.name)],
    );
}
const entries = files(root).filter(
  (f) => path.basename(f) !== "precache-manifest.js",
);
// Include every framework chunk: a cached HTML document must have matching runtime assets.
const precache = entries
  .filter(
    (f) =>
      f.includes(path.sep + "_next" + path.sep) ||
      (/\.(html|js|json|svg)$/.test(f) &&
        !f.includes(path.sep + "charts" + path.sep)),
  )
  .map(
    (f) =>
      "/" +
      path.relative(root, f).split(path.sep).map(encodeURIComponent).join("/"),
  );
precache.push("/");
const digest = crypto.createHash("sha256");
for (const url of precache) {
  if (url !== "/")
    digest
      .update(url)
      .update(
        fs.readFileSync(path.join(root, decodeURIComponent(url.slice(1)))),
      );
}
fs.writeFileSync(
  path.join(root, "precache-manifest.js"),
  "self.NORDSWEET_PRECACHE=" +
    JSON.stringify({
      version: digest.digest("hex").slice(0, 16),
      urls: precache,
    }) +
    ";\n",
);
console.log("Next.js export ready: " + precache.length + " offline assets.");
