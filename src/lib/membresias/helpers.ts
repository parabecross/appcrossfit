import type { MembresiaActual, Profile } from "@/types/database";
import { APP_CONFIG } from "@/lib/config/app-config";

export type SocioDisplayStatus =
  | "pendiente_pago"
  | "sin_membresia"
  | "vencida"
  | "por_vencer"
  | "activo";

export function todayDateOnly(): string {
  return new Date().toISOString().split("T")[0];
}

export function isMembresiaVencida(
  fechaFin: string,
  today: string = todayDateOnly()
): boolean {
  return fechaFin < today;
}

/** Estado visible en admin: alinea dashboard (KPIs/alertas) y lista de usuarios. */
export function getSocioDisplayStatus(
  profile: Pick<Profile, "estado_cuenta">,
  membresia: Pick<MembresiaActual, "fecha_fin" | "estado"> | null
): SocioDisplayStatus {
  if (profile.estado_cuenta === "pendiente_pago") {
    return "pendiente_pago";
  }
  if (!membresia || membresia.estado === "cancelada") {
    return "sin_membresia";
  }
  if (isMembresiaVencida(membresia.fecha_fin)) {
    return "vencida";
  }
  if (isExpiringSoon(membresia.fecha_fin)) {
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
  membership: MembresiaActual | null
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

  if (isMembresiaVencida(membership.fecha_fin)) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true };
}

export function isExpiringSoon(fechaFin: string): boolean {
  const fin = new Date(fechaFin);
  const limit = new Date();
  limit.setDate(limit.getDate() + APP_CONFIG.ALERTA_VENCIMIENTO_DIAS);
  return fin <= limit && fin >= new Date();
}

export function computeFechaFin(fechaInicio: string, duracionDias: number): string {
  const d = new Date(fechaInicio);
  d.setDate(d.getDate() + duracionDias);
  return d.toISOString().split("T")[0];
}

export function syncMembresiaEstadoLocal(
  fechaFin: string,
  estado: string
): "vigente" | "vencida" | "cancelada" {
  if (estado === "cancelada") return "cancelada";
  return isMembresiaVencida(fechaFin) ? "vencida" : "vigente";
}
