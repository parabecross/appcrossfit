import { NextRequest, NextResponse } from "next/server";
import { canAccessAdminArea } from "@/lib/auth/roles";
import {
  assertFeatureEnabled,
  getBoxEntitlements,
} from "@/lib/entitlements/engine";
import { EntitlementError } from "@/lib/entitlements/types";
import { rateLimitOrNull } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

async function requireAttendanceStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, rol, box_id")
    .eq("user_id", user.id)
    .single();

  if (!profile || !canAccessAdminArea(profile.rol) || !profile.box_id) {
    return { error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }

  try {
    const ent = await getBoxEntitlements(profile.box_id);
    assertFeatureEnabled(ent, "asistencia");
    return { supabase, profile };
  } catch (e) {
    if (e instanceof EntitlementError) {
      return { error: NextResponse.json({ error: e.message }, { status: e.status }) };
    }
    throw e;
  }
}

export async function PATCH(request: NextRequest) {
  const limited = rateLimitOrNull(request, "admin:asistencia", 60);
  if (limited) return limited;

  const auth = await requireAttendanceStaff();
  if ("error" in auth && auth.error) return auth.error;

  const { supabase } = auth;
  const body = await request.json();
  const { reserva_id, estado } = body as {
    reserva_id?: string;
    estado?: "asistio" | "no_asistio";
  };

  if (!reserva_id || !estado || !["asistio", "no_asistio"].includes(estado)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { error } = await supabase
    .from("reservas")
    .update({ estado })
    .eq("id", reserva_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, estado });
}
