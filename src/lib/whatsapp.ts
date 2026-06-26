import { APP_CONFIG } from "@/lib/config/app-config";
import { formatDate } from "@/lib/utils";

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

export function daysUntilExpiry(fechaFin: string): number {
  const end = new Date(`${fechaFin}T23:59:59`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function isExpiringSoon(
  fechaFin: string,
  days = APP_CONFIG.ALERTA_VENCIMIENTO_DIAS
): boolean {
  const remaining = daysUntilExpiry(fechaFin);
  return remaining >= 0 && remaining <= days;
}

export function isMembershipExpired(fechaFin: string): boolean {
  return daysUntilExpiry(fechaFin) < 0;
}

export function buildRenewalReminderMessage(
  nombre: string,
  fechaFin: string,
  locale: string,
  type: "por_vencer" | "vencida",
  boxName: string = APP_CONFIG.DEFAULT_BOX_NAME
): string {
  const firstName = nombre.split(" ")[0];
  const fecha = formatDate(fechaFin, locale);

  if (type === "vencida") {
    return locale === "es"
      ? `Hola ${firstName}! 👋 Tu mensualidad en ${boxName} venció el ${fecha}. Renueva para seguir reservando clases. ¡Te extrañamos en el box! 💪`
      : `Hi ${firstName}! 👋 Your ${boxName} membership expired on ${fecha}. Renew to keep booking classes. We miss you at the box! 💪`;
  }

  return locale === "es"
    ? `Hola ${firstName}! 👋 Te recordamos que tu mensualidad en ${boxName} vence el ${fecha}. No te quedes sin entrenar — renueva a tiempo. ¡Nos vemos en el box! 💪`
    : `Hi ${firstName}! 👋 Your ${boxName} membership expires on ${fecha}. Don't miss your training — renew on time. See you at the box! 💪`;
}
