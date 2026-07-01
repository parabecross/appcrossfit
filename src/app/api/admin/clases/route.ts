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

type AdminClasesContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  boxId: string;
};

async function requireClasesAdmin(
  request: NextRequest
): Promise<AdminClasesContext | NextResponse> {
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

  return { supabase, boxId: profile.box_id };
}

export async function POST(request: NextRequest) {
  const ctx = await requireClasesAdmin(request);
  if (ctx instanceof NextResponse) return ctx;

  const { supabase } = ctx;
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

export async function PATCH(request: NextRequest) {
  const ctx = await requireClasesAdmin(request);
  if (ctx instanceof NextResponse) return ctx;

  const { supabase } = ctx;
  const body = await request.json();
  const {
    id,
    nombre,
    fecha,
    hora_inicio,
    hora_fin,
    cupo_maximo,
    coach_id,
    entrenamiento,
  } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Falta id de la clase" }, { status: 400 });
  }

  if (!nombre?.trim() || !fecha || !hora_inicio || !hora_fin) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("clases")
    .update({
      nombre: nombre.trim(),
      fecha,
      hora_inicio,
      hora_fin,
      cupo_maximo: cupo_maximo ?? 20,
      coach_id: coach_id || null,
      entrenamiento: entrenamiento?.trim() || null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, clase: data });
}

export async function DELETE(request: NextRequest) {
  const ctx = await requireClasesAdmin(request);
  if (ctx instanceof NextResponse) return ctx;

  const { supabase } = ctx;
  const body = await request.json();
  const { id } = body as { id?: string };

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Falta id de la clase" }, { status: 400 });
  }

  const { error } = await supabase.from("clases").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
