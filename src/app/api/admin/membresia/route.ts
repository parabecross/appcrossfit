import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeFechaFin, syncMembresiaEstadoLocal } from "@/lib/membresias/helpers";
import { isAdminLikeRole } from "@/lib/auth/roles";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("rol, box_id")
    .eq("user_id", user.id)
    .single();

  if (!profile || !isAdminLikeRole(profile.rol)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  if (!profile.box_id) {
    return {
      error: NextResponse.json({ error: "Perfil sin box asignado" }, { status: 400 }),
    };
  }

  return { supabase, boxId: profile.box_id };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const supabase = auth.supabase!;
  const boxId = auth.boxId!;
  const body = await request.json();
  const { action } = body;

  if (action === "assign") {
    const { usuario_id, plan_id, manual, fecha_fin } = body;

    if (!usuario_id || !plan_id) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { data: targetUser, error: userError } = await supabase
      .from("profiles")
      .select("box_id")
      .eq("id", usuario_id)
      .single();

    if (userError || !targetUser || targetUser.box_id !== boxId) {
      return NextResponse.json(
        { error: "Usuario no pertenece a tu box" },
        { status: 403 }
      );
    }

    const { data: plan, error: planError } = await supabase
      .from("planes")
      .select("id, duracion_dias")
      .eq("id", plan_id)
      .eq("activo", true)
      .eq("box_id", boxId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 400 });
    }

    const inicio = new Date().toISOString().split("T")[0];
    const fin =
      manual && fecha_fin
        ? fecha_fin
        : computeFechaFin(inicio, plan.duracion_dias);

    if (fin < inicio) {
      return NextResponse.json(
        { error: "End date must be on or after start date" },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase.from("membresias").insert({
      usuario_id,
      plan_id,
      fecha_inicio: inicio,
      fecha_fin: fin,
      metodo_asignacion: manual ? "manual" : "automatico",
      estado: "vigente",
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ estado_cuenta: "activo" })
      .eq("id", usuario_id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, fecha_fin: fin });
  }

  if (action === "update_end") {
    const { membresia_id, fecha_fin } = body;

    if (!membresia_id || !fecha_fin) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { data: membresia, error: fetchError } = await supabase
      .from("membresias")
      .select("fecha_inicio")
      .eq("id", membresia_id)
      .single();

    if (fetchError || !membresia) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    if (fecha_fin < membresia.fecha_inicio) {
      return NextResponse.json(
        { error: "End date must be on or after start date" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("membresias")
      .update({
        fecha_fin,
        estado: syncMembresiaEstadoLocal(fecha_fin, "vigente"),
      })
      .eq("id", membresia_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, fecha_fin });
  }

  if (action === "update") {
    const { membresia_id, plan_id, fecha_inicio, fecha_fin } = body;

    if (!membresia_id || !plan_id || !fecha_inicio || !fecha_fin) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (fecha_fin < fecha_inicio) {
      return NextResponse.json(
        { error: "End date must be on or after start date" },
        { status: 400 }
      );
    }

    const { data: plan, error: planError } = await supabase
      .from("planes")
      .select("id")
      .eq("id", plan_id)
      .eq("activo", true)
      .eq("box_id", boxId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 400 });
    }

    const { data: membresia, error: fetchError } = await supabase
      .from("membresias")
      .select("id, usuario_id, estado")
      .eq("id", membresia_id)
      .single();

    if (fetchError || !membresia) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    if (membresia.estado === "cancelada") {
      return NextResponse.json(
        { error: "Cannot edit a cancelled membership" },
        { status: 400 }
      );
    }

    const estado = syncMembresiaEstadoLocal(fecha_fin, "vigente");

    const { error: updateError } = await supabase
      .from("membresias")
      .update({
        plan_id,
        fecha_inicio,
        fecha_fin,
        estado,
      })
      .eq("id", membresia_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    if (estado === "vigente") {
      await supabase
        .from("profiles")
        .update({ estado_cuenta: "activo" })
        .eq("id", membresia.usuario_id);
    }

    return NextResponse.json({ success: true, fecha_fin, estado });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
