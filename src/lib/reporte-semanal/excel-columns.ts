export const CLASS_COLUMNS = [
  "Fecha",
  "Hora",
  "Nombre de clase",
  "Coach",
  "Estado",
  "Capacidad",
  "Reservas",
  "Asistencias",
  "No asistencias",
  "Cancelaciones",
  "Lugares ocupados",
  "Ocupación %",
  "Indicador",
] as const;

export const ATHLETE_COLUMNS = [
  "Atleta",
  "Categoría",
  "Asistencias en el periodo",
  "Última asistencia",
  "Días sin asistir",
  "Fecha de alta",
  "Membresía",
  "Estado de membresía",
] as const;

export const MEMBERSHIP_COLUMNS = [
  "Atleta",
  "Membresía",
  "Estado",
  "Fecha de inicio",
  "Fecha de vencimiento",
  "Días restantes",
  "Categoría",
] as const;

export const COMPARISON_COLUMNS = [
  "Métrica",
  "Periodo actual",
  "Periodo anterior",
  "Diferencia absoluta",
  "Variación porcentual",
  "Tendencia",
] as const;

export const METRIC_DEFINITIONS: Array<{ metric: string; definition: string }> =
  [
    {
      metric: "Reserva",
      definition:
        "Reservas con estado confirmada, asistio o no_asistio en clases del periodo.",
    },
    {
      metric: "Asistencia",
      definition: "Reservas con estado asistio.",
    },
    {
      metric: "Cancelación",
      definition: "Reservas con estado cancelada vinculadas a clases del periodo.",
    },
    {
      metric: "Clase impartida",
      definition:
        "Clase programada (no cancelada) cuya fecha/hora_fin ya terminó en la timezone del box dentro del periodo.",
    },
    {
      metric: "Atleta activo",
      definition:
        "Socio con estado visible activo o por_vencer según membresía y cuenta.",
    },
    {
      metric: "Nuevo atleta",
      definition:
        "Perfil socio cuyo created_at (día en timezone del box) cae dentro del periodo.",
    },
    {
      metric: "Membresía activa",
      definition: "Display activo o por_vencer (incluye vigentes no vencidas).",
    },
    {
      metric: "Por vencer",
      definition:
        "Membresía vigente cuya fecha_fin cae dentro de la ventana de alerta del box.",
    },
    {
      metric: "Vencida",
      definition: "Membresía con fecha_fin anterior al día actual del box.",
    },
    {
      metric: "PR",
      definition:
        "Registros en atleta_pr_marcas con fecha (date-only) dentro del periodo.",
    },
    {
      metric: "Ocupación",
      definition:
        "Promedio de cupo_ocupado/cupo_maximo en clases impartidas con cupo_maximo > 0.",
    },
    {
      metric: "Atleta sin asistencia reciente",
      definition:
        "Atleta activo con al menos una asistencia histórica y última asistencia hace 10 o más días.",
    },
  ];
