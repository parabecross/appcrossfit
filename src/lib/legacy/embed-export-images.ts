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

async function fetchAsDataUrlClient(src: string): Promise<string> {
  const res = await fetch(src, { mode: "cors", cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return blobToDataUrl(blob);
}

async function fetchAsDataUrlProxy(src: string): Promise<string> {
  const res = await fetch(
    `/api/legacy/image-data-url?url=${encodeURIComponent(src)}`
  );
  if (!res.ok) throw new Error("Proxy fetch failed");
  const payload = (await res.json()) as { dataUrl?: string };
  if (!payload.dataUrl) throw new Error("Missing dataUrl");
  return payload.dataUrl;
}

export async function resolveImageDataUrl(src: string): Promise<string> {
  if (!src || src.startsWith("data:")) return src;

  try {
    return await fetchAsDataUrlClient(src);
  } catch {
    return fetchAsDataUrlProxy(src);
  }
}

/** Inline external images so html-to-image can paint them (mobile Safari / CORS). */
export async function embedImagesForExport(
  root: HTMLElement
): Promise<() => void> {
  const restores: { img: HTMLImageElement; src: string }[] = [];
  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map(async (img) => {
      const original = img.currentSrc || img.src;
      if (!original || original.startsWith("data:")) {
        await waitForImage(img).catch(() => undefined);
        return;
      }

      try {
        const dataUrl = await resolveImageDataUrl(original);
        restores.push({ img, src: original });
        img.removeAttribute("crossorigin");
        img.src = dataUrl;
        await waitForImage(img);
      } catch {
        await waitForImage(img).catch(() => undefined);
      }
    })
  );

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  return () => {
    for (const { img, src } of restores) {
      img.src = src;
    }
  };
}
