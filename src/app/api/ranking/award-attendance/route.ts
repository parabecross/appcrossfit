import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  assertFeatureEnabled,
  getBoxEntitlements,
} from "@/lib/entitlements/engine";
import { EntitlementError } from "@/lib/entitlements/types";
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

    if (!profile.box_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      const ent = await getBoxEntitlements(profile.box_id);
      assertFeatureEnabled(ent, "ranking");
    } catch (e) {
      if (e instanceof EntitlementError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    const body = (await request.json()) as { reservaId?: string };
    if (!body.reservaId) {
      return NextResponse.json({ error: "reservaId required" }, { status: 400 });
    }

    const { data: reservaCtx } = await supabase
      .from("reservas")
      .select("id, clase:clases!inner(box_id)")
      .eq("id", body.reservaId)
      .maybeSingle();

    if (!reservaCtx) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    const clase = reservaCtx.clase as unknown as { box_id: string | null };
    const claseBoxId = clase?.box_id;

    if (!profile.box_id || !claseBoxId || claseBoxId !== profile.box_id) {
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
