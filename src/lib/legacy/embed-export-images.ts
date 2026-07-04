import { devLog, preloadImage } from "@/lib/legacy/preload-image";

/** Inline external images so html-to-image can paint them (mobile Safari / CORS). */
export async function embedImagesForExport(
  root: HTMLElement
): Promise<() => void> {
  const restores: Array<() => void> = [];

  const images = Array.from(
    root.querySelectorAll<HTMLImageElement>("img")
  );

  await Promise.all(
    images.map(async (img) => {
      const original = img.currentSrc || img.src;
      if (!original) return;

      try {
        const result = await preloadImage(original);
        if (!result.ok) {
          devLog("embedImages skip", {
            src: original.slice(0, 80),
            error: result.error,
          });
          return;
        }

        const prevSrc = img.src;
        img.removeAttribute("crossorigin");
        if (img.src !== result.url) {
          img.src = result.url;
        }

        const verify = await preloadImage(result.url);
        if (!verify.ok) {
          throw new Error(verify.error);
        }

        restores.push(() => {
          img.src = prevSrc;
        });
      } catch (error) {
        devLog("embedImages error", {
          src: original.slice(0, 80),
          error: String(error),
        });
      }
    })
  );

  return () => {
    for (const restore of restores) restore();
  };
}

export function getLegacyCardCaptureRoot(shell: HTMLElement): HTMLElement {
  return (
    (shell.querySelector("[data-legacy-card-root]") as HTMLElement | null) ??
    shell
  );
}

export { resolveImageDataUrl } from "@/lib/legacy/resolve-image-data-url";
