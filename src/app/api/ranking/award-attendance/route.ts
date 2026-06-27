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
      .select("rol")
      .eq("user_id", user.id)
      .single();

    if (!profile || !["admin", "coach", "box_admin"].includes(profile.rol)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { reservaId?: string };
    if (!body.reservaId) {
      return NextResponse.json({ error: "reservaId required" }, { status: 400 });
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
