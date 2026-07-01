import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  assertFeatureEnabled,
  getBoxEntitlements,
} from "@/lib/entitlements/engine";
import { EntitlementError } from "@/lib/entitlements/types";
import { awardWodResult } from "@/lib/ranking/engine";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      claseId?: string;
      usuarioId?: string;
    };
    if (!body.claseId || !body.usuarioId) {
      return NextResponse.json(
        { error: "claseId and usuarioId required" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, rol, box_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
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

    if (profile.rol === "socio" && profile.id !== body.usuarioId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: claseCtx } = await supabase
      .from("clases")
      .select("id, coach:profiles!clases_coach_id_fkey(box_id)")
      .eq("id", body.claseId)
      .maybeSingle();

    if (!claseCtx) {
      return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
    }

    const coach = claseCtx.coach as unknown as { box_id: string } | null;
    const coachBoxId = coach?.box_id;
    if (!profile.box_id || !coachBoxId || coachBoxId !== profile.box_id) {
      return NextResponse.json(
        { error: "La clase no pertenece a tu box" },
        { status: 403 }
      );
    }

    const { data: athlete } = await supabase
      .from("profiles")
      .select("box_id")
      .eq("id", body.usuarioId)
      .maybeSingle();

    if (!athlete || athlete.box_id !== profile.box_id) {
      return NextResponse.json(
        { error: "El atleta no pertenece a tu box" },
        { status: 403 }
      );
    }

    const result = await awardWodResult({
      claseId: body.claseId,
      usuarioId: body.usuarioId,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
