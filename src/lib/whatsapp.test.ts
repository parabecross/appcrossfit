import { describe, expect, it } from "vitest";
import {
  buildContextualWhatsAppMessage,
  buildWhatsAppUrl,
  formatPhoneForWhatsApp,
} from "@/lib/whatsapp";

describe("whatsapp helpers for inbox", () => {
  it("rejects invalid phones", () => {
    expect(formatPhoneForWhatsApp("123")).toBeNull();
    expect(buildWhatsAppUrl("123", "hola")).toBeNull();
  });

  it("formats mexican-length phones", () => {
    expect(formatPhoneForWhatsApp("55 1234 5678")).toBe("5512345678");
    expect(buildWhatsAppUrl("5512345678", "hola")).toContain("wa.me/5512345678");
  });

  it("builds contextual messages without inventing send logic", () => {
    expect(
      buildContextualWhatsAppMessage("inactive", "Ana Pérez", "es", "Box Uno")
    ).toContain("Box Uno");
    expect(
      buildContextualWhatsAppMessage(
        "pending_payment",
        "Ana Pérez",
        "en",
        "Box Uno"
      )
    ).toContain("membership");
    expect(
      buildContextualWhatsAppMessage("no_reservation", "Ana", "es", "Box Uno")
    ).toContain("reservado");
  });
});
