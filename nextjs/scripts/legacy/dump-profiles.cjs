// Merged legacy aircraft profiles (as the legacy app sees them) → $LEGACY_DIR/profiles.json.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { legacyDir } = require("./legacy-functions.cjs");

const pub = path.join(legacyDir, "nextjs/public");
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(pub, "aircraft-data.js"), "utf8"),
  ctx,
);
// Type defaults before registration-specific files, which inherit from them.
const files = fs
  .readdirSync(path.join(pub, "aircraft-data"))
  .filter((f) => !f.includes("performance"))
  .sort((a, b) => a.includes(".SP-") - b.includes(".SP-"));
for (const f of files)
  vm.runInContext(
    fs.readFileSync(path.join(pub, "aircraft-data", f), "utf8"),
    ctx,
  );
const out = path.join(legacyDir, "profiles.json");
fs.writeFileSync(
  out,
  JSON.stringify(ctx.NORDSWEET_AIRCRAFT_DATA.profiles, null, 1),
);
console.log(
  Object.keys(ctx.NORDSWEET_AIRCRAFT_DATA.profiles).join(", "),
  "->",
  out,
);
