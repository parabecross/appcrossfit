/** Región de recorte cuadrado centrado (legacy / tests). */
export function centerSquareCropRect(width: number, height: number) {
  const size = Math.min(width, height);
  return {
    sx: Math.round((width - size) / 2),
    sy: Math.round((height - size) / 2),
    size,
  };
}

/** Escala proporcional sin recortar (máx. lado largo = maxPx). */
export function computeProfilePhotoDimensions(
  width: number,
  height: number,
  maxPx = 1080
) {
  if (width <= 0 || height <= 0) {
    return { width: 0, height: 0, scale: 1 };
  }
  const scale = Math.min(1, maxPx / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

const PROFILE_PHOTO_MAX_PX = 1080;
const JPEG_QUALITY = 0.88;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

/**
 * Optimiza la foto de perfil: conserva la proporción original (ideal para selfies verticales).
 */
export async function prepareProfilePhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const img = await loadImageFromFile(file);
  const { width, height } = img;
  const { width: outW, height: outH, scale } = computeProfilePhotoDimensions(
    width,
    height,
    PROFILE_PHOTO_MAX_PX
  );

  if (outW <= 0 || outH <= 0) return file;

  if (
    scale === 1 &&
    file.type === "image/jpeg" &&
    file.size <= 900_000
  ) {
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(img, 0, 0, outW, outH);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "profile";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/** @deprecated Usa prepareProfilePhoto — conserva proporción en lugar de recortar en cuadrado. */
export async function cropAvatarToSquare(file: File): Promise<File> {
  return prepareProfilePhoto(file);
}
