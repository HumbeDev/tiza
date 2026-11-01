// Copies runtime assets that libraries load by URL into public/vendor, so the app works offline.
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("public/vendor/mathlive", { recursive: true });
cpSync("node_modules/mathlive/fonts", "public/vendor/mathlive/fonts", { recursive: true });

// pdf.js: character maps, the 14 standard PDF fonts, image decoders (wasm) and color profiles.
for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  cpSync(`node_modules/pdfjs-dist/${dir}`, `public/vendor/pdfjs/${dir}`, { recursive: true });
}
