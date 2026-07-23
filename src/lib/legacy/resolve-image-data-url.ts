import { isMobileExportDevice } from "@/lib/legacy/legacy-device";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image blob"));
    reader.readAsDataURL(blob);
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
