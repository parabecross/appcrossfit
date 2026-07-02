/** Credenciales y marcadores de los boxes demo Parabellum + Iron District. */

export const DEMO_PASSWORD = "Athron2026!";

export const PARABELLUM_SLUG = "parabellum-cross";
export const IRON_SLUG = "iron-district-box";

export type DemoBoxKey = "parabellum" | "iron";

export const DEMO_BOXES = {
  parabellum: {
    slug: PARABELLUM_SLUG,
    name: "Parabellum Cross",
    adminEmail: "parabellum.admin@athron.test",
    coachEmail: "parabellum.coach1@athron.test",
    socioEmail: "parabellum.socio1@athron.test",
    adminNombre: "Roberto Mendoza",
    socioNombre: "Lucía Herrera",
    /** Subcadena en nombres de clase demo (reset-two-demo-boxes). */
    classMarker: "Parabellum",
    /** Marcador de clases del otro box (no deben aparecer). */
    foreignClassMarker: " Iron",
    foreignAdminNombre: "Carolina Navarro",
    foreignSocioNombre: "Emilio Vargas",
  },
  iron: {
    slug: IRON_SLUG,
    name: "Iron District Box",
    adminEmail: "iron.admin@athron.test",
    coachEmail: "iron.coach1@athron.test",
    socioEmail: "iron.socio1@athron.test",
    adminNombre: "Carolina Navarro",
    socioNombre: "Emilio Vargas",
    classMarker: " Iron",
    foreignClassMarker: "Parabellum",
    foreignAdminNombre: "Roberto Mendoza",
    foreignSocioNombre: "Lucía Herrera",
  },
} as const;
