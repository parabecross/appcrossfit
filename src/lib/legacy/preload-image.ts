import { resolveImageDataUrl } from "@/lib/legacy/resolve-image-data-url";

const IS_DEV = process.env.NODE_ENV === "development";

export function devLog(label: string, data?: Record<string, unknown>) {
  if (!IS_DEV) return;
  console.log(`[legacy-export] ${label}`, data ?? "");
}

export function toAbsoluteImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("data:")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (typeof window !== "undefined") {
    return new URL(trimmed, window.location.origin).href;
  }
  return trimmed;
}

export type PreloadImageResult =
  | { ok: true; url: string; width: number; height: number }
  | { ok: false; error: string; cors?: boolean };

async function decodeLoadedImage(img: HTMLImageElement): Promise<void> {
  if (!img.decode) return;
  try {
    await img.decode();
    devLog("image.decode success", {
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  } catch (error) {
    devLog("image.decode error", { error: String(error) });
  }
}

function loadImageElement(resolvedUrl: string): Promise<PreloadImageResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "sync";
    img.loading = "eager";

    img.onload = () => {
      void (async () => {
        devLog("image.onload", {
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        await decodeLoadedImage(img);
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          resolve({
            ok: true,
            url: resolvedUrl,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        } else {
          resolve({ ok: false, error: "zero dimensions" });
        }
      })();
    };

    img.onerror = () => {
      devLog("image.onload error", { url: resolvedUrl.slice(0, 120) });
      resolve({
        ok: false,
        error: "load failed",
        cors: !resolvedUrl.startsWith("data:"),
      });
    };

    img.src = resolvedUrl;
  });
}

/** Preload + decode an image URL (resolves remote URLs to data URLs when needed). */
export async function preloadImage(src: string): Promise<PreloadImageResult> {
  const absolute = toAbsoluteImageUrl(src);
  if (!absolute) return { ok: false, error: "empty url" };

  devLog("preloadImage start", { backgroundUrl: absolute.slice(0, 120) });

  let resolvedUrl = absolute;
  if (!absolute.startsWith("data:")) {
    try {
      resolvedUrl = await resolveImageDataUrl(absolute);
      devLog("preloadImage resolved", {
        backgroundUrl: resolvedUrl.slice(0, 120),
      });
    } catch (error) {
      devLog("preloadImage resolve failed", { error: String(error) });
      return { ok: false, error: "resolve failed", cors: true };
    }
  }

  return loadImageElement(resolvedUrl);
}

export async function waitForFontsReady(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.ready) return;
  await document.fonts.ready;
  devLog("fonts ready");
}

export async function waitForPaintFrames(count = 2): Promise<void> {
  for (let i = 0; i < count; i++) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
}

export function suspendAnimations(root: HTMLElement): () => void {
  const style = document.createElement("style");
  style.setAttribute("data-legacy-export", "true");
  style.textContent = `
    [data-legacy-card-root], [data-legacy-card-root] * {
      animation: none !important;
      transition: none !important;
    }
  `;
  document.head.appendChild(style);
  root.setAttribute("data-legacy-exporting", "true");
  return () => {
    style.remove();
    root.removeAttribute("data-legacy-exporting");
  };
}
