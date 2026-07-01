/**
 * Genera iconos PWA desde athron-logo.png.
 * Uso: node scripts/generate-pwa-icons.mjs
 */
import sharp from "sharp";
import { resolve } from "path";
import { mkdir as mkdirFs } from "fs/promises";

const publicDir = resolve(process.cwd(), "public");
const iconsDir = resolve(publicDir, "icons");
const source = resolve(publicDir, "athron-logo.png");

const BG = { r: 5, g: 5, b: 5, alpha: 1 };

async function iconWithLogo(size, logoScale, background = BG, rounded = false) {
  const logoSize = Math.round(size * logoScale);
  const logo = await sharp(source)
    .resize(logoSize, logoSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  let canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  });

  if (rounded) {
    const radius = Math.round(size * 0.18);
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/></svg>`
    );
    canvas = sharp(await canvas.png().toBuffer()).composite([
      { input: mask, blend: "dest-in" },
    ]);
  }

  return canvas
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

/** Maskable: logo ~52% del canvas (zona segura Android). */
async function maskableIcon(size) {
  const padding = Math.round(size * 0.1);
  const inner = size - padding * 2;
  const logoSize = Math.round(inner * 0.65);
  const logo = await sharp(source)
    .resize(logoSize, logoSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="#f97316" opacity="0.15"/></svg>`
        ),
        gravity: "center",
      },
      { input: logo, gravity: "center" },
    ])
    .png()
    .toBuffer();
}

async function main() {
  await mkdirFs(iconsDir, { recursive: true });

  const outputs = [
    ["icon-192x192.png", await iconWithLogo(192, 0.62)],
    ["icon-512x512.png", await iconWithLogo(512, 0.62)],
    ["icon-maskable-512x512.png", await maskableIcon(512)],
    ["apple-touch-icon.png", await iconWithLogo(180, 0.58, BG, true)],
  ];

  for (const [name, buffer] of outputs) {
    await sharp(buffer).toFile(resolve(iconsDir, name));
    console.log(`✓ public/icons/${name}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
