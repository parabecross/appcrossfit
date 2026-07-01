/**
 * Crea (o actualiza) el Super Admin de plataforma ATHRON.
 * Credenciales del box demo Parabellum Cross (no confundir con ATHRON).
 *
 * Uso:
 *   npm run create-super-admin
 *
 * Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const SUPER_ADMIN_EMAIL = "superadmin@athron.app";
const SUPER_ADMIN_PASSWORD = "AthronSuper2024!";
const SUPER_ADMIN_NAME = "ATHRON Super Admin";

if (!url || !serviceKey) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: defaultBox } = await supabase
    .from("boxes")
    .select("id")
    .eq("slug", "parabellum-cross")
    .single();

  if (!defaultBox) {
    console.error("No existe el box parabellum-cross. Corre migration-athron-fase1.sql primero.");
    process.exit(1);
  }

  const { data: existingList } = await supabase.auth.admin.listUsers();
  const existing = existingList?.users?.find((u) => u.email === SUPER_ADMIN_EMAIL);

  let userId: string;

  if (existing) {
    userId = existing.id;
    await supabase.auth.admin.updateUserById(userId, {
      password: SUPER_ADMIN_PASSWORD,
      user_metadata: {
        nombre_completo: SUPER_ADMIN_NAME,
        rol: "admin",
        box_id: defaultBox.id,
      },
    });
    console.log("Usuario existente actualizado.");
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        nombre_completo: SUPER_ADMIN_NAME,
        rol: "admin",
        box_id: defaultBox.id,
      },
    });
    if (error) throw error;
    userId = data.user!.id;
    console.log("Usuario Super Admin creado.");
  }

  await supabase
    .from("profiles")
    .update({
      nombre_completo: SUPER_ADMIN_NAME,
      rol: "admin",
      estado_cuenta: "activo",
      box_id: defaultBox.id,
      is_super_admin: true,
    })
    .eq("user_id", userId);

  console.log("\n══════════════════════════════════════════");
  console.log("  SUPER ADMIN ATHRON");
  console.log("══════════════════════════════════════════");
  console.log(`  Email:    ${SUPER_ADMIN_EMAIL}`);
  console.log(`  Password: ${SUPER_ADMIN_PASSWORD}`);
  console.log("  Login → redirige a /admin-athron/dashboard");
  console.log("\n  Demo box admin (Parabellum Cross):");
  console.log("    admin@parabellum.cross / Parabellum2024!");
  console.log("══════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
