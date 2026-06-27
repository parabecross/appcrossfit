import { toPng } from "html-to-image";
import type { LegacyCardFormat } from "@/lib/legacy/types";
import { LEGACY_CARD_DIMENSIONS } from "@/lib/legacy/types";

export async function exportCardToPng(
  element: HTMLElement,
  format: LegacyCardFormat
): Promise<string> {
  const { width, height } = LEGACY_CARD_DIMENSIONS[format];

  return toPng(element, {
    width,
    height,
    pixelRatio: 2,
    cacheBust: true,
    skipAutoScale: true,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: "none",
    },
  });
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
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], filename, { type: "image/png" });

    if (
      typeof navigator !== "undefined" &&
      navigator.share &&
      navigator.canShare?.({ files: [file] })
    ) {
      await navigator.share({ files: [file], title, text: title });
      return "shared";
    }
  } catch {
    // fall through to download
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
