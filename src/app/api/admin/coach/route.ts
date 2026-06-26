import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdminLikeRole } from "@/lib/auth/roles";

async function requireAdminApi() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("rol")
    .eq("user_id", user.id)
    .single();

  if (!profile || !isAdminLikeRole(profile.rol)) {
    return { error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error: NextResponse.json(
        { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." },
        { status: 500 }
      ),
    };
  }

  return { admin: createAdminClient() };
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi();
  if ("error" in auth && auth.error) return auth.error;

  const admin = auth.admin!;
  const body = await request.json();
  const { user_id, nombre_completo, telefono, email } = body;

  if (!user_id) {
    return NextResponse.json({ error: "Falta user_id" }, { status: 400 });
  }

  const { data: target } = await admin
    .from("profiles")
    .select("rol")
    .eq("user_id", user_id)
    .single();

  if (!target || target.rol !== "coach") {
    return NextResponse.json({ error: "Coach no encontrado" }, { status: 404 });
  }

  if (email) {
    const { error: authError } = await admin.auth.admin.updateUserById(user_id, {
      email,
      user_metadata: {
        nombre_completo,
        telefono,
        rol: "coach",
      },
    });
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      nombre_completo,
      telefono,
    })
    .eq("user_id", user_id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, email });
}
