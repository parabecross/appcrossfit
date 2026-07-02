/** Constantes compartidas entre seed/teardown QA multi-box (no contiene credenciales). */

export const QA_PASSWORD = "QaDemo2026!";

export const PARABELLUM_SLUG = "parabellum-cross";

export const BETA_SLUG = "qa-demo-box-beta";
export const BETA_NAME = "QA Demo Box Beta";

export const PARABELLUM_CLASS_PREFIX = "[QA-DEMO-PARABELLUM] ";
export const BETA_CLASS_PREFIX = "[QA-DEMO-BETA] ";

export const PARABELLUM_PLAN_NAME = "[QA-DEMO-PARABELLUM] Plan QA";
export const BETA_PLAN_NAME = "[QA-DEMO-BETA] Plan QA";

export const PARABELLUM_EMAILS = {
  admin: "qa-demo-parabellum-admin@athron.test",
  coach: "qa-demo-parabellum-coach@athron.test",
  socio1: "qa-demo-parabellum-socio1@athron.test",
  socio2: "qa-demo-parabellum-socio2@athron.test",
  socio3: "qa-demo-parabellum-socio3@athron.test",
} as const;

export const BETA_EMAILS = {
  admin: "qa-demo-beta-admin@athron.test",
  coach: "qa-demo-beta-coach@athron.test",
  socio1: "qa-demo-beta-socio1@athron.test",
  socio2: "qa-demo-beta-socio2@athron.test",
  socio3: "qa-demo-beta-socio3@athron.test",
} as const;

export const QA_ABORT_MESSAGE =
  "Abortado: define ATHRON_QA_CONFIRM=true para ejecutar scripts QA sobre la base configurada.";
