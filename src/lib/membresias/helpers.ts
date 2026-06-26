import type { MembresiaActual, Profile } from "@/types/database";
import { APP_CONFIG } from "@/lib/config/app-config";
import {
  daysUntilDateOnly,
  isDateBeforeToday,
  todayInTimezone,
} from "@/lib/dates/date-only";

export type SocioDisplayStatus =
  | "pendiente_pago"
  | "sin_membresia"
  | "vencida"
  | "por_vencer"
  | "activo";

export function isMembresiaVencida(
  fechaFin: string,
  timeZone?: string
): boolean {
  return isDateBeforeToday(fechaFin, todayInTimezone(timeZone));
}

/** Estado visible en admin: alinea dashboard (KPIs/alertas) y lista de usuarios. */
export function getSocioDisplayStatus(
  profile: Pick<Profile, "estado_cuenta">,
  membresia: Pick<MembresiaActual, "fecha_fin" | "estado"> | null,
  timeZone?: string
): SocioDisplayStatus {
  if (profile.estado_cuenta === "pendiente_pago") {
    return "pendiente_pago";
  }
  if (!membresia || membresia.estado === "cancelada") {
    return "sin_membresia";
  }
  if (isMembresiaVencida(membresia.fecha_fin, timeZone)) {
    return "vencida";
  }
  if (isExpiringSoon(membresia.fecha_fin, timeZone)) {
    return "por_vencer";
  }
  return "activo";
}

export function socioDisplayStatusBadgeVariant(
  status: SocioDisplayStatus
): "success" | "warning" | "destructive" {
  switch (status) {
    case "activo":
      return "success";
    case "por_vencer":
    case "pendiente_pago":
      return "warning";
    default:
      return "destructive";
  }
}

export function canReserve(
  profile: Profile,
  membership: MembresiaActual | null,
  timeZone?: string
): { ok: boolean; reason?: "pending" | "expired" | "none" } {
  if (profile.estado_cuenta === "pendiente_pago") {
    return { ok: false, reason: "pending" };
  }
  if (!membership) {
    return { ok: false, reason: "none" };
  }
  if (membership.estado === "cancelada") {
    return { ok: false, reason: "none" };
  }

  if (isMembresiaVencida(membership.fecha_fin, timeZone)) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true };
}

export function isExpiringSoon(
  fechaFin: string,
  timeZone?: string
): boolean {
  const days = daysUntilDateOnly(fechaFin, todayInTimezone(timeZone));
  return days >= 0 && days <= APP_CONFIG.ALERTA_VENCIMIENTO_DIAS;
}

export function computeFechaFin(fechaInicio: string, duracionDias: number): string {
  const d = new Date(`${fechaInicio}T12:00:00`);
  d.setDate(d.getDate() + duracionDias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function syncMembresiaEstadoLocal(
  fechaFin: string,
  estado: string,
  timeZone?: string
): "vigente" | "vencida" | "cancelada" {
  if (estado === "cancelada") return "cancelada";
  return isMembresiaVencida(fechaFin, timeZone) ? "vencida" : "vigente";
}
