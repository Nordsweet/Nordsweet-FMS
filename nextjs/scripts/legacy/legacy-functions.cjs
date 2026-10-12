// Loads named top-level functions from a legacy runtime file into a fresh VM context, so their
// outputs can be recorded as golden fixtures. Usage:
//   const { load } = require("./legacy-functions.cjs");
//   const ctx = load(["getBracket", "lerp"], { perfFiles: ["p2006t"], prelude: "var X = 1;" });
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const legacyDir = process.env.LEGACY_DIR || "/tmp/nordsweet-legacy";
const runtime = (file) =>
  fs.readFileSync(path.join(legacyDir, "nextjs/src/runtime", file), "utf8");

/** Source of `function name(...) {...}` found by brace matching (top-level declarations only). */
function functionSource(src, name) {
  const start = src.search(
    new RegExp("^(async )?function " + name + "\\(", "m"),
  );
  if (start < 0) throw new Error("legacy function not found: " + name);
  let depth = 0;
  let i = src.indexOf("{", start);
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) break;
  }
  return src.slice(start, i + 1);
}

function load(
  names,
  { file = "index.js", perfFiles = [], publicFiles = [], prelude = "" } = {},
) {
  const ctx = { console };
  ctx.window = ctx;
  vm.createContext(ctx);
  const pub = (f) =>
    fs.readFileSync(path.join(legacyDir, "nextjs/public", f), "utf8");
  for (const f of publicFiles) vm.runInContext(pub(f), ctx);
  for (const f of perfFiles)
    vm.runInContext(pub(`aircraft-data/${f}-performance.js`), ctx);
  const src = runtime(file);
  vm.runInContext(
    names.map((n) => functionSource(src, n)).join("\n") + "\n" + prelude,
    ctx,
  );
  return ctx;
}

module.exports = { load, functionSource, legacyDir };
