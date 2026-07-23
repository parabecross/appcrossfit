import { toPng } from "html-to-image";
import {
  embedImagesForExport,
  getLegacyCardCaptureRoot,
} from "@/lib/legacy/embed-export-images";
import { isMobileExportDevice } from "@/lib/legacy/legacy-device";
import {
  devLog,
  preloadImage,
  suspendAnimations,
  waitForFontsReady,
  waitForPaintFrames,
} from "@/lib/legacy/preload-image";
import type { LegacyCardFormat } from "@/lib/legacy/types";
import { LEGACY_CARD_DIMENSIONS } from "@/lib/legacy/types";

const MIN_PNG_DATA_URL_LENGTH = 500;

async function ensureCaptureImagesReady(root: HTMLElement): Promise<void> {
  const photoEl = root.querySelector(
    "[data-legacy-photo]"
  ) as HTMLImageElement | null;

  if (photoEl) {
    const src = photoEl.currentSrc || photoEl.src;
    if (!src) {
      throw new Error("PHOTO_NOT_READY");
    }
    const result = await preloadImage(src);
    if (!result.ok) {
      throw new Error(result.cors ? "PHOTO_CORS" : "PHOTO_NOT_READY");
    }
    if (photoEl.src !== result.url) {
      photoEl.src = result.url;
    }
    await waitForPaintFrames(2);
  }

  const logoEls = Array.from(
    root.querySelectorAll<HTMLImageElement>("img:not([data-legacy-photo])")
  );
  for (const logoEl of logoEls) {
    const src = logoEl.currentSrc || logoEl.src;
    if (!src || src.startsWith("data:")) continue;
    const result = await preloadImage(src);
    if (result.ok && logoEl.src !== result.url) {
      logoEl.src = result.url;
    }
  }
}

export async function exportCardToPng(
  element: HTMLElement,
  format: LegacyCardFormat
): Promise<string> {
  const { width, height } = LEGACY_CARD_DIMENSIONS[format];
  const captureRoot = getLegacyCardCaptureRoot(element);
  const mobile = isMobileExportDevice();
  const restoreAnimations = suspendAnimations(captureRoot);
  const restoreImages = await embedImagesForExport(captureRoot);

  try {
    await waitForFontsReady();
    await waitForPaintFrames(2);
    await ensureCaptureImagesReady(captureRoot);
    await waitForPaintFrames(2);

    devLog("export started", { width, height, format });

    const dataUrl = await toPng(captureRoot, {
      width,
      height,
      pixelRatio: mobile ? 1 : 2,
      cacheBust: true,
      skipAutoScale: true,
      skipFonts: true,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: "none",
      },
    });

    devLog("export complete", {
      canvasSize: `${width}x${height}`,
      dataUrlLength: dataUrl.length,
    });

    if (!dataUrl || dataUrl.length < MIN_PNG_DATA_URL_LENGTH) {
      throw new Error("EMPTY_EXPORT");
    }

    return dataUrl;
  } finally {
    restoreImages();
    restoreAnimations();
  }
}

export function downloadPng(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export async function sharePng(
  dataUrl: string,
  filename: string,
  title: string
): Promise<"shared" | "downloaded"> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  devLog("blob size", { size: blob.size });

  if (blob.size === 0) {
    throw new Error("EMPTY_BLOB");
  }

  const file = new File([blob], filename, { type: "image/png" });

  if (
    typeof navigator !== "undefined" &&
    navigator.share &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      devLog("share started", { filename, blobSize: blob.size });
      await navigator.share({ files: [file], title, text: title });
      return "shared";
    } catch (error) {
      devLog("share failed", { error: String(error) });
      // iOS share sheet dismissed or failed — fall back to download
    }
  }

  downloadPng(dataUrl, filename);
  return "downloaded";
}

export function legacyFilename(
  athleteName: string,
  format: LegacyCardFormat
): string {
  const slug = athleteName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `athlete-card-${slug || "legacy"}-${format}.png`;
}
