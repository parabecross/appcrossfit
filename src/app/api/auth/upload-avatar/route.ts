import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { avatarStoragePath } from "@/lib/avatars/upload";

const SIGNUP_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const userId = formData.get("user_id");
  const file = formData.get("file");

  if (typeof userId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();

  if (user) {
    if (user.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("foto_url, created_at")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.foto_url) {
      return NextResponse.json({ error: "Avatar already set" }, { status: 400 });
    }

    const age = Date.now() - new Date(profile.created_at).getTime();
    if (age > SIGNUP_WINDOW_MS) {
      return NextResponse.json({ error: "Signup window expired" }, { status: 403 });
    }
  }

  const path = avatarStoragePath(userId, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(path, buffer, {
      upsert: true,
      contentType: file.type || "image/jpeg",
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data: urlData } = admin.storage.from("avatars").getPublicUrl(path);

  const { error: updateError } = await admin
    .from("profiles")
    .update({ foto_url: urlData.publicUrl })
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, url: urlData.publicUrl });
}
