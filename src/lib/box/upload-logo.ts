export function boxLogoStoragePath(boxId: string, extension: string) {
  return `box-logos/${boxId}/logo.${extension}`;
}

export async function uploadBoxLogoViaApi(
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/admin/box-logo", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  if (!res.ok) {
    return { url: null, error: data.error ?? "Upload failed" };
  }

  return { url: data.url ?? null, error: null };
}
