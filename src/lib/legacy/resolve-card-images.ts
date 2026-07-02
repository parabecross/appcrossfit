/** Convierte URL remota a data URL. En servidor usa Storage API de Supabase. */

import { loadImageAsDataUrl } from "@/lib/legacy/load-storage-image";

export async function remoteImageToDataUrl(
  url: string | null | undefined
): Promise<string | null> {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) return trimmed;

  if (typeof window === "undefined") {
    return loadImageAsDataUrl(trimmed);
  }

  try {
    const res = await fetch(trimmed, { mode: "cors", cache: "no-store" });
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(blob);
    });
  } catch {
    try {
      const res = await fetch(
        `/api/legacy/image-data-url?url=${encodeURIComponent(trimmed)}`,
        { credentials: "same-origin", cache: "no-store" }
      );
      if (!res.ok) return null;
      const payload = (await res.json()) as { dataUrl?: string };
      return payload.dataUrl ?? null;
    } catch {
      return null;
    }
  }
}

export function isMobileExportDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}
