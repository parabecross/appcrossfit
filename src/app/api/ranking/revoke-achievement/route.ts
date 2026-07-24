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
import { revokeAchievement } from "@/lib/ranking/engine";

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
      badgeKey?: string;
      usuarioId?: string;
    };
    if (!body.badgeKey || !body.usuarioId) {
      return NextResponse.json(
        { error: "badgeKey and usuarioId required" },
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
      });
    } catch (e) {
      if (e instanceof RankingAccessError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    const result = await revokeAchievement({
      usuarioId: body.usuarioId,
      badgeKey: body.badgeKey,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
