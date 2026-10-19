import type { Intervention, Message, TaskResult, TaskTemplate } from "./data";
import { brDate, shiftLabel, shiftOf, spParts } from "./shifts";

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Nome de ficheiro de exportação; inclui o turno quando um turno foi escolhido. */
export function exportFileName(prefix: string, from: string, to: string, shift?: string) {
  return `${prefix}_${from}_a_${to}${shift ? "_" + slug(shiftLabel(shift)) : ""}.xlsx`;
}

/** Linhas da folha "Resumo": período, turno, data de geração e registos por guia. */
export function summaryRows(
  from: string,
  to: string,
  shift: string | undefined,
  generatedAt: Date,
  sheets: { name: string; rows: unknown[] }[],
) {
  const total = sheets.reduce((n, s) => n + s.rows.length, 0);
  return [
    ["PLANO DE CARGA - ITOM", ""],
    ["Gerado em", spParts(generatedAt).br],
    ["Fuso horário", "Lisboa (Europe/Lisbon)"],
    ["Período", from === to ? brDate(from) : `${brDate(from)} a ${brDate(to)}`],
    ["Turno selecionado", shift ? shiftLabel(shift) : "Todos"],
    ["", ""],
    ["Guia", "Registos"],
    ...sheets.map((s) => [s.name, s.rows.length] as (string | number)[]),
    ["Total", total],
  ];
}

/** Larguras de coluna (em caracteres) a partir do cabeçalho e do conteúdo, entre 8 e 60. */
export function columnWidths(rows: Record<string, unknown>[]) {
  const keys = Object.keys(rows[0] ?? {});
  return keys.map((k) => {
    const longest = rows.reduce((n, r) => Math.max(n, String(r[k] ?? "").length), k.length);
    return { wch: Math.min(60, Math.max(8, longest + 2)) };
  });
}

/** Folha de dados com filtro no cabeçalho e larguras ajustadas. */
function dataSheet(XLSX: typeof import("xlsx"), rows: Record<string, unknown>[], empty: Record<string, unknown>) {
  const data = rows.length ? rows : [empty];
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = columnWidths(data);
  if (ws["!ref"]) ws["!autofilter"] = { ref: ws["!ref"] };
  return ws;
}

/** Grava o livro congelando a 1.ª linha de cada folha de dados (a biblioteca não o faz sozinha). */
async function saveWithFrozenHeader(XLSX: typeof import("xlsx"), wb: import("xlsx").WorkBook, filename: string, skip: string[] = []) {
  const { unzipSync, zipSync, strFromU8, strToU8 } = await import("fflate");
  const files = unzipSync(new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" })));
  wb.SheetNames.forEach((name, i) => {
    const path = `xl/worksheets/sheet${i + 1}.xml`;
    if (skip.includes(name) || !files[path]) return;
    files[path] = strToU8(
      strFromU8(files[path]).replace(
        /<sheetView ([^>]*?)\/>/,
        '<sheetView $1><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>',
      ),
    );
  });
  const blob = new Blob([zipSync(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}


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
  XLSX.utils.book_append_sheet(wb, dataSheet(XLSX, msgs, { Recado: "" }), "Recados");
  XLSX.utils.book_append_sheet(wb, dataSheet(XLSX, ints, { Tipo: "" }), "Intervenções");
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
    XLSX.utils.book_append_sheet(wb, dataSheet(XLSX, rows, { Tarefa: "" }), "Tarefas");
  }
  await saveWithFrozenHeader(XLSX, wb, filename);
}

export async function exportAll(from: string, to: string, shift?: string) {
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
  const all = ((m.data ?? []) as any[]).filter((x) => !shift || x.shift === shift);
  const ints = ((i.data ?? []) as any[])
    .filter((x) => !shift || shiftOf(new Date(x.start_at)).shift === shift)
    .map((x) => ({
    Tipo: x.type ?? "", Cliente: x.client ?? "", Data: x.start_at ? br(spParts(x.start_at).date) : "", Ticket: x.ticket ?? "",
    Início: spParts(x.start_at).time, "Fim previsto": spParts(x.end_at).br, "E-mail (assunto)": x.email_subject ?? "",
    "Quem enviou": x.sent_by ?? "", "Data/hora envio": spParts(x.sent_at).br, Observações: x.notes ?? "", Status: x.status,
    "Criado por": x.created_by ?? "", "Alterado por": x.updated_by ?? "",
  }));
  const tMap = new Map(((tt.data ?? []) as any[]).map((t) => [t.id, t]));
  const isDaily = (t: any) => t.category === "Tarefas Diárias ITOM";
  const taskRows = (daily: boolean) => ((tr.data ?? []) as any[]).filter((r) => { const t = tMap.get(r.template_id); return t && isDaily(t) === daily && (!shift || t.shift === shift); }).map((r) => {
    const t: any = tMap.get(r.template_id);
    return daily
      ? { Data: br(r.shift_date), Turno: shiftLabel(t.shift), Ciclo: t.cycle, "Hora I": t.time_start ?? "", "Hora F": t.time_end ?? "", Tarefa: t.title, Resultado: r.result ?? "", "Obs.": r.notes ?? "", "Alterado por": r.updated_by ?? "" }
      : { Data: br(r.shift_date), Bloco: t.category, Item: t.title, Resultado: r.result ?? "", "Obs.": r.notes ?? "", "Alterado por": r.updated_by ?? "" };
  });
  const jMap = new Map(((jt.data ?? []) as any[]).map((t) => [t.id, t]));
  const jobs = ((jr.data ?? []) as any[]).filter((r) => { const t = jMap.get(r.template_id); return !!t && (!shift || t.shift === shift); }).map((r) => {
    const t: any = jMap.get(r.template_id);
    return { Data: br(r.shift_date), Tipo: t.kind === "situacao" ? "Ponto de Situação" : "Job", Job: t.job_name, "BI - Pastas": t.bi_folder ?? "", Ambiente: t.environment ?? "", Turno: shiftLabel(t.shift), Ciclo: t.cycle ?? "", Hora: t.run_time ?? "", Resultado: r.result ?? "", "Obs.": r.notes ?? "", "Alterado por": r.updated_by ?? "" };
  });
  const wb = XLSX.utils.book_new();
  const sheets = [
    { name: "Recados", rows: msg(all.filter((x) => x.category === "recados")) },
    { name: "Intervenções", rows: ints },
    { name: "Outros Recados", rows: msg(all.filter((x) => x.category === "outros")) },
    { name: "Tarefas do Dia", rows: taskRows(true) },
    { name: "Tarefas Esporádicas", rows: taskRows(false) },
    { name: "Monitoramento de Jobs", rows: jobs },
  ];
  const sum = XLSX.utils.aoa_to_sheet(summaryRows(from, to, shift, new Date(), sheets));
  sum["!cols"] = [{ wch: 30 }, { wch: 26 }];
  sum["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  XLSX.utils.book_append_sheet(wb, sum, "Resumo");
  for (const s of sheets) {
    XLSX.utils.book_append_sheet(wb, dataSheet(XLSX, s.rows as Record<string, unknown>[], { "Sem registos": "" }), s.name);
  }
  await saveWithFrozenHeader(XLSX, wb, exportFileName("plano-carga-itom", from, to, shift), ["Resumo"]);
}
