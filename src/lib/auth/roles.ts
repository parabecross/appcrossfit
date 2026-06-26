import type { UserRole } from "@/types/database";

export function isAdminLikeRole(rol: UserRole): boolean {
  return rol === "admin" || rol === "box_admin";
}

export function canAccessAdminArea(rol: UserRole): boolean {
  return isAdminLikeRole(rol) || rol === "coach";
}
