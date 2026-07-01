import { NextRequest, NextResponse } from "next/server";
import {
  assertFeatureEnabled,
  getBoxEntitlements,
} from "@/lib/entitlements/engine";
import { EntitlementError } from "@/lib/entitlements/types";
import { rateLimitOrNull } from "@/lib/security/rate-limit";
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

  if (!profile || profile.rol !== "socio" || !profile.box_id) {
    return { error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
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

  const { data, error } = await supabase
    .from("reservas")
    .insert({
      clase_id,
      usuario_id: profile!.id,
      estado: "confirmada",
    })
    .select("*")
    .single();

  if (error) {
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
