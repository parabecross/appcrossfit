import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { awardAttendance } from "@/lib/ranking/engine";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("rol, box_id")
      .eq("user_id", user.id)
      .single();

    if (!profile || !["admin", "coach", "box_admin"].includes(profile.rol)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { reservaId?: string };
    if (!body.reservaId) {
      return NextResponse.json({ error: "reservaId required" }, { status: 400 });
    }

    const { data: reservaCtx } = await supabase
      .from("reservas")
      .select(
        "id, clase:clases!inner(coach:profiles!clases_coach_id_fkey(box_id))"
      )
      .eq("id", body.reservaId)
      .maybeSingle();

    if (!reservaCtx) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    const coachBoxId = (
      reservaCtx.clase as { coach: { box_id: string } | null }
    ).coach?.box_id;

    if (!profile.box_id || !coachBoxId || coachBoxId !== profile.box_id) {
      return NextResponse.json(
        { error: "La reserva no pertenece a tu box" },
        { status: 403 }
      );
    }

    const result = await awardAttendance({ reservaId: body.reservaId });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
