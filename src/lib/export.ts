import type { Intervention, Message, TaskResult, TaskTemplate } from "./data";
import { shiftLabel, spParts } from "./shifts";

export async function exportXlsx(
  filename: string,
  messages: Message[],
  interventions: Intervention[],
  tasks?: { templates: TaskTemplate[]; results: TaskResult[] },
) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const msgs = messages.map((m) => ({
    "Data do turno": m.shift_date.split("-").reverse().join("/"),
    Turno: shiftLabel(m.shift),
    "Data/hora": spParts(m.occurred_at).br,
    Recado: m.body,
    Autor: m.author ?? "",
    Importância: m.importance,
    Status: m.status,
    "Criado por": m.created_by ?? "",
    "Alterado por": m.updated_by ?? "",
    "Alterado em": spParts(m.updated_at).br,
  }));
  const ints = interventions.map((i) => ({
    Tipo: i.type ?? "",
    Cliente: i.client ?? "",
    Data: spParts(i.start_at).date.split("-").reverse().join("/"),
    Ticket: i.ticket ?? "",
    Início: spParts(i.start_at).time,
    "Fim previsto": spParts(i.end_at).br,
    "E-mail (assunto)": i.email_subject ?? "",
    "Quem enviou": i.sent_by ?? "",
    "Data/hora envio": spParts(i.sent_at).br,
    Observações: i.notes ?? "",
    Status: i.status,
    "Criado por": i.created_by ?? "",
    "Alterado por": i.updated_by ?? "",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(msgs.length ? msgs : [{ Recado: "" }]), "Recados");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ints.length ? ints : [{ Tipo: "" }]), "Intervenções");
  if (tasks) {
    const resMap = new Map(tasks.results.map((r) => [r.template_id, r]));
    const rows = tasks.templates.map((t) => {
      const r = resMap.get(t.id);
      return {
        Categoria: t.category,
        Turno: shiftLabel(t.shift),
        Ciclo: t.cycle,
        "Hora I": t.time_start ?? "",
        "Hora F": t.time_end ?? "",
        Tarefa: t.title,
        Resultado: r?.result ?? "pendente",
        "Obs.": r?.notes ?? "",
        "Alterado por": r?.updated_by ?? "",
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Tarefa: "" }]), "Tarefas");
  }
  XLSX.writeFile(wb, filename);
}
