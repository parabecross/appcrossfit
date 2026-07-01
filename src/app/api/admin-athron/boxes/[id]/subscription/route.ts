import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/super-admin-api";
import { getBoxEntitlements } from "@/lib/entitlements/engine";
import {
  serializeEntitlementsForSuperAdmin,
  updateBoxSubscription,
} from "@/lib/queries/subscriptions";
import { rateLimitOrNull } from "@/lib/security/rate-limit";
import type { PlanCode, SubscriptionStatus } from "@/lib/entitlements/features";

const STATUSES: SubscriptionStatus[] = [
  "trialing",
  "active",
  "grace_period",
  "expired",
  "suspended",
  "canceled",
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimitOrNull(request, "admin-athron:subscription", 60);
  if (limited) return limited;

  const auth = await requireSuperAdminApi();
  if ("error" in auth && auth.error) return auth.error;

  const { id } = await params;
  const ent = await getBoxEntitlements(id);
  return NextResponse.json(serializeEntitlementsForSuperAdmin(ent));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimitOrNull(request, "admin-athron:subscription", 30);
  if (limited) return limited;

  const auth = await requireSuperAdminApi();
  if ("error" in auth && auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const {
    planCode,
    status,
    currentPeriodEnd,
    trialEndsAt,
    graceEndsAt,
    notes,
  } = body as {
    planCode?: PlanCode;
    status?: SubscriptionStatus;
    currentPeriodEnd?: string | null;
    trialEndsAt?: string | null;
    graceEndsAt?: string | null;
    notes?: string | null;
  };

  if (planCode && !["start", "pro", "elite"].includes(planCode)) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
  }
  if (status && !STATUSES.includes(status)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  await updateBoxSubscription(id, {
    planCode,
    status,
    currentPeriodEnd,
    trialEndsAt,
    graceEndsAt,
    notes,
  });

  const ent = await getBoxEntitlements(id);
  return NextResponse.json(serializeEntitlementsForSuperAdmin(ent));
}
