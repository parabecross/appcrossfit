import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Regresión: BirthdayInfoCard se importa directamente desde
 * dashboard-attention-center.tsx, que es un Client Component. Si este
 * archivo vuelve a usar getTranslations (next-intl/server, solo Server
 * Components), Next.js rompe con "getTranslations is not supported in
 * Client Components" en /admin/dashboard.
 *
 * No hay infraestructura de render (RTL/jsdom) en este proyecto — este es
 * un guardrail estático sobre el código fuente, no un test de render.
 */
const source = readFileSync(
  path.resolve(__dirname, "./birthday-info-card.tsx"),
  "utf-8"
);

describe("BirthdayInfoCard (regresión: getTranslations en Client Component)", () => {
  it("no importa getTranslations de next-intl/server", () => {
    expect(source).not.toMatch(/from ["']next-intl\/server["']/);
  });

  it("usa useTranslations (client-safe) y declara 'use client'", () => {
    expect(source).toMatch(/^"use client";/);
    expect(source).toMatch(/from ["']next-intl["']/);
    expect(source).toMatch(/useTranslations\(/);
  });
});
