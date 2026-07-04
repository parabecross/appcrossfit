import { NextRequest, NextResponse } from "next/server";

import { isAdminLikeRole } from "@/lib/auth/roles";
import { boxLogoStoragePath } from "@/lib/box/upload-logo";
import { rateLimitOrNull } from "@/lib/security/rate-limit";
import { validateAvatarFile } from "@/lib/security/validate-avatar-file";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const limited = rateLimitOrNull(request, "admin:box-logo", 10);
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("rol, box_id")
    .eq("user_id", user.id)
    .single();

  if (!profile || !isAdminLikeRole(profile.rol) || !profile.box_id) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const fileCheck = validateAvatarFile(file);
  if (!fileCheck.ok) {
    return NextResponse.json(
      { error: fileCheck.error },
      { status: fileCheck.status }
    );
  }

  const admin = createAdminClient();
  const path = boxLogoStoragePath(profile.box_id, fileCheck.extension);
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
    .from("boxes")
    .update({ logo_url: urlData.publicUrl })
    .eq("id", profile.box_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, url: urlData.publicUrl });
}
