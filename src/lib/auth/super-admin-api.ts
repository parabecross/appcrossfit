import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function requireSuperAdminApi() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("user_id", user.id)
    .single();

  if (!profile?.is_super_admin) {
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

  return { ok: true as const };
}
