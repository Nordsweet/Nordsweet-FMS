import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Keep decoder/font versions identical to the pinned PDF.js engine and worker. No CDN requests.
const source = path.dirname(
  fileURLToPath(import.meta.resolve("pdfjs-dist/package.json")),
);
const target = path.resolve("public/pdfjs");
fs.mkdirSync(target, { recursive: true });
for (const directory of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  fs.cpSync(path.join(source, directory), path.join(target, directory), {
    recursive: true,
  });
}
fs.copyFileSync(path.join(source, "LICENSE"), path.join(target, "LICENSE"));
console.log("PDF.js fonts and image decoders ready for offline export.");
