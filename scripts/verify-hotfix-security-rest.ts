/**
 * Verifica hotfix de vistas legacy (PostgREST anon).
 *
 *   npm run verify-hotfix-security
 *
 * Requiere .env.local y que migration-hotfix-security-pilot.sql esté aplicada.
 * Esperado: HTTP 403/401 o cuerpo vacío — nunca datos de membresías/clases cross-box.
 */

import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url || !anonKey) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const VIEWS = [
  "membresia_actual",
  "alertas_membresia",
  "reservas_con_cupo",
] as const;

async function probeView(view: string) {
  const res = await fetch(
    `${url}/rest/v1/${view}?select=*&limit=1`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    }
  );

  const text = await res.text();
  let rowCount = 0;
  try {
    const parsed = JSON.parse(text);
    rowCount = Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    /* not json */
  }

  const pass =
    res.status === 401 ||
    res.status === 403 ||
    rowCount === 0 ||
    text === "[]";

  return {
    view,
    http: res.status,
    rowCount,
    pass,
    snippet: text.slice(0, 80).replace(/\n/g, " "),
  };
}

async function probeRankingInsert() {
  const res = await fetch(`${url}/rest/v1/ranking_point_events`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      box_id: "00000000-0000-0000-0000-000000000001",
      usuario_id: "00000000-0000-0000-0000-000000000002",
      month_key: "2099-01",
      fecha: "2099-01-01",
      event_type: "attendance",
      points: 1,
      idempotency_key: `hotfix-verify-${Date.now()}`,
    }),
  });

  const pass =
    res.status === 401 ||
    res.status === 403 ||
    res.status === 42501;

  return {
    label: "ranking_point_events INSERT anon",
    http: res.status,
    pass,
    body: (await res.text()).slice(0, 120),
  };
}

async function main() {
  console.log("🔒 verify-hotfix-security-rest\n");

  let failed = 0;

  for (const view of VIEWS) {
    const r = await probeView(view);
    const icon = r.pass ? "PASS" : "FAIL";
    console.log(
      `[${icon}] GET ${view} → HTTP ${r.http} rows=${r.rowCount}${r.pass ? "" : ` body=${r.snippet}`}`
    );
    if (!r.pass) failed++;
  }

  const ins = await probeRankingInsert();
  const insIcon = ins.pass ? "PASS" : "FAIL";
  console.log(
    `[${insIcon}] ${ins.label} → HTTP ${ins.http}${ins.pass ? "" : ` body=${ins.body}`}`
  );
  if (!ins.pass) failed++;

  console.log("\n" + "═".repeat(50));
  if (failed === 0) {
    console.log("OK — hotfix REST checks passed");
    process.exit(0);
  }
  console.log(`FAIL — ${failed} check(s). ¿Aplicaste migration-hotfix-security-pilot.sql?`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
