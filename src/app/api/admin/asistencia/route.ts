import { NextRequest, NextResponse } from "next/server";
import { canAccessAdminArea } from "@/lib/auth/roles";
import {
  assertFeatureEnabled,
  getBoxEntitlements,
} from "@/lib/entitlements/engine";
import { EntitlementError } from "@/lib/entitlements/types";
import { rateLimitOrNull } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseFeature } from "@/lib/entitlements/permissions";
import {
  awardAttendance,
  revokeAttendanceRanking,
} from "@/lib/ranking/engine";

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

  const { supabase, profile } = auth;
  const body = await request.json();
  const { reserva_id, estado } = body as {
    reserva_id?: string;
    estado?: "asistio" | "no_asistio";
  };

  if (!reserva_id || !estado || !["asistio", "no_asistio"].includes(estado)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { data: reserva, error: reservaError } = await supabase
    .from("reservas")
    .select("id, clase:clases!inner(box_id)")
    .eq("id", reserva_id)
    .maybeSingle();

  const claseBoxId = (
    reserva?.clase as unknown as { box_id: string | null } | null
  )?.box_id;

  if (reservaError || !reserva || !claseBoxId || claseBoxId !== profile.box_id) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const { data: updated, error } = await supabase
    .from("reservas")
    .update({ estado })
    .eq("id", reserva_id)
    .select("id");

  if (error || !updated?.length) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudo actualizar" },
      { status: 400 }
    );
  }

  try {
    const entitlements = await getBoxEntitlements(profile.box_id);
    if (canUseFeature(entitlements, "ranking")) {
      const admin = createAdminClient();
      if (estado === "asistio") {
        await awardAttendance({ reservaId: reserva_id, admin });
      } else {
        await revokeAttendanceRanking({ reservaId: reserva_id, admin });
      }
    }
  } catch (rankingErr) {
    console.error("[asistencia] ranking sync failed:", rankingErr);
  }

  return NextResponse.json({ success: true, estado });
}
