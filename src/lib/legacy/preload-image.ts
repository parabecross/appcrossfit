import { resolveImageDataUrl } from "@/lib/legacy/resolve-image-data-url";

const IS_DEV = process.env.NODE_ENV === "development";
const PRELOAD_TIMEOUT_MS = 20_000;

export const LEGACY_SHARE_WAIT_SECONDS = 5;

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

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
    }),
  ]);
}

async function decodeLoadedImage(img: HTMLImageElement): Promise<void> {
  if (!img.decode) return;
  try {
    await withTimeout(img.decode(), PRELOAD_TIMEOUT_MS, "decode");
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
    const isDataUrl = resolvedUrl.startsWith("data:");
    if (!isDataUrl) {
      img.crossOrigin = "anonymous";
    }
    img.decoding = "async";
    img.loading = "eager";

    const finish = (result: PreloadImageResult) => {
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({ ok: false, error: "timeout:load" });
    }, PRELOAD_TIMEOUT_MS);

    img.onload = () => {
      void (async () => {
        devLog("image.onload", {
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        await decodeLoadedImage(img);
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          finish({
            ok: true,
            url: resolvedUrl,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        } else {
          finish({ ok: false, error: "zero dimensions" });
        }
      })();
    };

    img.onerror = () => {
      devLog("image.onload error", { url: resolvedUrl.slice(0, 120) });
      finish({
        ok: false,
        error: "load failed",
        cors: !isDataUrl,
      });
    };

    img.src = resolvedUrl;
  });
}

async function preloadImageInner(src: string): Promise<PreloadImageResult> {
  const absolute = toAbsoluteImageUrl(src);
  if (!absolute) return { ok: false, error: "empty url" };

  devLog("preloadImage start", { backgroundUrl: absolute.slice(0, 120) });

  let resolvedUrl = absolute;
  if (!absolute.startsWith("data:")) {
    try {
      resolvedUrl = await withTimeout(
        resolveImageDataUrl(absolute),
        PRELOAD_TIMEOUT_MS,
        "resolve"
      );
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

/** Preload + decode an image URL (resolves remote URLs to data URLs when needed). */
export async function preloadImage(src: string): Promise<PreloadImageResult> {
  try {
    return await withTimeout(
      preloadImageInner(src),
      PRELOAD_TIMEOUT_MS,
      "preload"
    );
  } catch (error) {
    devLog("preloadImage timeout", { error: String(error) });
    return { ok: false, error: String(error) };
  }
}

export async function waitForFontsReady(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.ready) return;
  await withTimeout(document.fonts.ready, PRELOAD_TIMEOUT_MS, "fonts");
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
