export const APP_CONFIG = {
  /** Horas antes de la clase para permitir cancelación */
  CANCELACION_HORAS: 2,
  /** Minutos antes del inicio en que se cierra la reserva */
  RESERVA_CIERRE_MINUTOS: 20,
  /** Cupo default al crear clases */
  CUPO_DEFAULT: 12,
  /** Días de alerta antes del vencimiento */
  ALERTA_VENCIMIENTO_DIAS: 3,
  /** Semanas en gráfica de tendencia */
  TENDENCIA_SEMANAS: 8,
  /** Nombre de marca (UI only — no hardcodear en lógica de negocio) */
  BRAND_NAME: "Parabellum Cross",
} as const;
