import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/super-admin-api";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import {
  serializeEntitlementsForSuperAdmin,
  suspendBoxSubscription,
} from "@/lib/queries/subscriptions";
import { rateLimitOrNull } from "@/lib/security/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimitOrNull(request, "admin-athron:suspend", 20);
  if (limited) return limited;

  const auth = await requireSuperAdminApi();
  if ("error" in auth && auth.error) return auth.error;

  const { id } = await params;
  await suspendBoxSubscription(id);

  const ent = await getBoxEntitlements(id);
  return NextResponse.json(serializeEntitlementsForSuperAdmin(ent));
}
