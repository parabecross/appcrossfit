import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  assertFeatureEnabled,
  getBoxEntitlements,
} from "@/lib/entitlements/engine";
import { EntitlementError } from "@/lib/entitlements/types";
import {
  assertPrRankingAccess,
  RankingAccessError,
} from "@/lib/ranking/assert-pr-ranking-access";
import { reconcilePrAchievementsForMarca } from "@/lib/ranking/engine";

/** Reconcilia puntos tras editar una marca existente (mismo id). */
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
      marcaId?: string;
      usuarioId?: string;
    };
    if (!body.marcaId || !body.usuarioId) {
      return NextResponse.json(
        { error: "marcaId and usuarioId required" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, box_id, rol")
      .eq("user_id", user.id)
      .single();

    if (!profile?.box_id) {
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

    try {
      await assertPrRankingAccess({
        supabase,
        caller: profile,
        targetUsuarioId: body.usuarioId,
        marcaId: body.marcaId,
      });
    } catch (e) {
      if (e instanceof RankingAccessError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    const result = await reconcilePrAchievementsForMarca({
      marcaId: body.marcaId,
      usuarioId: body.usuarioId,
      boxId: profile.box_id,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
