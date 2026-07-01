import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/super-admin-api";
import { FEATURE_KEYS, type FeatureKey } from "@/lib/entitlements/features";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import {
  removeFeatureOverride,
  serializeEntitlementsForSuperAdmin,
  setFeatureOverride,
} from "@/lib/queries/subscriptions";
import { rateLimitOrNull } from "@/lib/security/rate-limit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimitOrNull(request, "admin-athron:features", 40);
  if (limited) return limited;

  const auth = await requireSuperAdminApi();
  if ("error" in auth && auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const { featureKey, enabled, reason, reset } = body as {
    featureKey?: string;
    enabled?: boolean;
    reason?: string | null;
    reset?: boolean;
  };

  if (!featureKey || !FEATURE_KEYS.includes(featureKey as FeatureKey)) {
    return NextResponse.json({ error: "Función inválida" }, { status: 400 });
  }

  if (reset) {
    await removeFeatureOverride(id, featureKey as FeatureKey);
  } else if (typeof enabled === "boolean") {
    await setFeatureOverride(id, featureKey as FeatureKey, enabled, reason);
  } else {
    return NextResponse.json({ error: "Falta enabled o reset" }, { status: 400 });
  }

  const ent = await getBoxEntitlements(id);
  return NextResponse.json(serializeEntitlementsForSuperAdmin(ent));
}
