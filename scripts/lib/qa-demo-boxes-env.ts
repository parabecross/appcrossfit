import { resolve } from "path";
import * as dotenv from "dotenv";
import { createScriptSupabaseClient } from "./supabase-script-client";
import { QA_ABORT_MESSAGE } from "./qa-demo-boxes-constants";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

export function requireQaScriptEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const confirmed = process.env.ATHRON_QA_CONFIRM === "true";

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    console.error(`Abortado: faltan variables en .env.local: ${missing.join(", ")}`);
    process.exit(1);
  }

  if (!confirmed) {
    console.error(QA_ABORT_MESSAGE);
    process.exit(1);
  }

  const service = createScriptSupabaseClient(url!, serviceKey!);
  return { service, url: url!, anonKey: anonKey! };
}
