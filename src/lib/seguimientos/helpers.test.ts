import { describe, expect, it } from "vitest";
import {
  buildAthleteFollowUpSummary,
  deriveFollowUpStatus,
  validateCreateSeguimientoInput,
} from "./helpers";

describe("validateCreateSeguimientoInput", () => {
  it("rejects invalid type/outcome and long notes", () => {
    expect(
      validateCreateSeguimientoInput({
        usuarioId: "a",
        tipoInteraccion: "nope" as never,
        resultado: "contacted",
      }).ok
    ).toBe(false);

    expect(
      validateCreateSeguimientoInput({
        usuarioId: "a",
        tipoInteraccion: "whatsapp",
        resultado: "contacted",
        nota: "x".repeat(2001),
      }).ok
    ).toBe(false);
  });

  it("requires follow-up date when flagged", () => {
    const missing = validateCreateSeguimientoInput({
      usuarioId: "a",
      tipoInteraccion: "whatsapp",
      resultado: "follow_up_required",
      requiresFollowUp: true,
    });
    expect(missing.ok).toBe(false);

    const ok = validateCreateSeguimientoInput({
      usuarioId: "a",
      tipoInteraccion: "whatsapp",
      resultado: "contacted",
      requiresFollowUp: true,
      followUpAt: "2026-08-01T12:00:00.000Z",
    });
    expect(ok.ok).toBe(true);
  });
  it("rejects invalid occurred_at", () => {
    expect(
      validateCreateSeguimientoInput({
        usuarioId: "a",
        tipoInteraccion: "whatsapp",
        resultado: "contacted",
        occurredAt: "not-a-date",
      }).ok
    ).toBe(false);
  });
});

describe("deriveFollowUpStatus / buildAthleteFollowUpSummary", () => {
  const now = new Date("2026-07-15T15:00:00.000Z");

  it("marks never contacted", () => {
    const status = deriveFollowUpStatus([], now);
    expect(status.followUpStatus).toBe("never_contacted");
    expect(status.neverContacted).toBe(true);
  });

  it("detects overdue, today and scheduled follow-ups", () => {
    expect(
      deriveFollowUpStatus(
        [
          {
            occurred_at: "2026-07-10T12:00:00.000Z",
            follow_up_at: "2026-07-12T12:00:00.000Z",
            resultado: "contacted",
          },
        ],
        now
      ).followUpStatus
    ).toBe("overdue");

    expect(
      deriveFollowUpStatus(
        [
          {
            occurred_at: "2026-07-14T12:00:00.000Z",
            follow_up_at: "2026-07-15T18:00:00.000Z",
            resultado: "follow_up_required",
          },
        ],
        now
      ).followUpStatus
    ).toBe("today");

    expect(
      deriveFollowUpStatus(
        [
          {
            occurred_at: "2026-07-14T12:00:00.000Z",
            follow_up_at: "2026-07-20T12:00:00.000Z",
            resultado: "contacted",
          },
        ],
        now
      ).followUpStatus
    ).toBe("scheduled");
  });

  it("clears follow-up after resolved", () => {
    const summary = buildAthleteFollowUpSummary(
      [
        {
          occurred_at: "2026-07-15T10:00:00.000Z",
          follow_up_at: null,
          resultado: "resolved",
          tipo_interaccion: "phone_call",
          autor_nombre: "Admin",
        },
        {
          occurred_at: "2026-07-01T10:00:00.000Z",
          follow_up_at: "2026-07-10T10:00:00.000Z",
          resultado: "contacted",
          tipo_interaccion: "whatsapp",
        },
      ],
      now
    );
    expect(summary.followUpStatus).toBe("none");
    expect(summary.resolvedRecently).toBe(true);
    expect(summary.lastAutorNombre).toBe("Admin");
  });
});
