import { isMobileExportDevice } from "@/lib/legacy/resolve-card-images";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image blob"));
    reader.readAsDataURL(blob);
  });
}

function waitForImage(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onLoad = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Image failed to load"));
    };
    const cleanup = () => {
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
    };
    img.addEventListener("load", onLoad);
    img.addEventListener("error", onError);
  });
}

async function fetchAsDataUrlProxy(src: string): Promise<string> {
  const res = await fetch(
    `/api/legacy/image-data-url?url=${encodeURIComponent(src)}`,
    { credentials: "same-origin", cache: "no-store" }
  );
  if (!res.ok) throw new Error("Proxy fetch failed");
  const payload = (await res.json()) as { dataUrl?: string };
  if (!payload.dataUrl) throw new Error("Missing dataUrl");
  return payload.dataUrl;
}

async function fetchAsDataUrlClient(src: string): Promise<string> {
  const res = await fetch(src, { mode: "cors", cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return blobToDataUrl(blob);
}

export async function resolveImageDataUrl(src: string): Promise<string> {
  if (!src || src.startsWith("data:")) return src;

  if (isMobileExportDevice()) {
    try {
      return await fetchAsDataUrlProxy(src);
    } catch {
      return fetchAsDataUrlClient(src);
    }
  }

  try {
    return await fetchAsDataUrlClient(src);
  } catch {
    return fetchAsDataUrlProxy(src);
  }
}

function extractBackgroundUrl(style: CSSStyleDeclaration): string | null {
  const bg = style.backgroundImage;
  if (!bg || bg === "none") return null;
  const match = bg.match(/url\(["']?(.*?)["']?\)/);
  return match?.[1] ?? null;
}

function setBackgroundUrl(el: HTMLElement, dataUrl: string) {
  el.style.backgroundImage = `url("${dataUrl.replace(/"/g, '\\"')}")`;
}

/** Inline external images so html-to-image can paint them (mobile Safari / CORS). */
export async function embedImagesForExport(
  root: HTMLElement
): Promise<() => void> {
  const restores: Array<() => void> = [];

  const images = Array.from(root.querySelectorAll("img"));
  const bgNodes = Array.from(
    root.querySelectorAll<HTMLElement>("[data-legacy-photo], [data-legacy-logo]")
  );

  await Promise.all([
    ...images.map(async (img) => {
      const original = img.currentSrc || img.src;
      if (!original || original.startsWith("data:")) {
        await waitForImage(img).catch(() => undefined);
        return;
      }

      try {
        const dataUrl = await resolveImageDataUrl(original);
        const prevSrc = img.src;
        img.removeAttribute("crossorigin");
        img.src = dataUrl;
        await waitForImage(img);
        restores.push(() => {
          img.src = prevSrc;
        });
      } catch {
        await waitForImage(img).catch(() => undefined);
      }
    }),
    ...bgNodes.map(async (el) => {
      const original = extractBackgroundUrl(el.style);
      if (!original || original.startsWith("data:")) return;

      try {
        const dataUrl = await resolveImageDataUrl(original);
        const prev = el.style.backgroundImage;
        setBackgroundUrl(el, dataUrl);
        restores.push(() => {
          el.style.backgroundImage = prev;
        });
      } catch {
        /* keep original */
      }
    }),
  ]);

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

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
