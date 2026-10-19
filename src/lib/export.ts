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

export async function exportAll(from: string, to: string) {
  const { supabase } = await import("@/integrations/supabase/client");
  const XLSX = await import("xlsx");
  const br = (d: string) => d.split("-").reverse().join("/");
  const [m, i, tt, tr, jt, jr] = await Promise.all([
    supabase.from("messages").select("*").gte("shift_date", from).lte("shift_date", to).order("occurred_at").range(0, 9999),
    supabase.from("interventions").select("*").order("start_at").range(0, 9999),
    supabase.from("task_templates").select("*").range(0, 9999),
    supabase.from("task_results").select("*").gte("shift_date", from).lte("shift_date", to).order("shift_date").range(0, 49999),
    supabase.from("job_templates").select("*").range(0, 9999),
    supabase.from("job_results").select("*").gte("shift_date", from).lte("shift_date", to).order("shift_date").range(0, 49999),
  ]);
  const msg = (rows: any[]) => rows.map((x) => ({
    "Data do turno": br(x.shift_date), Turno: shiftLabel(x.shift), "Data/hora": spParts(x.occurred_at).br,
    Recado: x.body, Autor: x.author ?? "", Importância: x.importance, "Criado por": x.created_by ?? "", "Alterado por": x.updated_by ?? "",
  }));
  const all = (m.data ?? []) as any[];
  const ints = ((i.data ?? []) as any[]).map((x) => ({
    Tipo: x.type ?? "", Cliente: x.client ?? "", Data: x.start_at ? br(spParts(x.start_at).date) : "", Ticket: x.ticket ?? "",
    Início: spParts(x.start_at).time, "Fim previsto": spParts(x.end_at).br, "E-mail (assunto)": x.email_subject ?? "",
    "Quem enviou": x.sent_by ?? "", "Data/hora envio": spParts(x.sent_at).br, Observações: x.notes ?? "", Status: x.status,
    "Criado por": x.created_by ?? "", "Alterado por": x.updated_by ?? "",
  }));
  const tMap = new Map(((tt.data ?? []) as any[]).map((t) => [t.id, t]));
  const isDaily = (t: any) => t.category === "Tarefas Diárias ITOM";
  const taskRows = (daily: boolean) => ((tr.data ?? []) as any[]).filter((r) => { const t = tMap.get(r.template_id); return t && isDaily(t) === daily; }).map((r) => {
    const t: any = tMap.get(r.template_id);
    return daily
      ? { Data: br(r.shift_date), Turno: shiftLabel(t.shift), Ciclo: t.cycle, "Hora I": t.time_start ?? "", "Hora F": t.time_end ?? "", Tarefa: t.title, Resultado: r.result ?? "", "Obs.": r.notes ?? "", "Alterado por": r.updated_by ?? "" }
      : { Data: br(r.shift_date), Bloco: t.category, Item: t.title, Resultado: r.result ?? "", "Obs.": r.notes ?? "", "Alterado por": r.updated_by ?? "" };
  });
  const jMap = new Map(((jt.data ?? []) as any[]).map((t) => [t.id, t]));
  const jobs = ((jr.data ?? []) as any[]).filter((r) => jMap.has(r.template_id)).map((r) => {
    const t: any = jMap.get(r.template_id);
    return { Data: br(r.shift_date), Tipo: t.kind === "situacao" ? "Ponto de Situação" : "Job", Job: t.job_name, "BI - Pastas": t.bi_folder ?? "", Ambiente: t.environment ?? "", Turno: shiftLabel(t.shift), Ciclo: t.cycle ?? "", Hora: t.run_time ?? "", Resultado: r.result ?? "", "Obs.": r.notes ?? "", "Alterado por": r.updated_by ?? "" };
  });
  const wb = XLSX.utils.book_new();
  const add = (rows: any[], name: string) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Sem registos": "" }]), name);
  add(msg(all.filter((x) => x.category === "recados")), "Recados");
  add(ints, "Intervenções");
  add(msg(all.filter((x) => x.category === "outros")), "Outros Recados");
  add(taskRows(true), "Tarefas do Dia");
  add(taskRows(false), "Tarefas Esporádicas");
  add(jobs, "Monitoramento de Jobs");
  XLSX.writeFile(wb, `plano-carga-itom_${from}_a_${to}.xlsx`);
}
