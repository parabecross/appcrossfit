/** Boxes y usuarios creados por scripts/verify-security-hardening-2026-07.ts. */

export const HARDENING_TEST_PASSWORD = "TestHardening2026!";

export const HARDENING_TEST_EMAILS = {
  socioA: "test-hardening-socio-a@athron.test",
  coachA: "test-hardening-coach-a@athron.test",
  socioB: "test-hardening-socio-b@athron.test",
} as const;

export const HARDENING_TEST_BOX_SLUGS = {
  a: "test-hardening-box-a",
  b: "test-hardening-box-b",
} as const;

export const HARDENING_TEST_BOX_NAMES = {
  a: "Test Hardening Box A",
  b: "Test Hardening Box B",
} as const;
