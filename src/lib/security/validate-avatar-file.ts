const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const MIME_EXTENSIONS: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export type AvatarValidationResult =
  | { ok: true; contentType: string; extension: string }
  | { ok: false; error: string; status: 400 | 413 };

export function validateAvatarFile(file: File): AvatarValidationResult {
  if (file.size > AVATAR_MAX_BYTES) {
    return {
      ok: false,
      error: "File too large (max 5MB)",
      status: 413,
    };
  }

  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return {
      ok: false,
      error: "Only JPEG, PNG and WebP images are allowed",
      status: 400,
    };
  }

  const rawExt = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowedExts = MIME_EXTENSIONS[mime] ?? [];
  if (!rawExt || !allowedExts.includes(rawExt)) {
    return {
      ok: false,
      error: "File extension does not match image type",
      status: 400,
    };
  }

  return { ok: true, contentType: mime, extension: rawExt };
}
