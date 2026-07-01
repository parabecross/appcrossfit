import { NextRequest, NextResponse } from "next/server";
import { isAdminLikeRole } from "@/lib/auth/roles";
import { EntitlementError } from "@/lib/entitlements/types";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import { serializeEntitlementsForBox } from "@/lib/queries/subscriptions";
import { rateLimitOrNull } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const limited = rateLimitOrNull(request, "admin:subscription", 60);
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("rol, box_id")
    .eq("user_id", user.id)
    .single();

  if (!profile || !isAdminLikeRole(profile.rol)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  if (!profile.box_id) {
    return NextResponse.json({ error: "Perfil sin box asignado" }, { status: 400 });
  }

  try {
    const ent = await getBoxEntitlements(profile.box_id);
    return NextResponse.json(serializeEntitlementsForBox(ent));
  } catch (e) {
    if (e instanceof EntitlementError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
