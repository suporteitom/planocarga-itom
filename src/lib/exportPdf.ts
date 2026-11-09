import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { brDate, shiftLabel, spParts } from "./shifts";
import { collectExportData } from "./export";
import type { Intervention, Message } from "./data";

export interface ExportPdfParams {
  from: string;
  to: string;
  shift?: string | undefined;
  messages?: Message[] | undefined;
  interventions?: Intervention[] | undefined;
}

export async function exportPdf({ from, to, shift, messages, interventions }: ExportPdfParams) {
  let msgs = messages;
  let ints = interventions;

  // Se não foi realizada busca prévia, coleta todos os dados do período
  if (!msgs || !ints) {
    const data = await collectExportData(from, to, shift);
    msgs = data.messages as Message[];
    ints = data.interventions as Intervention[];
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Cabeçalho
  doc.setFontSize(16);
  doc.text("PLANO DE TRABALHO - ITOM", 14, 15);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Período: ${from === to ? brDate(from) : `${brDate(from)} a ${brDate(to)}`}  |  Turno: ${shift ? shiftLabel(shift) : "Todos"}  |  Gerado em: ${spParts(new Date()).br}`,
    14,
    22
  );

  // Tabela de Recados
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Recados (${msgs.length})`, 14, 32);

  autoTable(doc, {
    startY: 35,
    head: [["Data do turno", "Turno", "Autor", "Importância", "Recado"]],
    body: msgs.map((m) => [
      brDate(m.shift_date),
      shiftLabel(m.shift),
      m.author || "-",
      m.importance,
      m.body,
    ]),
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  // Tabela de Intervenções
  const finalY = (doc as any).lastAutoTable?.finalY || 40;
  doc.setFontSize(12);
  doc.text(`Intervenções (${ints.length})`, 14, finalY + 12);

  autoTable(doc, {
    startY: finalY + 15,
    head: [["Data/Hora", "Tipo", "Cliente", "Ticket", "Assunto", "Prioridade", "Status", "Obs"]],
    body: ints.map((i) => [
      spParts(i.start_at).br,
      i.type || "-",
      i.client || "-",
      i.ticket ? `#${i.ticket}` : "-",
      i.email_subject || "-",
      ({ "1": "1 - Crítico", "2": "2 - Alto", "3": "3 - Moderado" } as Record<string, string>)[i.priority ?? ""] ?? "-",
      i.status,
      i.notes || "-",
    ]),
    theme: "grid",
    headStyles: { fillColor: [39, 174, 96], textColor: 255 },
    styles: { fontSize: 8, cellPadding: 2 },
  });

  const filename = `relatorio_turno_${from}_a_${to}${shift ? `_${shift}` : ""}.pdf`;
  doc.save(filename);
}
