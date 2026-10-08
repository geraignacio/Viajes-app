import "server-only";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { TripDashboard } from "@/lib/trips";
import { CATEGORY_LABEL, SPLIT_LABEL } from "@/lib/constants";
import { formatDate, formatMoney, toMajor } from "@/lib/money";

type Section = { title: string; head: string[]; rows: (string | number)[][] };

/** Mismo contenido para CSV y PDF: gastos, abonos, saldos y liquidación. */
function buildSections(data: TripDashboard, forCsv: boolean): Section[] {
  const { trip, expenses, transfers, balances, settlement } = data;
  const name = new Map(trip.members.map((m) => [m.id, m.displayName]));
  // En CSV se exportan números sin formato (aptos para planillas).
  const money = (n: number) => (forCsv ? toMajor(n, trip.currency) : formatMoney(n, trip.currency));
  const date = (d: Date) => (forCsv ? d.toISOString().slice(0, 10) : formatDate(d));

  return [
    {
      title: "Gastos",
      head: ["Fecha", "Descripción", "Categoría", "Monto", "Pagado por", "División", "Comprobante"],
      rows: expenses.map((e) => [
        date(e.date),
        e.title,
        CATEGORY_LABEL[e.category],
        money(e.amount),
        e.payers.map((p) => `${name.get(p.memberId)} (${formatMoney(p.amount, trip.currency)})`).join(", "),
        `${SPLIT_LABEL[e.splitType]}: ${e.splits
          .map((s) => `${name.get(s.memberId)} ${formatMoney(s.amount, trip.currency)}`)
          .join(", ")}`,
        [e.receiptNote, e.receiptUrl].filter(Boolean).join(" "),
      ]),
    },
    {
      title: "Abonos",
      head: ["Fecha", "De", "A", "Monto", "Nota"],
      rows: transfers.map((t) => [
        date(t.date),
        name.get(t.fromMemberId) ?? "",
        name.get(t.toMemberId) ?? "",
        money(t.amount),
        t.note ?? "",
      ]),
    },
    {
      title: "Saldos por persona",
      head: ["Integrante", "Pagó", "Cuota asignada", "Abonado", "Restante por pagar", "Saldo"],
      rows: balances.map((b) => [
        name.get(b.memberId) ?? "",
        money(b.paid),
        money(b.share),
        money(b.covered),
        money(b.remaining),
        money(b.balance),
      ]),
    },
    {
      title: "Cierre de cuentas",
      head: ["Quién paga", "A quién", "Monto"],
      rows: settlement.map((s) => [name.get(s.from) ?? "", name.get(s.to) ?? "", money(s.amount)]),
    },
  ];
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV con ";" y BOM UTF-8: Excel en español lo abre en columnas y con tildes. */
export function buildCsv(data: TripDashboard): string {
  const lines: string[] = [csvCell(`${data.trip.name} (${data.trip.currency})`), ""];
  for (const s of buildSections(data, true)) {
    lines.push(csvCell(s.title), s.head.map(csvCell).join(";"));
    for (const r of s.rows) lines.push(r.map(csvCell).join(";"));
    lines.push("");
  }
  return "﻿" + lines.join("\r\n");
}

export function buildPdf(data: TripDashboard): ArrayBuffer {
  const { trip, totalSpent } = data;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(18);
  doc.text(trip.name, 40, 50);
  doc.setFontSize(10);
  doc.setTextColor(110);
  const range = trip.startDate ? `${formatDate(trip.startDate)}${trip.endDate ? ` – ${formatDate(trip.endDate)}` : ""} · ` : "";
  doc.text(`${range}Gasto total: ${formatMoney(totalSpent, trip.currency)} · Generado el ${formatDate(new Date())}`, 40, 68);
  doc.setTextColor(0);

  let y = 90;
  for (const s of buildSections(data, false)) {
    doc.setFontSize(13);
    doc.text(s.title, 40, y);
    autoTable(doc, {
      startY: y + 8,
      head: [s.head],
      body: s.rows.length ? s.rows.map((r) => r.map(String)) : [["Sin registros"]],
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: 40, right: 40 },
    });
    // lastAutoTable lo agrega el plugin al documento.
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 28;
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 50;
    }
  }
  return doc.output("arraybuffer");
}
