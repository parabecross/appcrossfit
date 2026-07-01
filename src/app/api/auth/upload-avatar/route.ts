import { NextRequest, NextResponse } from "next/server";
import { avatarStoragePath } from "@/lib/avatars/upload";
import { rateLimitOrNull } from "@/lib/security/rate-limit";
import { validateAvatarFile } from "@/lib/security/validate-avatar-file";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Post-signup window without session: registration may upload avatar before email
 * confirmation creates a session (see register-form → uploadAvatarViaApi).
 * Risk: valid user_id enumeration within the window — mitigated by rate limiting.
 */
const SIGNUP_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  const limited = rateLimitOrNull(request, "auth:upload-avatar", 10);
  if (limited) return limited;

  const formData = await request.formData();
  const userId = formData.get("user_id");
  const file = formData.get("file");

  if (typeof userId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const fileCheck = validateAvatarFile(file);
  if (!fileCheck.ok) {
    return NextResponse.json(
      { error: fileCheck.error },
      { status: fileCheck.status }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // admin: bypasses RLS — user_id must match session or pass signup-window checks
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

  const path = avatarStoragePath(userId, `avatar.${fileCheck.extension}`);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(path, buffer, {
      upsert: true,
      contentType: fileCheck.contentType,
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
