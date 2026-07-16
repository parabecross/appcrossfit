import { resolve } from "path";
import * as dotenv from "dotenv";
import { writeFileSync, readFileSync, existsSync } from "fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createScriptSupabaseClient } from "./supabase-script-client";
import {
  PARABELLUM_BOX_ID,
  PARABELLUM_BOX_NAME,
  PARABELLUM_BOX_SLUG,
  QA_ABORT,
  QA_EMAIL_PREFIX,
  SNAPSHOT_PATH,
  type ParabellumQaSnapshot,
  assertQaEmail,
  isQaEmail,
} from "./parabellum-10-qa-constants";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

export type ParabellumQaEnv = {
  service: SupabaseClient;
  url: string;
  anonKey: string;
};

export function requireParabellumQaEnv(): ParabellumQaEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const confirmed = process.env.ATHRON_PARABELLUM_QA_CONFIRM === "true";

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    console.error(`Abortado: faltan variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  if (!confirmed) {
    console.error(QA_ABORT);
    process.exit(1);
  }

  return {
    service: createScriptSupabaseClient(url!, serviceKey!),
    url: url!,
    anonKey: anonKey!,
  };
}

export type ResolvedParabellumBox = {
  id: string;
  name: string;
  slug: string;
  status: string;
  timezone: string;
};

export async function resolveParabellumBox(
  service: SupabaseClient
): Promise<ResolvedParabellumBox> {
  const { data, error } = await service
    .from("boxes")
    .select("id, name, slug, status, timezone")
    .eq("slug", PARABELLUM_BOX_SLUG);

  if (error) throw new Error(`Box lookup: ${error.message}`);
  if (!data || data.length !== 1) {
    throw new Error(
      `Se esperaba exactamente 1 box slug="${PARABELLUM_BOX_SLUG}", encontrados ${data?.length ?? 0}`
    );
  }

  const box = data[0];
  if (box.id !== PARABELLUM_BOX_ID) {
    throw new Error(
      `ID de Parabellum no coincide. esperado=${PARABELLUM_BOX_ID} actual=${box.id}`
    );
  }
  if (box.name !== PARABELLUM_BOX_NAME) {
    throw new Error(
      `Nombre de Parabellum no coincide. esperado="${PARABELLUM_BOX_NAME}" actual="${box.name}"`
    );
  }
  if (box.slug !== PARABELLUM_BOX_SLUG) {
    throw new Error(`Slug incorrecto: ${box.slug}`);
  }
  if (box.status !== "active") {
    throw new Error(`Parabellum no está activo (status=${box.status})`);
  }

  const timezone = box.timezone || "America/Mexico_City";
  if (!box.timezone) {
    console.warn(
      "⚠ boxes.timezone vacío — usando America/Mexico_City"
    );
  }

  console.log("Parabellum resuelto:");
  console.log(`  id:       ${box.id}`);
  console.log(`  slug:     ${box.slug}`);
  console.log(`  name:     ${box.name}`);
  console.log(`  status:   ${box.status}`);
  console.log(`  timezone: ${timezone}`);

  return { ...box, timezone };
}

export async function listAuthUsersByEmail(service: SupabaseClient) {
  const map = new Map<string, { id: string; email: string }>();
  let page = 1;
  while (true) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email) {
        map.set(u.email.toLowerCase(), { id: u.id, email: u.email });
      }
    }
    if (data.users.length < 200) break;
    page++;
  }
  return map;
}

export async function countSocios(
  service: SupabaseClient,
  boxId: string
): Promise<{ total: number; real: number; qa: number; activos: number }> {
  const { data, error } = await service
    .from("profiles")
    .select("id, user_id, rol, estado_cuenta")
    .eq("box_id", boxId)
    .eq("rol", "socio");
  if (error) throw error;

  const auth = await listAuthUsersByEmail(service);
  let real = 0;
  let qa = 0;
  let activos = 0;
  for (const p of data ?? []) {
    const email = [...auth.values()].find((a) => a.id === p.user_id)?.email;
    if (isQaEmail(email)) qa++;
    else real++;
    if (p.estado_cuenta === "activo") activos++;
  }
  return { total: (data ?? []).length, real, qa, activos };
}

export async function loadSubscriptionSnapshot(
  service: SupabaseClient,
  boxId: string
): Promise<{
  status: string | null;
  planId: string | null;
  planCode: string | null;
  planName: string | null;
  maxAtletas: number | null;
}> {
  const { data: sub, error } = await service
    .from("box_subscriptions")
    .select("status, plan_id")
    .eq("box_id", boxId)
    .maybeSingle();
  if (error) throw error;
  if (!sub) {
    return {
      status: null,
      planId: null,
      planCode: null,
      planName: null,
      maxAtletas: null,
    };
  }
  const { data: plan } = await service
    .from("plans")
    .select("code, name, max_atletas")
    .eq("id", sub.plan_id)
    .maybeSingle();
  return {
    status: sub.status,
    planId: sub.plan_id,
    planCode: plan?.code ?? null,
    planName: plan?.name ?? null,
    maxAtletas: plan?.max_atletas ?? null,
  };
}

export function saveSnapshot(snapshot: ParabellumQaSnapshot): void {
  const path = resolve(process.cwd(), SNAPSHOT_PATH);
  writeFileSync(path, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
  console.log(`Snapshot guardado: ${SNAPSHOT_PATH}`);
}

export function loadSnapshot(): ParabellumQaSnapshot | null {
  const path = resolve(process.cwd(), SNAPSHOT_PATH);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as ParabellumQaSnapshot;
}

export function todayInTimezone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "01";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function assertOnlyQaEmails(emails: string[]): void {
  for (const e of emails) assertQaEmail(e);
}

/** Abort if QA emails exist on a non-Parabellum box. */
export async function assertQaEmailsOnlyOnParabellum(
  service: SupabaseClient,
  boxId: string
): Promise<number> {
  const auth = await listAuthUsersByEmail(service);
  let onBox = 0;
  for (const [email, user] of auth) {
    if (!email.startsWith(QA_EMAIL_PREFIX)) continue;
    const { data: profile } = await service
      .from("profiles")
      .select("box_id, rol")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) continue;
    if (profile.box_id !== boxId) {
      throw new Error(
        `QA email ${email} está en otro box (${profile.box_id}). Abortado.`
      );
    }
    if (profile.rol !== "socio") {
      throw new Error(`QA email ${email} tiene rol ${profile.rol}. Abortado.`);
    }
    onBox++;
  }
  return onBox;
}
