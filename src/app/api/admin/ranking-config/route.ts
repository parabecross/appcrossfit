import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mergeRankingConfig } from "@/lib/ranking/config";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
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

    if (!profile?.box_id || profile.rol !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("ranking_config")
      .upsert(
        {
          box_id: profile.box_id,
          ...body,
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
