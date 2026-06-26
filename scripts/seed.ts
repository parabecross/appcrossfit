/**
 * Parabellum Cross — Seed profesional
 *
 * Ejecutar DESPUÉS de schema.sql:
 *   1. Copia .env.example → .env.local con tus keys de Supabase
 *   2. npm run seed
 *
 * Crea: admin, 3 coaches, 12 socios, 4 planes, membresías variadas,
 * clases de la semana y reservas con historial de asistencia.
 */

import { createClient } from "@supabase/supabase-js";
import { getSampleWorkout } from "../src/lib/clases/sample-workouts";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "Parabellum2024!";

async function createUser(
  email: string,
  nombre: string,
  rol: "admin" | "socio" | "coach",
  extra?: { telefono?: string; bio?: string; estado_cuenta?: string }
) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      nombre_completo: nombre,
      telefono: extra?.telefono,
      bio: extra?.bio,
      rol,
    },
  });
  if (error) throw new Error(`User ${email}: ${error.message}`);
  const userId = data.user!.id;

  const updates: Record<string, string> = { rol };
  if (extra?.estado_cuenta) updates.estado_cuenta = extra.estado_cuenta;
  if (extra?.telefono) updates.telefono = extra.telefono;
  if (extra?.bio) updates.bio = extra.bio;

  await supabase.from("profiles").update(updates).eq("user_id", userId);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  return profile!.id;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

async function main() {
  console.log("🥊 Seeding Parabellum Cross...\n");

  // Planes
  const planesData = [
    { nombre: "Mensualidad Normal", tipo: "mensual_fijo", duracion_dias: 30, precio: 1200, activo: true },
    { nombre: "Pase Diario", tipo: "mensual_fijo", duracion_dias: 1, precio: 150, activo: true },
    { nombre: "Total Pass", tipo: "convenio_externo", duracion_dias: 30, precio: null, activo: true },
    { nombre: "Wellhub", tipo: "convenio_externo", duracion_dias: 30, precio: null, activo: true },
  ];

  const { data: existingPlanes } = await supabase.from("planes").select("id").limit(1);
  let planIds: Record<string, string> = {};

  if (existingPlanes?.length) {
    const { data: all } = await supabase.from("planes").select("*");
    for (const p of all ?? []) planIds[p.nombre] = p.id;
    console.log("Planes ya existen, reutilizando...");
  } else {
    const { data: planes, error } = await supabase.from("planes").insert(planesData).select();
    if (error) throw error;
    for (const p of planes!) planIds[p.nombre] = p.id;
    console.log("✓ Planes creados");
  }

  // Staff
  await createUser(
    "admin@parabellum.cross",
    "Carlos Mendoza",
    "admin",
    { telefono: "+52 55 1234 5678", bio: "Fundador Parabellum Cross", estado_cuenta: "activo" }
  );

  const coachIds = await Promise.all([
    createUser("coach.maria@parabellum.cross", "María Vega", "coach", {
      telefono: "+52 55 2345 6789",
      bio: "CrossFit L2 · Especialista en halterofilia",
      estado_cuenta: "activo",
    }),
    createUser("coach.diego@parabellum.cross", "Diego Ruiz", "coach", {
      telefono: "+52 55 3456 7890",
      bio: "Hyrox & conditioning",
      estado_cuenta: "activo",
    }),
    createUser("coach.ana@parabellum.cross", "Ana Torres", "coach", {
      telefono: "+52 55 4567 8901",
      bio: "Gimnasia y movilidad",
      estado_cuenta: "activo",
    }),
  ]);
  console.log("✓ Admin + 3 coaches");

  const socios = [
    { email: "lucia.herrera@email.com", nombre: "Lucía Herrera", estado: "activo", memPlan: "Mensualidad Normal", memDays: 25 },
    { email: "jorge.martinez@email.com", nombre: "Jorge Martínez", estado: "activo", memPlan: "Mensualidad Normal", memDays: 18 },
    { email: "sofia.lopez@email.com", nombre: "Sofía López", estado: "activo", memPlan: "Mensualidad Normal", memDays: 2 },
    { email: "miguel.ramos@email.com", nombre: "Miguel Ramos", estado: "activo", memPlan: "Total Pass", memDays: 20, manual: true },
    { email: "elena.castro@email.com", nombre: "Elena Castro", estado: "activo", memPlan: "Wellhub", memDays: 15, manual: true },
    { email: "pablo.silva@email.com", nombre: "Pablo Silva", estado: "activo", memPlan: "Mensualidad Normal", memDays: -5 },
    { email: "carla.mendez@email.com", nombre: "Carla Méndez", estado: "activo", memPlan: "Mensualidad Normal", memDays: -12 },
    { email: "andres.vargas@email.com", nombre: "Andrés Vargas", estado: "activo", memPlan: "Mensualidad Normal", memDays: -2 },
    { email: "diana.ortiz@email.com", nombre: "Diana Ortiz", estado: "pendiente_pago", memPlan: null, memDays: 0 },
    { email: "fernando.guzman@email.com", nombre: "Fernando Guzmán", estado: "pendiente_pago", memPlan: null, memDays: 0 },
    { email: "valeria.nunez@email.com", nombre: "Valeria Núñez", estado: "activo", memPlan: "Mensualidad Normal", memDays: 28 },
    { email: "ricardo.pena@email.com", nombre: "Ricardo Peña", estado: "activo", memPlan: "Pase Diario", memDays: 0 },
  ];

  const socioIds: string[] = [];
  for (const s of socios) {
    const id = await createUser(s.email, s.nombre, "socio", {
      telefono: "+52 55 0000 " + Math.floor(Math.random() * 9000 + 1000),
      bio: "Miembro Parabellum Cross",
      estado_cuenta: s.estado,
    });
    socioIds.push(id);

    if (s.memPlan && planIds[s.memPlan]) {
      const hoy = new Date();
      const inicio = addDays(hoy, -30);
      const fin = addDays(hoy, s.memDays);
      await supabase.from("membresias").insert({
        usuario_id: id,
        plan_id: planIds[s.memPlan],
        fecha_inicio: inicio,
        fecha_fin: fin,
        metodo_asignacion: s.manual ? "manual" : "automatico",
      });
    }
  }
  console.log("✓ 12 socios con membresías variadas");

  const classNames = ["WOD Matutino", "Hyrox", "Halterofilia", "Gimnasia", "WOD Nocturno"];
  const times = [
    { start: "06:00", end: "07:00" },
    { start: "07:00", end: "08:00" },
    { start: "09:00", end: "10:00" },
    { start: "17:00", end: "18:00" },
    { start: "18:30", end: "19:30" },
    { start: "19:30", end: "20:30" },
  ];

  const today = new Date();
  const claseIds: string[] = [];

  for (let d = -7; d <= 7; d++) {
    const fecha = addDays(today, d);
    const dayTimes = d % 2 === 0 ? times.slice(0, 4) : times.slice(2, 6);
    for (let i = 0; i < dayTimes.length; i++) {
      const className = classNames[i % classNames.length];
      const { data: clase } = await supabase
        .from("clases")
        .insert({
          nombre: className,
          fecha,
          hora_inicio: dayTimes[i].start,
          hora_fin: dayTimes[i].end,
          cupo_maximo: 12,
          coach_id: coachIds[i % coachIds.length],
          estado: "programada",
          entrenamiento: getSampleWorkout(className),
        })
        .select("id")
        .single();
      if (clase) claseIds.push(clase.id);
    }
  }
  console.log(`✓ ${claseIds.length} clases (-7 a +7 días)`);

  // Reservas
  let reservaCount = 0;
  for (const claseId of claseIds.slice(0, 40)) {
    const num = Math.floor(Math.random() * 6) + 2;
    const shuffled = [...socioIds].sort(() => Math.random() - 0.5).slice(0, num);
    for (const uid of shuffled) {
      const isPast = claseIds.indexOf(claseId) < 20;
      const estado = isPast
        ? Math.random() > 0.2
          ? "asistio"
          : "no_asistio"
        : "confirmada";
      await supabase.from("reservas").insert({
        clase_id: claseId,
        usuario_id: uid,
        estado,
      });
      reservaCount++;
    }
  }
  console.log(`✓ ${reservaCount} reservas`);

  console.log("\n══════════════════════════════════════════");
  console.log("  SEED COMPLETADO");
  console.log("══════════════════════════════════════════");
  console.log("\n  Admin:");
  console.log("    Email:    admin@parabellum.cross");
  console.log(`    Password: ${PASSWORD}`);
  console.log("\n  Coach (ejemplo):");
  console.log("    Email:    coach.maria@parabellum.cross");
  console.log(`    Password: ${PASSWORD}`);
  console.log("\n  Socio (ejemplo):");
  console.log("    Email:    lucia.herrera@email.com");
  console.log(`    Password: ${PASSWORD}`);
  console.log("\n══════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
