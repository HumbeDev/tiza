// Copies runtime assets that libraries load by URL into public/vendor, so the app works offline.
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("public/vendor/mathlive", { recursive: true });
cpSync("node_modules/mathlive/fonts", "public/vendor/mathlive/fonts", { recursive: true });
