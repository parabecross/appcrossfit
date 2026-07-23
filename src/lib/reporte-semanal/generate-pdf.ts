import PDFDocument from "pdfkit";
import { formatComparisonLabel } from "./compare";
import type { WeeklyReportModel } from "./types";

const MARGIN = 48;
const PAGE_WIDTH = 595.28; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.8);
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#111111")
    .text(title, { continued: false });
  doc
    .moveTo(MARGIN, doc.y + 2)
    .lineTo(MARGIN + CONTENT_WIDTH, doc.y + 2)
    .strokeColor("#E5E5E5")
    .stroke();
  doc.moveDown(0.6);
  doc.fillColor("#222222").font("Helvetica").fontSize(10);
}

function kv(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  indent = 0
) {
  const x = MARGIN + indent;
  doc.font("Helvetica").fontSize(10).fillColor("#444444").text(label, x, doc.y, {
    width: CONTENT_WIDTH * 0.62,
    continued: false,
  });
  const y = doc.y - 12;
  doc
    .font("Helvetica-Bold")
    .fillColor("#111111")
    .text(value, x + CONTENT_WIDTH * 0.62, y, {
      width: CONTENT_WIDTH * 0.38,
      align: "right",
    });
  doc.moveDown(0.15);
}

function ensureSpace(doc: PDFKit.PDFDocument, needed = 80) {
  if (doc.y + needed > doc.page.height - MARGIN) {
    doc.addPage();
  }
}

function listOrEmpty(
  doc: PDFKit.PDFDocument,
  items: string[],
  empty = "Sin datos"
) {
  if (items.length === 0) {
    doc.font("Helvetica-Oblique").fillColor("#777777").text(empty);
    doc.fillColor("#222222").font("Helvetica");
    return;
  }
  for (const item of items) {
    ensureSpace(doc, 24);
    doc.font("Helvetica").fillColor("#222222").text(`• ${item}`, {
      width: CONTENT_WIDTH,
    });
  }
}

/**
 * Genera un PDF A4 en memoria a partir del modelo final.
 * No consulta la base de datos.
 */
export async function generateWeeklyReportPdf(
  model: WeeklyReportModel
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: {
        Title: `${model.title} — ${model.boxName}`,
        Author: "ATHRON",
        Subject: model.weekLabel,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor("#111111")
      .text("ATHRON", { continued: false });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#666666")
      .text(model.boxName);
    doc.moveDown(0.4);
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("#111111")
      .text(model.title);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#444444")
      .text(`Periodo: ${model.weekLabel}`);
    doc.text(`Comparación: ${model.previousWeekLabel}`);
    doc.text(`Generado: ${model.generatedAtLabel} (${model.timezone})`);

    const m = model.metrics;

    drawSectionTitle(doc, "Resumen del periodo");
    kv(doc, "Atletas únicos con asistencia", String(m.uniqueAthletesAttended));
    kv(doc, "Clases impartidas", String(m.classesHeld));
    kv(doc, "Total de reservas", String(m.totalReservations));
    kv(doc, "Asistencias confirmadas", String(m.totalAttendances));
    kv(doc, "Cancelaciones", String(m.totalCancellations));
    kv(
      doc,
      "Ocupación promedio",
      m.avgOccupancyPct === null ? "Sin datos" : `${m.avgOccupancyPct}%`
    );
    kv(doc, "Nuevos atletas", String(m.newAthletes));
    kv(doc, "Membresías activas", String(m.membershipsActive));
    kv(doc, "Membresías por vencer", String(m.membershipsExpiringSoon));
    kv(doc, "Membresías vencidas", String(m.membershipsExpired));
    kv(doc, "PRs registrados", String(m.prsRegistered));

    ensureSpace(doc, 120);
    drawSectionTitle(doc, "Operación de clases");
    kv(
      doc,
      "Promedio de asistentes por clase",
      m.avgAttendeesPerClass === null
        ? "Sin datos"
        : String(m.avgAttendeesPerClass)
    );
    kv(doc, "Capacidad ofrecida", String(m.capacityOffered));
    kv(doc, "Lugares ocupados", String(m.capacityOccupied));

    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").text("Mayor ocupación");
    listOrEmpty(
      doc,
      m.topOccupiedClasses.map(
        (c) =>
          `${c.label} — ${c.occupancyPct ?? 0}% (${c.cupoOcupado}/${c.cupoMaximo})`
      )
    );
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").text("Menor ocupación");
    listOrEmpty(
      doc,
      m.lowestOccupiedClasses.map(
        (c) =>
          `${c.label} — ${c.occupancyPct ?? 0}% (${c.cupoOcupado}/${c.cupoMaximo})`
      )
    );
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").text("Más cancelaciones");
    listOrEmpty(
      doc,
      m.mostCancelledClasses.map(
        (c) => `${c.label} — ${c.cancellations} cancelaciones`
      )
    );

    ensureSpace(doc, 120);
    drawSectionTitle(doc, "Atletas");
    doc.font("Helvetica-Bold").text("Más constantes");
    listOrEmpty(
      doc,
      m.topConstantAthletes.map(
        (a) => `${a.nombre} — ${a.attendances} asistencias`
      )
    );
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").text("Sin asistencia reciente (≥10 días)");
    listOrEmpty(
      doc,
      m.inactiveAthletes.map(
        (a) => `${a.nombre} — ${a.daysSinceAttendance} días`
      )
    );
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").text("Membresía próxima a vencer");
    listOrEmpty(
      doc,
      m.expiringAthletes.map((a) => a.nombre)
    );
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").text("Nuevos atletas");
    listOrEmpty(
      doc,
      m.newAthleteNames.map((a) => a.nombre)
    );

    ensureSpace(doc, 140);
    drawSectionTitle(doc, "Comparación vs periodo anterior");
    const cmp = m.comparison;
    kv(
      doc,
      "Atletas activos (únicos)",
      formatComparisonLabel(cmp.uniqueAthletesAttended)
    );
    kv(doc, "Asistencias", formatComparisonLabel(cmp.totalAttendances));
    kv(doc, "Reservas", formatComparisonLabel(cmp.totalReservations));
    kv(doc, "Cancelaciones", formatComparisonLabel(cmp.totalCancellations));
    kv(doc, "Ocupación promedio", formatComparisonLabel(cmp.avgOccupancyPct));
    kv(doc, "Nuevos atletas", formatComparisonLabel(cmp.newAthletes));

    ensureSpace(doc, 100);
    drawSectionTitle(doc, "Resumen automático");
    doc
      .font("Helvetica")
      .fillColor("#222222")
      .text(m.narrative || "Sin datos", {
        width: CONTENT_WIDTH,
        align: "left",
      });

    doc.moveDown(1.5);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#999999")
      .text(
        "Reporte generado por ATHRON. Solo lectura. Aislado al box autenticado.",
        { align: "center" }
      );

    doc.end();
  });
}
