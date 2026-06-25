import type { MembresiaActual, Profile } from "@/types/database";
import { APP_CONFIG } from "@/lib/config/app-config";

export function canReserve(
  profile: Profile,
  membership: MembresiaActual | null
): { ok: boolean; reason?: "pending" | "expired" | "none" } {
  if (profile.estado_cuenta === "pendiente_pago") {
    return { ok: false, reason: "pending" };
  }
  if (!membership || membership.estado === "vencida") {
    return { ok: false, reason: membership ? "expired" : "none" };
  }
  if (membership.estado !== "vigente") {
    return { ok: false, reason: "none" };
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
  const today = new Date().toISOString().split("T")[0];
  return fechaFin < today ? "vencida" : "vigente";
}
