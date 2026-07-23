/** Paleta y estilos Athron para Excel (exceljs). */

export const ATHRON_EXCEL = {
  black: "FF111111",
  dark: "FF1A1A1A",
  gray: "FF666666",
  lightGray: "FFF3F3F3",
  white: "FFFFFFFF",
  orange: "FFE85D04",
  green: "FF2E7D32",
  yellow: "FFF9A825",
  red: "FFC62828",
  muted: "FF9E9E9E",
} as const;

export const REPORT_VERSION = "ejecutivo-xlsx-1";

export const SHEET_NAMES = {
  resumen: "Resumen ejecutivo",
  clases: "Clases",
  atletas: "Atletas",
  membresias: "Membresías",
  comparacion: "Comparación",
  meta: "Datos del reporte",
} as const;
