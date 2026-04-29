// This script generates PWA icons from the SVG source.
// Run: node scripts/generate-icons.mjs
// Requires: sharp (npm install sharp --save-dev)

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, "..", "public", "icons", "icon.svg");
const svg = readFileSync(svgPath, "utf-8");

// Generate a simple HTML file that renders the icons
const html = `<!DOCTYPE html>
<html>
<head><title>REMI Bloom Icons</title></head>
<body style="background:#0e1513;display:flex;gap:20px;padding:20px;">
  <img src="icon.svg" width="192" height="192" />
  <img src="icon.svg" width="512" height="512" />
  <p style="color:#57f1db;font-family:sans-serif;">
    Screenshot this page and save as icon-192.png and icon-512.png
  </p>
</body>
</html>`;

writeFileSync(join(__dirname, "..", "public", "icons", "preview.html"), html);
console.log("Icon preview page generated at public/icons/preview.html");
console.log("Open it in a browser and screenshot for PNG icons.");
console.log("Or install sharp and run: npm install sharp && node scripts/generate-icons.mjs");

// Try using sharp if available
try {
  const sharp = (await import("sharp")).default;
  const sizes = [192, 512];
  for (const size of sizes) {
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(join(__dirname, "..", "public", "icons", `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }
} catch {
  console.log("\nSharp not available. Generated preview.html instead.");
  console.log("To generate PNG icons:\n  1. Open public/icons/preview.html in a browser");
  console.log("  2. Screenshot the icons and save as PNG");
  console.log("  Or: npm install sharp && node scripts/generate-icons.mjs");
}
