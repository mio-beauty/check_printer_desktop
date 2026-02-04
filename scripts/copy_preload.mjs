import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const src = path.join(root, "electron", "preload", "index.cjs");
const dstDir = path.join(root, "dist-electron", "preload");
const dst = path.join(dstDir, "index.cjs");

fs.mkdirSync(dstDir, { recursive: true });
fs.copyFileSync(src, dst);
console.log(`[copy_preload] ${src} -> ${dst}`);
