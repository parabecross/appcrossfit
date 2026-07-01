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
import type { Plan } from "@/types/database";

async function requireMembresiasAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("rol, box_id")
    .eq("user_id", user.id)
    .single();

  if (!profile || !isAdminLikeRole(profile.rol) || !profile.box_id) {
    return { error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }

  try {
    const ent = await getBoxEntitlements(profile.box_id);
    assertCanCreateResources(ent);
    assertFeatureEnabled(ent, "membresias");
    return { supabase, boxId: profile.box_id };
  } catch (e) {
    if (e instanceof EntitlementError) {
      return { error: NextResponse.json({ error: e.message }, { status: e.status }) };
    }
    throw e;
  }
}

export async function POST(request: NextRequest) {
  const limited = rateLimitOrNull(request, "admin:planes", 30);
  if (limited) return limited;

  const auth = await requireMembresiasAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const { supabase, boxId } = auth;
  const body = await request.json();
  const { nombre, tipo, duracion_dias, precio } = body as {
    nombre?: string;
    tipo?: Plan["tipo"];
    duracion_dias?: number;
    precio?: number | null;
  };

  if (!nombre?.trim() || !tipo || !duracion_dias) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("planes")
    .insert({
      nombre: nombre.trim(),
      tipo,
      duracion_dias,
      precio: precio ?? null,
      activo: true,
      box_id: boxId!,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, plan: data });
}

export async function PATCH(request: NextRequest) {
  const limited = rateLimitOrNull(request, "admin:planes", 30);
  if (limited) return limited;

  const auth = await requireMembresiasAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const { supabase, boxId } = auth;
  const body = await request.json();
  const { id, activo } = body as { id?: string; activo?: boolean };

  if (!id || typeof activo !== "boolean") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("planes")
    .update({ activo })
    .eq("id", id)
    .eq("box_id", boxId!)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, plan: data });
}
