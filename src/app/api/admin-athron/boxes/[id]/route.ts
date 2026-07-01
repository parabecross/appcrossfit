import { NextRequest, NextResponse } from "next/server";
import { deleteBoxPermanently } from "@/lib/box/delete-box";
import { requireSuperAdminApi } from "@/lib/auth/super-admin-api";
import { updateBoxStatus } from "@/lib/queries/athron-admin";
import { rateLimitOrNull } from "@/lib/security/rate-limit";
import type { BoxStatus } from "@/types/database";

const ALLOWED: BoxStatus[] = ["active", "inactive", "trial"];

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
