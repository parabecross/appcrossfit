import { NextResponse } from "next/server";
import { isAdminLikeRole } from "@/lib/auth/roles";
import {
  assertFeatureEnabled,
  getBoxEntitlements,
} from "@/lib/entitlements/engine";
import { EntitlementError } from "@/lib/entitlements/types";
import { mergeRankingConfig } from "@/lib/ranking/config";
import { parseRankingConfigPatch } from "@/lib/ranking/parse-config-patch";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rateLimitOrNull } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimitOrNull(request, "admin:ranking-config", 30);
  if (limited) return limited;

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
      .select("box_id, rol")
      .eq("user_id", user.id)
      .single();

    if (
      !profile?.box_id ||
      !["admin", "coach", "box_admin"].includes(profile.rol)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      const ent = await getBoxEntitlements(profile.box_id);
      assertFeatureEnabled(ent, "ranking_config");
    } catch (e) {
      if (e instanceof EntitlementError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    // admin: bypasses RLS — box_id scoped from authenticated profile
    const admin = createAdminClient();
    const { data } = await admin
      .from("ranking_config")
      .select("*")
      .eq("box_id", profile.box_id)
      .maybeSingle();

    return NextResponse.json(mergeRankingConfig(profile.box_id, data));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const limited = rateLimitOrNull(request, "admin:ranking-config", 30);
  if (limited) return limited;

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
      .select("box_id, rol")
      .eq("user_id", user.id)
      .single();

    if (!profile?.box_id || !isAdminLikeRole(profile.rol)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      const ent = await getBoxEntitlements(profile.box_id);
      assertFeatureEnabled(ent, "ranking_config");
    } catch (e) {
      if (e instanceof EntitlementError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    const body = await request.json();
    const parsed = parseRankingConfigPatch(body);
    if (!parsed.ok) {
      return NextResponse.json({ errors: parsed.errors }, { status: 400 });
    }

    // admin: bypasses RLS — allowlisted fields only; box_id forced last
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ranking_config")
      .upsert(
        {
          ...parsed.patch,
          box_id: profile.box_id,
        },
        { onConflict: "box_id" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(mergeRankingConfig(profile.box_id, data));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
