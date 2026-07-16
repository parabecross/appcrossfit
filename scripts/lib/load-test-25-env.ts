import { resolve } from "path";
import * as dotenv from "dotenv";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createScriptSupabaseClient } from "./supabase-script-client";
import {
  LOAD_TEST_ABORT,
  LOAD_TEST_EMAIL_PREFIX,
  LOAD_TEST_SLUG,
  assertLoadTestEmail,
} from "./load-test-25-constants";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

export type LoadTestEnv = {
  service: SupabaseClient;
  url: string;
  anonKey: string;
};

export function requireLoadTestEnv(): LoadTestEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const confirmed = process.env.ATHRON_LOAD_TEST_CONFIRM === "true";

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    console.error(`Abortado: faltan variables en .env.local: ${missing.join(", ")}`);
    process.exit(1);
  }

  if (!confirmed) {
    console.error(LOAD_TEST_ABORT);
    process.exit(1);
  }

  const service = createScriptSupabaseClient(url!, serviceKey!);
  return { service, url: url!, anonKey: anonKey! };
}

export async function requireLoadTestBox(
  service: SupabaseClient
): Promise<{ id: string; name: string; slug: string }> {
  const { data, error } = await service
    .from("boxes")
    .select("id, name, slug")
    .eq("slug", LOAD_TEST_SLUG);

  if (error) throw new Error(`Box lookup: ${error.message}`);
  if (!data || data.length !== 1) {
    throw new Error(
      `Se esperaba exactamente 1 box slug="${LOAD_TEST_SLUG}", encontrados ${data?.length ?? 0}`
    );
  }
  if (data[0].slug !== LOAD_TEST_SLUG) {
    throw new Error(`Slug incorrecto: ${data[0].slug}`);
  }
  return data[0];
}

export function assertOnlyLoadTestEmails(emails: string[]): void {
  for (const email of emails) {
    assertLoadTestEmail(email);
    if (!email.toLowerCase().startsWith(LOAD_TEST_EMAIL_PREFIX)) {
      throw new Error(`Prefijo inválido: ${email}`);
    }
  }
}

export async function listAuthUsersByEmail(service: SupabaseClient) {
  const map = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email) map.set(u.email.toLowerCase(), u.id);
    }
    if (data.users.length < 200) break;
    page++;
  }
  return map;
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
  return dt.toISOString().slice(0, 10);
}
