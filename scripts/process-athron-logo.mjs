/**
 * Genera logo PNG sin fondo + imagen OG 1200x630 para WhatsApp.
 * Uso: node scripts/process-athron-logo.mjs
 */
import sharp from "sharp";
import { resolve } from "path";

const publicDir = resolve(process.cwd(), "public");
const source = resolve(
  publicDir,
  "athron-logo.jpg"
);

async function removeBlackBackground(inputBuffer) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    // Quitar negro y grises muy oscuros del fondo
    if (r < 40 && g < 40 && b < 40) {
      pixels[i + 3] = 0;
    } else if (r < 80 && g < 80 && b < 80) {
      pixels[i + 3] = Math.min(pixels[i + 3], Math.max(r, g, b) * 2);
    }
  }

  return sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png();
}

async function main() {
  const input = await sharp(source).toBuffer();
  const logoPng = await removeBlackBackground(input);

  await logoPng.toFile(resolve(publicDir, "athron-logo.png"));

  const logoMeta = await sharp(resolve(publicDir, "athron-logo.png")).metadata();
  const logoW = logoMeta.width ?? 1024;
  const logoH = logoMeta.height ?? 1024;

  const ogW = 1200;
  const ogH = 630;
  const maxLogoW = 520;
  const scale = maxLogoW / logoW;
  const resizedH = Math.round(logoH * scale);
  const resizedW = Math.round(logoW * scale);

  const resizedLogo = await sharp(resolve(publicDir, "athron-logo.png"))
    .resize(resizedW, resizedH, { fit: "inside" })
    .png()
    .toBuffer();

  const background = await sharp({
    create: {
      width: ogW,
      height: ogH,
      channels: 3,
      background: { r: 10, g: 10, b: 10 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();

  await sharp(background)
    .composite([
      {
        input: resizedLogo,
        gravity: "center",
      },
    ])
    .jpeg({ quality: 92 })
    .toFile(resolve(publicDir, "og-athron.jpg"));

  await sharp(resolve(publicDir, "athron-logo.png"))
    .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(resolve(publicDir, "og-athron.png"));

  console.log("✓ public/athron-logo.png (transparent)");
  console.log("✓ public/og-athron.jpg (1200x630 for WhatsApp)");
  console.log("✓ public/og-athron.png (square fallback)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
