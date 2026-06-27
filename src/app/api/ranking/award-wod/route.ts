import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
      .select("id, rol")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (profile.rol === "socio" && profile.id !== body.usuarioId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
