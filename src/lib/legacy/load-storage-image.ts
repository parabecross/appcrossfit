import { createAdminClient } from "@/lib/supabase/admin";

export function parseSupabasePublicObjectUrl(
  url: string
): { bucket: string; path: string } | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(
      /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/
    );
    if (!match) return null;
    return {
      bucket: match[1],
      path: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
}

function bufferToDataUrl(buffer: ArrayBuffer, contentType: string): string {
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

/** Carga imagen de Supabase Storage o URL pública → data URL (solo servidor). */
export async function loadImageAsDataUrl(
  url: string | null | undefined
): Promise<string | null> {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) return trimmed;

  const object = parseSupabasePublicObjectUrl(trimmed);
  if (object) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.storage
        .from(object.bucket)
        .download(object.path);
      if (!error && data) {
        const buffer = await data.arrayBuffer();
        const type = data.type || "image/jpeg";
        return bufferToDataUrl(buffer, type);
      }
    } catch {
      /* fall through to HTTP fetch */
    }
  }

  try {
    const res = await fetch(trimmed, { cache: "no-store" });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const contentType =
      res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
    return bufferToDataUrl(buffer, contentType);
  } catch {
    return null;
  }
}
