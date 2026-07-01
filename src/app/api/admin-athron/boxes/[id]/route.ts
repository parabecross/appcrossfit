import { NextRequest, NextResponse } from "next/server";
import { deleteBoxPermanently } from "@/lib/box/delete-box";
import { updateBoxStatus } from "@/lib/queries/athron-admin";
import { rateLimitOrNull } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { BoxStatus } from "@/types/database";

const ALLOWED: BoxStatus[] = ["active", "inactive", "trial"];

async function requireSuperAdminApi() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("user_id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    return { error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error: NextResponse.json(
        { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." },
        { status: 500 }
      ),
    };
  }

  return { ok: true as const };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimitOrNull(request, "admin-athron:boxes", 30);
  if (limited) return limited;

  const auth = await requireSuperAdminApi();
  if ("error" in auth && auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const { status } = body as { status?: BoxStatus };

  if (!status || !ALLOWED.includes(status)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  const result = await updateBoxStatus(id, status);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, status });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimitOrNull(request, "admin-athron:boxes", 30);
  if (limited) return limited;

  const auth = await requireSuperAdminApi();
  if ("error" in auth && auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const confirmSlug =
    typeof body.confirmSlug === "string" ? body.confirmSlug : "";

  if (!confirmSlug.trim()) {
    return NextResponse.json(
      { error: "Falta confirmSlug (slug del box)" },
      { status: 400 }
    );
  }

  const result = await deleteBoxPermanently(id, confirmSlug);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    deletedUsers: result.deletedUsers,
    deletedProfiles: result.deletedProfiles,
  });
}
