import { NextRequest, NextResponse } from "next/server";
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

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { user_id, password } = body;

  if (!user_id || !password || password.length < 6) {
    return NextResponse.json(
      { error: "Contraseña inválida (mínimo 6 caracteres)" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("rol, box_id")
    .eq("user_id", user_id)
    .single();

  if (!target || target.rol !== "coach") {
    return NextResponse.json({ error: "Coach no encontrado" }, { status: 403 });
  }

  if (target.box_id !== profile.box_id) {
    return NextResponse.json(
      { error: "Coach no pertenece a tu box" },
      { status: 403 }
    );
  }

  const { data: authUser, error } = await admin.auth.admin.updateUserById(
    user_id,
    { password }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    email: authUser.user?.email ?? null,
    password,
  });
}
