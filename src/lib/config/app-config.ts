export const APP_CONFIG = {
  /** Horas antes de la clase para permitir cancelación */
  CANCELACION_HORAS: 2,
  /** Minutos antes del inicio en que se cierra la reserva */
  RESERVA_CIERRE_MINUTOS: 20,
  /** Cupo default al crear clases */
  CUPO_DEFAULT: 12,
  /** Días de alerta antes del vencimiento */
  ALERTA_VENCIMIENTO_DIAS: 3,
  /** Días hacia adelante que ve el socio al reservar (mín. 4 días con clases) */
  SOCIO_CLASES_HORIZON_DIAS: 14,
  /** Semanas en gráfica de tendencia */
  TENDENCIA_SEMANAS: 8,
  /** Zona horaria del gym (fallback; Fase 3: por box) */
  GYM_TIMEZONE: "America/Mexico_City",
  /** Marca de la plataforma */
  BRAND_NAME: "ATHRON",
  /** Primer box / fallback multi-tenant */
  DEFAULT_BOX_NAME: "Parabellum Cross",
  DEFAULT_BOX_SLUG: "parabellum-cross",
} as const;
