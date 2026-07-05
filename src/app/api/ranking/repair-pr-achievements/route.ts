import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertFeatureEnabled,
  getBoxEntitlements,
} from "@/lib/entitlements/engine";
import { EntitlementError } from "@/lib/entitlements/types";
import {
  assertPrRankingAccess,
  RankingAccessError,
} from "@/lib/ranking/assert-pr-ranking-access";
import { cleanupOrphanPrRankingEvents } from "@/lib/ranking/engine";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      usuarioId?: string;
    };

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, box_id, rol")
      .eq("user_id", user.id)
      .single();

    if (!profile?.box_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const targetUsuarioId = body.usuarioId ?? profile.id;

    try {
      const ent = await getBoxEntitlements(profile.box_id);
      assertFeatureEnabled(ent, "ranking");
    } catch (e) {
      if (e instanceof EntitlementError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    const isAdmin =
      profile.rol === "admin" || profile.rol === "coach" || profile.rol === "owner";

    if (!isAdmin && targetUsuarioId !== profile.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      await assertPrRankingAccess({
        supabase,
        caller: profile,
        targetUsuarioId,
      });
    } catch (e) {
      if (e instanceof RankingAccessError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    const result = await cleanupOrphanPrRankingEvents({
      usuarioId: targetUsuarioId,
      boxId: profile.box_id,
      admin: createAdminClient(),
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
