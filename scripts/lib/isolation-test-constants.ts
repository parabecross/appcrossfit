/** Boxes y usuarios creados por scripts/check-box-isolation.ts (CI QA RLS). */

export const ISOLATION_TEST_PASSWORD = "TestIsolation2024!";

export const ISOLATION_TEST_EMAILS = {
  adminA: "test-isolation-admin-a@athron.test",
  socioA: "test-isolation-socio-a@athron.test",
  adminB: "test-isolation-admin-b@athron.test",
  socioB: "test-isolation-socio-b@athron.test",
} as const;

export const ISOLATION_TEST_BOX_SLUGS = {
  a: "test-box-a",
  b: "test-box-b",
} as const;

export const ISOLATION_TEST_BOX_NAMES = {
  a: "Test Box A",
  b: "Test Box B",
} as const;
