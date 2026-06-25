import type { SupabaseClient } from "@supabase/supabase-js";

export function avatarStoragePath(userId: string, fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "jpg";
  return `${userId}/avatar.${ext}`;
}

export async function uploadAvatarForUser(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const path = avatarStoragePath(userId, file.name);

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { url: null, error: uploadError.message };
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ foto_url: data.publicUrl })
    .eq("user_id", userId);

  if (profileError) {
    return { url: null, error: profileError.message };
  }

  return { url: data.publicUrl, error: null };
}

export async function uploadAvatarViaApi(
  userId: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const formData = new FormData();
  formData.append("user_id", userId);
  formData.append("file", file);

  const res = await fetch("/api/auth/upload-avatar", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  if (!res.ok) {
    return { url: null, error: data.error ?? "Upload failed" };
  }

  return { url: data.url ?? null, error: null };
}
