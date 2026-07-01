import { NextRequest, NextResponse } from "next/server";
import { isAdminLikeRole } from "@/lib/auth/roles";
import {
  assertCanCreateResources,
  assertFeatureEnabled,
  getBoxEntitlements,
} from "@/lib/entitlements/engine";
import { EntitlementError } from "@/lib/entitlements/types";
import { rateLimitOrNull } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const limited = rateLimitOrNull(request, "admin:clases", 30);
  if (limited) return limited;

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

  if (!profile || !isAdminLikeRole(profile.rol) || !profile.box_id) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  try {
    const ent = await getBoxEntitlements(profile.box_id);
    assertCanCreateResources(ent);
    assertFeatureEnabled(ent, "clases");
  } catch (e) {
    if (e instanceof EntitlementError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const body = await request.json();
  const {
    nombre,
    fecha,
    hora_inicio,
    hora_fin,
    cupo_maximo,
    coach_id,
    entrenamiento,
  } = body;

  if (!nombre?.trim() || !fecha || !hora_inicio || !hora_fin) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("clases")
    .insert({
      nombre: nombre.trim(),
      fecha,
      hora_inicio,
      hora_fin,
      cupo_maximo: cupo_maximo ?? 20,
      coach_id: coach_id || null,
      entrenamiento: entrenamiento?.trim() || null,
      estado: "programada",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, clase: data });
}
