/**
 * Valida manifest PWA e iconos (tamaños reales).
 * Uso: node scripts/validate-pwa-manifest.mjs
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import sharp from "sharp";

const publicDir = resolve(process.cwd(), "public");
const manifestPath = resolve(publicDir, "manifest.json");

const REQUIRED = [
  { path: "icons/icon-192x192.png", width: 192, height: 192 },
  { path: "icons/icon-512x512.png", width: 512, height: 512 },
  { path: "icons/icon-maskable-512x512.png", width: 512, height: 512 },
  { path: "icons/apple-touch-icon.png", width: 180, height: 180 },
];

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

async function main() {
  if (!existsSync(manifestPath)) fail("public/manifest.json missing");

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const requiredFields = [
    "name",
    "short_name",
    "start_url",
    "scope",
    "display",
    "theme_color",
    "background_color",
    "icons",
  ];
  for (const field of requiredFields) {
    if (!(field in manifest)) fail(`manifest missing field: ${field}`);
  }

  if (manifest.name !== "ATHRON" || manifest.short_name !== "ATHRON") {
    fail("manifest name/short_name must be ATHRON");
  }
  if (manifest.theme_color !== "#f97316" || manifest.background_color !== "#050505") {
    fail("manifest colors mismatch");
  }

  for (const icon of manifest.icons) {
    const filePath = resolve(publicDir, icon.src.replace(/^\//, ""));
    if (!existsSync(filePath)) fail(`manifest icon missing: ${icon.src}`);
  }

  for (const { path, width, height } of REQUIRED) {
    const filePath = resolve(publicDir, path);
    if (!existsSync(filePath)) fail(`missing ${path}`);
    const meta = await sharp(filePath).metadata();
    if (meta.width !== width || meta.height !== height) {
      fail(`${path} expected ${width}x${height}, got ${meta.width}x${meta.height}`);
    }
    console.log(`✓ ${path} (${width}x${height})`);
  }

  console.log("✓ manifest.json valid, all icons OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
