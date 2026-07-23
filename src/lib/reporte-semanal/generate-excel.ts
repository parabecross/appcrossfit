import "server-only";

import ExcelJS from "exceljs";
import {
  ATHLETE_COLUMNS,
  CLASS_COLUMNS,
  COMPARISON_COLUMNS,
  MEMBERSHIP_COLUMNS,
  METRIC_DEFINITIONS,
} from "./excel-columns";
import type { ExcelWorkbookModel } from "./excel-data";
import { ATHRON_EXCEL, REPORT_VERSION, SHEET_NAMES } from "./excel-styles";

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: ATHRON_EXCEL.white }, size: 11 };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ATHRON_EXCEL.dark },
  };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 22;
}

function applyAutofilter(sheet: ExcelJS.Worksheet, colCount: number) {
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: colCount },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function writeKpi(
  sheet: ExcelJS.Worksheet,
  row: number,
  label: string,
  value: string | number | null,
  opts?: { numFmt?: string }
) {
  sheet.getCell(row, 1).value = label;
  sheet.getCell(row, 1).font = { color: { argb: ATHRON_EXCEL.gray } };
  sheet.getCell(row, 2).value = value === null ? "Sin datos" : value;
  sheet.getCell(row, 2).font = { bold: true, color: { argb: ATHRON_EXCEL.black } };
  if (opts?.numFmt && value !== null && typeof value === "number") {
    sheet.getCell(row, 2).numFmt = opts.numFmt;
  }
}

function occupancyFill(indicador: string): string | null {
  switch (indicador) {
    case "Alta ocupación":
      return ATHRON_EXCEL.green;
    case "Ocupación media":
      return ATHRON_EXCEL.yellow;
    case "Baja ocupación":
      return ATHRON_EXCEL.red;
    case "Sin capacidad configurada":
      return ATHRON_EXCEL.muted;
    default:
      return null;
  }
}

function membershipFill(categoria: string): string | null {
  switch (categoria) {
    case "Activa":
      return ATHRON_EXCEL.green;
    case "Por vencer":
      return ATHRON_EXCEL.orange;
    case "Vencida":
      return ATHRON_EXCEL.red;
    case "Cancelada":
      return ATHRON_EXCEL.muted;
    default:
      return null;
  }
}

function parseDateOnly(value: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Genera un .xlsx en memoria a partir del modelo Excel ya calculado.
 */
export async function generateExecutiveReportExcel(
  model: ExcelWorkbookModel
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ATHRON";
  wb.created = new Date();
  wb.modified = new Date();

  // ── Resumen ejecutivo ──
  const resumen = wb.addWorksheet(SHEET_NAMES.resumen, {
    properties: { defaultRowHeight: 18 },
  });
  resumen.getColumn(1).width = 36;
  resumen.getColumn(2).width = 42;

  resumen.mergeCells("A1:B1");
  resumen.getCell("A1").value = "ATHRON";
  resumen.getCell("A1").font = {
    bold: true,
    size: 18,
    color: { argb: ATHRON_EXCEL.white },
  };
  resumen.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: ATHRON_EXCEL.black },
  };
  resumen.getRow(1).height = 28;

  resumen.getCell("A2").value = model.boxName;
  resumen.getCell("A2").font = {
    bold: true,
    size: 12,
    color: { argb: ATHRON_EXCEL.orange },
  };
  resumen.getCell("A3").value = "Reporte ejecutivo";
  resumen.getCell("A3").font = { bold: true, size: 14 };

  const headerMeta: Array<[string, string]> = [
    ["Periodo seleccionado", model.weekLabel],
    ["Periodo de comparación", model.previousWeekLabel],
    ["Fecha de generación", model.generatedAtLabel],
    ["Timezone", model.timezone],
  ];
  let r = 5;
  for (const [k, v] of headerMeta) {
    resumen.getCell(r, 1).value = k;
    resumen.getCell(r, 1).font = { color: { argb: ATHRON_EXCEL.gray } };
    resumen.getCell(r, 2).value = v;
    r += 1;
  }

  r += 1;
  resumen.getCell(r, 1).value = "Indicadores clave";
  resumen.getCell(r, 1).font = {
    bold: true,
    size: 12,
    color: { argb: ATHRON_EXCEL.orange },
  };
  r += 1;

  const m = model.metrics;
  const kpis: Array<[string, string | number | null, string?]> = [
    ["Atletas únicos con asistencia", m.uniqueAthletesAttended],
    ["Clases impartidas", m.classesHeld],
    ["Total de reservas", m.totalReservations],
    ["Asistencias confirmadas", m.totalAttendances],
    ["Cancelaciones", m.totalCancellations],
    [
      "Ocupación promedio",
      m.avgOccupancyPct === null ? null : m.avgOccupancyPct / 100,
      "0%",
    ],
    ["Nuevos atletas", m.newAthletes],
    ["Membresías activas", m.membershipsActive],
    ["Membresías por vencer", m.membershipsExpiringSoon],
    ["Membresías vencidas", m.membershipsExpired],
    ["PRs registrados", m.prsRegistered],
  ];
  for (const [label, value, numFmt] of kpis) {
    writeKpi(resumen, r, label, value, numFmt ? { numFmt } : undefined);
    r += 1;
  }

  r += 1;
  resumen.getCell(r, 1).value = "Resumen automático";
  resumen.getCell(r, 1).font = {
    bold: true,
    size: 12,
    color: { argb: ATHRON_EXCEL.orange },
  };
  r += 1;
  resumen.mergeCells(r, 1, r + 2, 2);
  resumen.getCell(r, 1).value = m.narrative || "Sin datos";
  resumen.getCell(r, 1).alignment = { wrapText: true, vertical: "top" };
  r += 4;

  resumen.getCell(r, 1).value = "Alertas";
  resumen.getCell(r, 1).font = {
    bold: true,
    size: 12,
    color: { argb: ATHRON_EXCEL.orange },
  };
  r += 1;
  if (model.alerts.length === 0) {
    resumen.getCell(r, 1).value = "Sin alertas relevantes en el periodo.";
    resumen.getCell(r, 1).font = { italic: true, color: { argb: ATHRON_EXCEL.gray } };
  } else {
    for (const alert of model.alerts) {
      resumen.getCell(r, 1).value = `• ${alert}`;
      r += 1;
    }
  }

  // ── Clases ──
  const clases = wb.addWorksheet(SHEET_NAMES.clases);
  clases.addRow([...CLASS_COLUMNS]);
  styleHeaderRow(clases.getRow(1));
  applyAutofilter(clases, CLASS_COLUMNS.length);
  const classWidths = [12, 8, 28, 18, 12, 10, 10, 12, 14, 12, 14, 12, 22];
  classWidths.forEach((w, i) => {
    clases.getColumn(i + 1).width = w;
  });

  for (const row of model.classRows) {
    const excelRow = clases.addRow([
      parseDateOnly(row.fecha),
      row.hora,
      row.nombre,
      row.coach,
      row.estado,
      row.capacidad,
      row.reservas,
      row.asistencias,
      row.noAsistencias,
      row.cancelaciones,
      row.lugaresOcupados,
      row.ocupacionPct,
      row.indicador,
    ]);
    excelRow.getCell(1).numFmt = "yyyy-mm-dd";
    excelRow.getCell(12).numFmt = "0%";
    const fill = occupancyFill(row.indicador);
    if (fill) {
      excelRow.getCell(13).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fill },
      };
      const darkText =
        fill === ATHRON_EXCEL.yellow || fill === ATHRON_EXCEL.muted;
      excelRow.getCell(13).font = {
        color: { argb: darkText ? ATHRON_EXCEL.black : ATHRON_EXCEL.white },
        bold: true,
      };
    }
  }

  // ── Atletas ──
  const atletas = wb.addWorksheet(SHEET_NAMES.atletas);
  atletas.addRow([...ATHLETE_COLUMNS]);
  styleHeaderRow(atletas.getRow(1));
  applyAutofilter(atletas, ATHLETE_COLUMNS.length);
  [28, 22, 14, 14, 12, 14, 18, 16].forEach((w, i) => {
    atletas.getColumn(i + 1).width = w;
  });
  for (const row of model.athleteRows) {
    const excelRow = atletas.addRow([
      row.atleta,
      row.categoria,
      row.asistencias,
      parseDateOnly(row.ultimaAsistencia),
      row.diasSinAsistir,
      parseDateOnly(row.fechaAlta),
      row.membresia,
      row.estadoMembresia,
    ]);
    excelRow.getCell(4).numFmt = "yyyy-mm-dd";
    excelRow.getCell(6).numFmt = "yyyy-mm-dd";
  }

  // ── Membresías ──
  const memb = wb.addWorksheet(SHEET_NAMES.membresias);
  memb.addRow([...MEMBERSHIP_COLUMNS]);
  styleHeaderRow(memb.getRow(1));
  applyAutofilter(memb, MEMBERSHIP_COLUMNS.length);
  [28, 18, 12, 14, 16, 12, 14].forEach((w, i) => {
    memb.getColumn(i + 1).width = w;
  });
  for (const row of model.membershipRows) {
    const excelRow = memb.addRow([
      row.atleta,
      row.membresia,
      row.estado,
      parseDateOnly(row.fechaInicio),
      parseDateOnly(row.fechaVencimiento),
      row.diasRestantes,
      row.categoria,
    ]);
    excelRow.getCell(4).numFmt = "yyyy-mm-dd";
    excelRow.getCell(5).numFmt = "yyyy-mm-dd";
    const fill = membershipFill(row.categoria);
    if (fill) {
      excelRow.getCell(7).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: fill },
      };
      const darkText =
        fill === ATHRON_EXCEL.orange || fill === ATHRON_EXCEL.muted;
      excelRow.getCell(7).font = {
        color: { argb: darkText ? ATHRON_EXCEL.black : ATHRON_EXCEL.white },
        bold: true,
      };
    }
  }

  // ── Comparación ──
  const cmp = wb.addWorksheet(SHEET_NAMES.comparacion);
  cmp.addRow([...COMPARISON_COLUMNS]);
  styleHeaderRow(cmp.getRow(1));
  applyAutofilter(cmp, COMPARISON_COLUMNS.length);
  [32, 14, 14, 14, 16, 22].forEach((w, i) => {
    cmp.getColumn(i + 1).width = w;
  });
  for (const row of model.comparisonRows) {
    const isOcc = row.metrica.includes("Ocupación");
    const excelRow = cmp.addRow([
      row.metrica,
      isOcc && row.actual !== null ? row.actual / 100 : row.actual,
      isOcc && row.anterior !== null ? row.anterior / 100 : row.anterior,
      isOcc && row.diferencia !== null ? row.diferencia / 100 : row.diferencia,
      row.variacionPct,
      row.tendencia,
    ]);
    if (isOcc) {
      excelRow.getCell(2).numFmt = "0%";
      excelRow.getCell(3).numFmt = "0%";
      excelRow.getCell(4).numFmt = "0.0%";
    }
    excelRow.getCell(5).numFmt = "0.0%";
  }

  // ── Datos del reporte ──
  const meta = wb.addWorksheet(SHEET_NAMES.meta);
  meta.getColumn(1).width = 28;
  meta.getColumn(2).width = 70;
  meta.getCell("A1").value = "Metadatos";
  meta.getCell("A1").font = {
    bold: true,
    size: 12,
    color: { argb: ATHRON_EXCEL.orange },
  };
  const metaRows: Array<[string, string]> = [
    ["Box", model.boxName],
    ["ID del box", model.boxId],
    ["Timezone", model.timezone],
    ["Fecha desde", model.week.from],
    ["Fecha hasta", model.week.to],
    ["Periodo anterior desde", model.previousWeek.from],
    ["Periodo anterior hasta", model.previousWeek.to],
    ["Fecha de generación", model.generatedAtLabel],
    ["Versión del reporte", REPORT_VERSION],
  ];
  let mr = 3;
  for (const [k, v] of metaRows) {
    meta.getCell(mr, 1).value = k;
    meta.getCell(mr, 1).font = { bold: true };
    meta.getCell(mr, 2).value = v;
    mr += 1;
  }
  mr += 1;
  meta.getCell(mr, 1).value = "Definiciones";
  meta.getCell(mr, 1).font = {
    bold: true,
    size: 12,
    color: { argb: ATHRON_EXCEL.orange },
  };
  mr += 1;
  meta.getCell(mr, 1).value = "Métrica";
  meta.getCell(mr, 2).value = "Definición";
  styleHeaderRow(meta.getRow(mr));
  mr += 1;
  for (const def of METRIC_DEFINITIONS) {
    meta.getCell(mr, 1).value = def.metric;
    meta.getCell(mr, 2).value = def.definition;
    meta.getCell(mr, 2).alignment = { wrapText: true };
    mr += 1;
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export function buildExecutiveExcelFilename(from: string, to: string): string {
  return `athron-reporte-ejecutivo-${from}-al-${to}.xlsx`;
}

export const EXECUTIVE_EXCEL_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function assertExcelBufferLooksValid(buf: Buffer): boolean {
  // XLSX is a ZIP: starts with PK
  return buf.length > 100 && buf[0] === 0x50 && buf[1] === 0x4b;
}

export function excelContainsPrivateSecrets(buf: Buffer): boolean {
  const text = buf.toString("utf8");
  return (
    text.includes("SUPABASE_SERVICE_ROLE_KEY") ||
    /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(text)
  );
}
