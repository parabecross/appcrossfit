import { createAdminClient } from "@/lib/supabase/admin";
import type { Box, BoxStatus } from "@/types/database";

export interface BoxWithStats extends Box {
  athleteCount: number;
  coachCount: number;
  classCount: number;
  reservationCount: number;
  lastAccess: string | null;
}

function countByBox(
  items: Array<{ box_id: string }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item.box_id, (map.get(item.box_id) ?? 0) + 1);
  }
  return map;
}

export async function getAllBoxesWithStats(): Promise<BoxWithStats[]> {
  const admin = createAdminClient();

  const [{ data: boxes }, { data: profiles }, { data: clases }] =
    await Promise.all([
      admin.from("boxes").select("*").order("created_at", { ascending: false }),
      admin.from("profiles").select("id, box_id, rol, user_id"),
      admin.from("clases").select("id, coach_id"),
    ]);

  if (!boxes?.length) return [];

  const coachBoxMap = new Map<string, string>();
  const profileBoxMap = new Map<string, string>();
  const userIdsByBox = new Map<string, string[]>();

  const athleteCounts = new Map<string, number>();
  const coachCounts = new Map<string, number>();

  for (const p of profiles ?? []) {
    profileBoxMap.set(p.id, p.box_id);
    if (p.rol === "socio") {
      athleteCounts.set(p.box_id, (athleteCounts.get(p.box_id) ?? 0) + 1);
    }
    if (p.rol === "coach") {
      coachCounts.set(p.box_id, (coachCounts.get(p.box_id) ?? 0) + 1);
    }
    if (["coach", "admin", "box_admin"].includes(p.rol)) {
      coachBoxMap.set(p.id, p.box_id);
    }
    const list = userIdsByBox.get(p.box_id) ?? [];
    list.push(p.user_id);
    userIdsByBox.set(p.box_id, list);
  }

  const classCountItems: Array<{ box_id: string }> = [];
  for (const c of clases ?? []) {
    if (!c.coach_id) continue;
    const boxId = coachBoxMap.get(c.coach_id);
    if (boxId) classCountItems.push({ box_id: boxId });
  }
  const classCounts = countByBox(classCountItems);

  const { data: reservas } = await admin.from("reservas").select("usuario_id");
  const reservationCountItems: Array<{ box_id: string }> = [];
  for (const r of reservas ?? []) {
    const boxId = profileBoxMap.get(r.usuario_id);
    if (boxId) reservationCountItems.push({ box_id: boxId });
  }
  const reservationCounts = countByBox(reservationCountItems);

  const lastAccessByBox = new Map<string, string>();
  for (const box of boxes) {
    const userIds = userIdsByBox.get(box.id) ?? [];
    let latest: string | null = null;
    for (const userId of userIds.slice(0, 50)) {
      const { data: authData } = await admin.auth.admin.getUserById(userId);
      const at = authData.user?.last_sign_in_at;
      if (at && (!latest || at > latest)) latest = at;
    }
    if (latest) lastAccessByBox.set(box.id, latest);
  }

  return boxes.map((box) => ({
    ...box,
    athleteCount: athleteCounts.get(box.id) ?? 0,
    coachCount: coachCounts.get(box.id) ?? 0,
    classCount: classCounts.get(box.id) ?? 0,
    reservationCount: reservationCounts.get(box.id) ?? 0,
    lastAccess: lastAccessByBox.get(box.id) ?? null,
  }));
}

export async function getBoxWithStats(boxId: string): Promise<BoxWithStats | null> {
  const all = await getAllBoxesWithStats();
  return all.find((b) => b.id === boxId) ?? null;
}

export async function updateBoxStatus(
  boxId: string,
  status: BoxStatus
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("boxes")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", boxId);

  if (error) return { error: error.message };
  return {};
}
