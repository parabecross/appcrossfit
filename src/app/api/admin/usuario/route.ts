import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/audit/log";
import { isAdminLikeRole } from "@/lib/auth/roles";
import { rateLimitOrNull } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const limited = rateLimitOrNull(request, "admin:usuario", 30);
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("rol, box_id")
    .eq("user_id", user.id)
    .single();

  if (!adminProfile || !isAdminLikeRole(adminProfile.rol)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { user_id, email, telefono } = body;

  if (!user_id) {
    return NextResponse.json({ error: "Falta user_id" }, { status: 400 });
  }

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Falta email válido" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("rol, box_id, nombre_completo")
    .eq("user_id", user_id)
    .single();

  if (!target || target.rol !== "socio") {
    return NextResponse.json({ error: "Socio no encontrado" }, { status: 404 });
  }

  if (target.box_id !== adminProfile.box_id) {
    return NextResponse.json(
      { error: "Usuario no pertenece a tu box" },
      { status: 403 }
    );
  }

  const { error: authError } = await admin.auth.admin.updateUserById(user_id, {
    email: email.trim(),
    email_confirm: true,
    user_metadata: {
      nombre_completo: target.nombre_completo,
      telefono: telefono ?? null,
      rol: "socio",
      box_id: target.box_id,
    },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ telefono: telefono ?? null })
    .eq("user_id", user_id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  await logAdminAction({
    actorUserId: user.id,
    boxId: adminProfile.box_id,
    accion: "editar_socio_contacto",
    targetUserId: user_id,
    detalle: { email: email.trim(), telefono },
  });

  return NextResponse.json({ success: true, email: email.trim() });
}
