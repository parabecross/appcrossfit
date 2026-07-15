import { APP_CONFIG } from "@/lib/config/app-config";
import {
  daysUntilDateOnly,
  isDateBeforeToday,
  todayInTimezone,
} from "@/lib/dates/date-only";
export function formatPhoneForWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits;
}

export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message: string
): string | null {
  const formatted = formatPhoneForWhatsApp(phone);
  if (!formatted) return null;
  return `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
}

export function daysUntilExpiry(
  fechaFin: string,
  timeZone?: string
): number {
  return daysUntilDateOnly(fechaFin, todayInTimezone(timeZone));
}

export function isExpiringSoon(
  fechaFin: string,
  days = APP_CONFIG.ALERTA_VENCIMIENTO_DIAS,
  timeZone?: string
): boolean {
  const remaining = daysUntilExpiry(fechaFin, timeZone);
  return remaining >= 0 && remaining <= days;
}

export function isMembershipExpired(
  fechaFin: string,
  timeZone?: string
): boolean {
  return isDateBeforeToday(fechaFin, todayInTimezone(timeZone));
}

export function buildRenewalReminderMessage(
  nombre: string,
  fechaFin: string,
  locale: string,
  type: "por_vencer" | "vencida",
  boxName: string = APP_CONFIG.DEFAULT_BOX_NAME
): string {
  const firstName = nombre.split(" ")[0];
  void fechaFin;

  if (type === "vencida") {
    return locale === "es"
      ? `Hola, ${firstName}. Tu membresía de ${boxName} venció recientemente. Escríbenos y con gusto te ayudamos a renovarla para que continúes entrenando.`
      : `Hi, ${firstName}. Your ${boxName} membership recently expired. Message us and we'll gladly help you renew so you can keep training.`;
  }

  return locale === "es"
    ? `Hola, ${firstName}. Te recordamos que tu membresía de ${boxName} está próxima a vencer. Escríbenos para ayudarte con tu renovación.`
    : `Hi, ${firstName}. Reminder that your ${boxName} membership is about to expire. Message us and we'll help with your renewal.`;
}

export function buildInactiveAthleteMessage(
  nombre: string,
  locale: string,
  boxName: string = APP_CONFIG.DEFAULT_BOX_NAME
): string {
  const firstName = nombre.split(" ")[0];
  return locale === "es"
    ? `Hola, ${firstName}. Te extrañamos en ${boxName}. Vimos que llevas algunos días sin entrenar y queríamos saber cómo estás. Cuando estés listo, aquí te esperamos.`
    : `Hi, ${firstName}. We miss you at ${boxName}. We noticed you haven't trained in a few days and wanted to check in. Whenever you're ready, we're here for you.`;
}

export function buildPendingPaymentMessage(
  nombre: string,
  locale: string,
  boxName: string = APP_CONFIG.DEFAULT_BOX_NAME
): string {
  const firstName = nombre.split(" ")[0];
  return locale === "es"
    ? `Hola, ${firstName}. Te escribimos de ${boxName} para ayudarte a regularizar el estado de tu membresía. Cuando puedas, escríbenos y con gusto te orientamos.`
    : `Hi, ${firstName}. We're reaching out from ${boxName} to help you sort out your membership status. Message us whenever you can and we'll gladly guide you.`;
}

export function buildNoReservationMessage(
  nombre: string,
  locale: string,
  boxName: string = APP_CONFIG.DEFAULT_BOX_NAME
): string {
  const firstName = nombre.split(" ")[0];
  return locale === "es"
    ? `Hola, ${firstName}. En ${boxName} todavía no te vemos reservado esta semana. Si quieres, te ayudamos a agendar tu próxima clase.`
    : `Hi, ${firstName}. We haven't seen a booking from you at ${boxName} this week. If you'd like, we can help you schedule your next class.`;
}

export function buildGeneralFollowUpMessage(
  nombre: string,
  locale: string,
  boxName: string = APP_CONFIG.DEFAULT_BOX_NAME
): string {
  const firstName = nombre.split(" ")[0];
  return locale === "es"
    ? `Hola, ${firstName}. Te saludamos de ${boxName}. Queríamos dar seguimiento y saber cómo te podemos apoyar.`
    : `Hi, ${firstName}. Greetings from ${boxName}. We wanted to follow up and see how we can support you.`;
}

export type WhatsAppMessageType =
  | "por_vencer"
  | "vencida"
  | "inactive"
  | "pending_payment"
  | "no_reservation"
  | "general";

export function buildContextualWhatsAppMessage(
  type: WhatsAppMessageType,
  nombre: string,
  locale: string,
  boxName?: string,
  fechaFin?: string | null
): string {
  switch (type) {
    case "vencida":
    case "por_vencer":
      return buildRenewalReminderMessage(
        nombre,
        fechaFin ?? "",
        locale,
        type,
        boxName
      );
    case "inactive":
      return buildInactiveAthleteMessage(nombre, locale, boxName);
    case "pending_payment":
      return buildPendingPaymentMessage(nombre, locale, boxName);
    case "no_reservation":
      return buildNoReservationMessage(nombre, locale, boxName);
    default:
      return buildGeneralFollowUpMessage(nombre, locale, boxName);
  }
}
