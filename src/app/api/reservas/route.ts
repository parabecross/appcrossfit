import { NextRequest, NextResponse } from "next/server";
import { hasClassEnded } from "@/lib/clases/helpers";
import { APP_CONFIG } from "@/lib/config/app-config";
import {
  assertFeatureEnabled,
  getBoxEntitlements,
} from "@/lib/entitlements/engine";
import { EntitlementError } from "@/lib/entitlements/types";
import {
  ACTIVE_RESERVA_ESTADOS,
  RESERVA_LIMITE_MAX_CODE,
} from "@/lib/reservas/helpers";
import { rateLimitOrNull } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireSocioReservas() {
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

  if (!profile || profile.rol !== "socio") {
    return { error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }

  if (!profile.box_id) {
    return {
      error: NextResponse.json(
        { error: "Perfil sin box asignado" },
        { status: 403 }
      ),
    };
  }

  try {
    const ent = await getBoxEntitlements(profile.box_id);
    assertFeatureEnabled(ent, "reservas");
    return { supabase, profile };
  } catch (e) {
    if (e instanceof EntitlementError) {
      return { error: NextResponse.json({ error: e.message }, { status: e.status }) };
    }
    throw e;
  }
}

export async function POST(request: NextRequest) {
  const limited = rateLimitOrNull(request, "reservas:book", 40);
  if (limited) return limited;

  const auth = await requireSocioReservas();
  if ("error" in auth && auth.error) return auth.error;

  const { supabase, profile } = auth;
  const body = await request.json();
  const { clase_id } = body as { clase_id?: string };

  if (!clase_id) {
    return NextResponse.json({ error: "Falta clase_id" }, { status: 400 });
  }

  const { data: clase } = await supabase
    .from("clases")
    .select("id")
    .eq("id", clase_id)
    .eq("box_id", profile!.box_id)
    .maybeSingle();

  if (!clase) {
    return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("reservas")
    .select("*")
    .eq("clase_id", clase_id)
    .eq("usuario_id", profile!.id)
    .in("estado", [...ACTIVE_RESERVA_ESTADOS])
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ success: true, reserva: existing });
  }

  const { data: boxRow } = await supabase
    .from("boxes")
    .select("timezone")
    .eq("id", profile!.box_id)
    .maybeSingle();
  const gymTimezone = boxRow?.timezone ?? APP_CONFIG.GYM_TIMEZONE;

  const admin = createAdminClient();
  const { data: activeReservas } = await admin
    .from("reservas")
    .select("id, estado, clase:clases!inner(fecha, hora_fin, box_id)")
    .eq("usuario_id", profile!.id)
    .eq("clase.box_id", profile!.box_id)
    .in("estado", [...ACTIVE_RESERVA_ESTADOS]);

  const upcomingCount = (activeReservas ?? []).filter((row) => {
    const clase = row.clase as unknown as { fecha: string; hora_fin: string } | null;
    if (!clase) return false;
    return !hasClassEnded(clase.fecha, clase.hora_fin, gymTimezone);
  }).length;

  if (upcomingCount >= APP_CONFIG.MAX_SOCIO_FUTURE_RESERVAS) {
    return NextResponse.json({ error: RESERVA_LIMITE_MAX_CODE }, { status: 400 });
  }

  // Service role: el trigger check_reserva_cupo() usa SELECT … FOR UPDATE sobre
  // clases; con RLS el socio no pasa clases_update_coach_assigned y falla el INSERT.
  // Auth, box y clase ya validados arriba con el cliente del usuario.
  const { data, error } = await admin
    .from("reservas")
    .insert({
      clase_id,
      usuario_id: profile!.id,
      estado: "confirmada",
    })
    .select("*")
    .single();

  if (error) {
    if (error.message.includes("idx_reservas_activa")) {
      const { data: existingActive } = await admin
        .from("reservas")
        .select("*")
        .eq("clase_id", clase_id)
        .eq("usuario_id", profile!.id)
        .in("estado", [...ACTIVE_RESERVA_ESTADOS])
        .maybeSingle();

      if (existingActive) {
        return NextResponse.json({ success: true, reserva: existingActive });
      }
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, reserva: data });
}

export async function PATCH(request: NextRequest) {
  const limited = rateLimitOrNull(request, "reservas:cancel", 40);
  if (limited) return limited;

  const auth = await requireSocioReservas();
  if ("error" in auth && auth.error) return auth.error;

  const { supabase, profile } = auth;
  const body = await request.json();
  const { reserva_id } = body as { reserva_id?: string };

  if (!reserva_id) {
    return NextResponse.json({ error: "Falta reserva_id" }, { status: 400 });
  }

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(reserva_id)) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const { data: reserva, error: fetchError } = await supabase
    .from("reservas")
    .select("id, usuario_id")
    .eq("id", reserva_id)
    .single();

  if (fetchError || !reserva || reserva.usuario_id !== profile!.id) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const { error } = await supabase
    .from("reservas")
    .update({ estado: "cancelada" })
    .eq("id", reserva_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
