import { NextRequest, NextResponse } from "next/server";
import { deleteBoxPermanently } from "@/lib/box/delete-box";
import { requireSuperAdminApi } from "@/lib/auth/super-admin-api";
import {
  updateBoxName,
  updateBoxStatus,
  validateBoxName,
} from "@/lib/queries/athron-admin";
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
  const { status, name } = body as { status?: BoxStatus; name?: string };

  if (status === undefined && name === undefined) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  let updatedName: string | undefined;
  let updatedStatus: BoxStatus | undefined;

  if (name !== undefined) {
    const parsed = validateBoxName(name);
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const result = await updateBoxName(id, parsed.value!);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    updatedName = result.name;
  }

  if (status !== undefined) {
    if (!ALLOWED.includes(status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    const result = await updateBoxStatus(id, status);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    updatedStatus = status;
  }

  return NextResponse.json({
    success: true,
    name: updatedName,
    status: updatedStatus,
  });
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
