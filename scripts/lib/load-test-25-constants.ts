/** Constantes del escenario load-test de 25 atletas (sin credenciales de infra). */

export const LOAD_TEST_SLUG = "athron-load-test-25";
export const LOAD_TEST_NAME = "ATHRON Load Test 25";
export const LOAD_TEST_TIMEZONE = "America/Mexico_City";
export const LOAD_TEST_TARGET_ATHLETES = 25;
export const LOAD_TEST_EMAIL_PREFIX = "loadtest25.";
export const LOAD_TEST_PASSWORD = "LoadTest25!Athron";
export const LOAD_TEST_CLASS_PREFIX = "[LOAD-TEST-25] ";
export const LOAD_TEST_CONCURRENCY_CLASS =
  "[LOAD-TEST-25] Concurrency Cupo10";
export const LOAD_TEST_NOTES =
  "athron-load-test-25:target_max_atletas=25";

export const LOAD_TEST_ABORT =
  "Abortado: define ATHRON_LOAD_TEST_CONFIRM=true para ejecutar scripts load-test-25.";

export const LOAD_TEST_ADMIN_EMAIL = "loadtest25.admin@athron.test";
export const LOAD_TEST_COACH_EMAILS = [
  "loadtest25.coach001@athron.test",
  "loadtest25.coach002@athron.test",
] as const;

export const LOAD_TEST_PLAN_NAMES = [
  "[LOAD-TEST-25] Ilimitado",
  "[LOAD-TEST-25] 12 clases",
  "[LOAD-TEST-25] 8 clases",
] as const;

/** Nombres deterministas para los 25 socios. */
export const LOAD_TEST_ATHLETE_NAMES = [
  "Ana Vargas",
  "Bruno Méndez",
  "Carla Ortega",
  "Diego Salas",
  "Elena Ruiz",
  "Felipe Conti",
  "Gina Torres",
  "Hugo Beltrán",
  "Irene Castro",
  "Jorge Núñez",
  "Karla Pineda",
  "Luis Herrera",
  "Marta Lozano",
  "Nicolás Ríos",
  "Olga Fuentes",
  "Pablo Aguilar",
  "Quinn Soto",
  "Rosa Delgado",
  "Sergio León",
  "Tania Mejía",
  "Ulises Cruz",
  "Valeria Peña",
  "Walter Díaz",
  "Ximena Rey",
  "Yuri Campos",
] as const;

export function athleteEmail(index1Based: number): string {
  return `loadtest25.atleta${String(index1Based).padStart(3, "0")}@athron.test`;
}

export function allLoadTestEmails(): string[] {
  return [
    LOAD_TEST_ADMIN_EMAIL,
    ...LOAD_TEST_COACH_EMAILS,
    ...Array.from({ length: LOAD_TEST_TARGET_ATHLETES }, (_, i) =>
      athleteEmail(i + 1)
    ),
  ];
}

export function assertLoadTestEmail(email: string): void {
  const lower = email.toLowerCase();
  if (!lower.startsWith(LOAD_TEST_EMAIL_PREFIX) || !lower.endsWith("@athron.test")) {
    throw new Error(
      `Email fuera de alcance load-test: ${email}. Solo ${LOAD_TEST_EMAIL_PREFIX}*@athron.test`
    );
  }
}
