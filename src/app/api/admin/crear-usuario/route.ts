import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminLikeRole } from "@/lib/auth/roles";

export async function POST(request: NextRequest) {
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

  if (!profile || !isAdminLikeRole(profile.rol)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  if (!profile.box_id) {
    return NextResponse.json({ error: "Perfil sin box asignado" }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error:
          "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor. Configúrala en Vercel.",
      },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { email, password, nombre, telefono, rol = "socio" } = body;

  if (!email || !password || !nombre) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  if (!["socio", "coach", "admin"].includes(rol)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  const admin = createAdminClient();

  // email_confirm: false → Supabase envía correo de confirmación (si está activo en Auth)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: {
      nombre_completo: nombre,
      telefono,
      rol,
      box_id: profile.box_id,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data.user) {
    await admin
      .from("profiles")
      .update({
        rol,
        estado_cuenta: rol === "socio" ? "pendiente_pago" : "activo",
      })
      .eq("user_id", data.user.id);
  }

  await logAdminAction({
    actorUserId: user.id,
    boxId: profile.box_id,
    accion: "crear_usuario",
    targetUserId: data.user?.id ?? null,
    detalle: { email, nombre, rol },
  });

  return NextResponse.json({
    success: true,
    userId: data.user?.id,
    emailSent: true,
  });
}
