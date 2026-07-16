/** Escenario QA reversible: 10 atletas en el box real Parabellum. */

export const PARABELLUM_BOX_SLUG = "parabellum-cross";
/** Identidad estable descubierta en el entorno; abortar si no coincide. */
export const PARABELLUM_BOX_ID = "7ce3d559-871c-43d1-badd-8fbdbd776ad6";
export const PARABELLUM_BOX_NAME = "Parabellum";

export const QA_SCENARIO_ID = "parabellum_10_athletes_v1";
export const QA_SCENARIO_NOTE = `athron_qa_scenario = ${QA_SCENARIO_ID}`;

export const QA_CLASS_PREFIX = "[QA-PARABELLUM-10]";
export const QA_EMAIL_PREFIX = "qa.parabellum.atleta";
export const QA_ATHLETE_COUNT = 10;
export const QA_PASSWORD = "QaParabellum10!Athron";

export const QA_WINDOW_PAST_DAYS = 10;
export const QA_WINDOW_FUTURE_DAYS = 10;

export const QA_ABORT =
  "Abortado: define ATHRON_PARABELLUM_QA_CONFIRM=true para scripts Parabellum-10-QA.";

export const SNAPSHOT_PATH = "scripts/lib/parabellum-10-qa-snapshot.json";

export function qaAthleteEmail(index1Based: number): string {
  return `${QA_EMAIL_PREFIX}${String(index1Based).padStart(2, "0")}@athron.test`;
}

export function qaAthleteName(index1Based: number): string {
  return `QA Parabellum Atleta ${String(index1Based).padStart(2, "0")}`;
}

export function allQaEmails(): string[] {
  return Array.from({ length: QA_ATHLETE_COUNT }, (_, i) =>
    qaAthleteEmail(i + 1)
  );
}

export function assertQaEmail(email: string): void {
  const lower = email.toLowerCase();
  if (
    !lower.startsWith(`${QA_EMAIL_PREFIX}`) ||
    !lower.endsWith("@athron.test")
  ) {
    throw new Error(`Email fuera de alcance QA Parabellum-10: ${email}`);
  }
}

export function isQaEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().startsWith(`${QA_EMAIL_PREFIX}`);
}

export type ParabellumQaSnapshot = {
  boxId: string;
  slug: string;
  name: string;
  realAthleteCount: number;
  totalSociosBefore: number;
  saasPlanCode: string | null;
  saasPlanName: string | null;
  maxAtletas: number | null;
  subscriptionStatus: string | null;
  subscriptionPlanId: string | null;
  savedAt: string;
};
