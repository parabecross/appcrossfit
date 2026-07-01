import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/super-admin-api";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import {
  activatePromotionalAccess,
  extendPromotionalAccess,
  serializeEntitlementsForSuperAdmin,
} from "@/lib/queries/subscriptions";
import { rateLimitOrNull } from "@/lib/security/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimitOrNull(request, "admin-athron:promotional", 20);
  if (limited) return limited;

  const auth = await requireSuperAdminApi();
  if ("error" in auth && auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const days = typeof body.days === "number" ? body.days : 30;
  const extend = Boolean(body.extend);

  if (extend) {
    await extendPromotionalAccess(id, days);
  } else {
    await activatePromotionalAccess(id, days);
  }

  const ent = await getBoxEntitlements(id);
  return NextResponse.json(serializeEntitlementsForSuperAdmin(ent));
}
