import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/audit/log";
import { isAdminLikeRole } from "@/lib/auth/roles";
import { rateLimitOrNull } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const limited = rateLimitOrNull(request, "admin:eliminar-usuario", 30);
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

  const body = await request.json();
  const { user_id, target_rol = "socio" } = body;

  if (!user_id) {
    return NextResponse.json({ error: "Falta user_id" }, { status: 400 });
  }

  if (target_rol !== "socio" && target_rol !== "coach") {
    return NextResponse.json({ error: "Rol no permitido" }, { status: 400 });
  }

  if (user_id === user.id) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta" },
      { status: 400 }
    );
  }

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("rol, nombre_completo, box_id")
    .eq("user_id", user_id)
    .single();

  if (targetError || !target) {
    return NextResponse.json(
      { error: "Usuario no encontrado" },
      { status: 404 }
    );
  }

  if (adminProfile.box_id !== target.box_id) {
    return NextResponse.json(
      { error: "Usuario no pertenece a tu box" },
      { status: 403 }
    );
  }

  if (target.rol !== target_rol) {
    return NextResponse.json(
      {
        error:
          target_rol === "coach"
            ? "Solo se pueden eliminar coaches"
            : `Solo se pueden eliminar socios (este usuario es ${target.rol})`,
      },
      { status: 403 }
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        error:
          "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor. Configúrala en Vercel y redeploy.",
      },
      { status: 500 }
    );
  }

  // admin: bypasses RLS — target.box_id verified === auth.box_id above
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logAdminAction({
    actorUserId: user.id,
    boxId: adminProfile.box_id,
    accion: target_rol === "coach" ? "eliminar_coach" : "eliminar_usuario",
    targetUserId: user_id,
    detalle: { nombre_completo: target.nombre_completo, rol: target_rol },
  });

  return NextResponse.json({ success: true });
}
