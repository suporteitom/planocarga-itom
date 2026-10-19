import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { auditCreate, auditUpdate } from "@/lib/identity";
import { useJobs, type JobTemplate } from "@/lib/data";
import { brDate, cycleAppliesOn, shiftLabel, SHIFTS, type ShiftRef } from "@/lib/shifts";
import { cn } from "@/lib/utils";

const RESULTS = [
  { key: "", label: "NULL", cls: "bg-muted text-muted-foreground" },
  { key: "ok", label: "OK", cls: "bg-success text-primary-foreground" },
  { key: "nok", label: "NOK", cls: "bg-destructive text-destructive-foreground" },
  { key: "pendente", label: "Pendente", cls: "bg-warning text-foreground" },
];
const resCls = (r?: string | null) => RESULTS.find((o) => o.key === (r ?? ""))?.cls ?? RESULTS[0]!.cls;
const shiftRow: Record<string, string> = { noite: "bg-info/10", manha: "bg-warning/10", tarde: "bg-success/10" };

type Draft = { job_name: string; bi_folder: string; environment: string; shift: string; cycle: string; run_time: string };
const toDraft = (t?: JobTemplate): Draft => ({
  job_name: t?.job_name ?? "", bi_folder: t?.bi_folder ?? "", environment: t?.environment ?? "PRO-940",
  shift: t?.shift ?? "noite", cycle: t?.cycle ?? "Diário", run_time: t?.run_time ?? "",
});

export function JobsSection({ shiftRef, user }: { shiftRef: ShiftRef; user: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useJobs(shiftRef.date);
  const refresh = () => qc.invalidateQueries({ queryKey: ["jobs"] });
  const need = () => { if (!user) { toast.error("Escolha seu nome no topo antes de registrar."); return false; } return true; };

  const [shiftF, setShiftF] = useState<string>(shiftRef.shift);
  const [envF, setEnvF] = useState("all");
  const [resF, setResF] = useState("all");
  const [q, setQ] = useState("");
  const [cycleSel, setCycleSel] = useState<string[] | null>(null);
  const [cyclesOpen, setCyclesOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft());

  const all = data?.templates ?? [];
  const results = useMemo(() => new Map((data?.results ?? []).map((r) => [r.template_id, r])), [data]);
  const situ = all.filter((t) => t.kind === "situacao");
  const jobs = all.filter((t) => t.kind === "job");
  const cycles = useMemo(() => [...new Set(jobs.map((j) => j.cycle))].sort(), [jobs]);
  const envs = useMemo(() => [...new Set(jobs.map((j) => j.environment).filter(Boolean) as string[])].sort(), [jobs]);
  const ql = q.trim().toLowerCase();
  const shown = jobs
    .filter((t) => shiftF === "all" || t.shift === shiftF)
    .filter((t) => envF === "all" || t.environment === envF)
    .filter((t) => cycleSel === null || cycleSel.includes(t.cycle))
    .filter((t) => resF === "all" || (results.get(t.id)?.result ?? "") === resF)
    .filter((t) => !ql || t.job_name.toLowerCase().includes(ql) || (t.bi_folder ?? "").toLowerCase().includes(ql));
  const stat = (k: string) => shown.filter((t) => (results.get(t.id)?.result ?? "") === k).length;

  const setResult = async (t: JobTemplate, patch: { result?: string | null; notes?: string }) => {
    if (!need()) return;
    const ex = results.get(t.id);
    const { error } = await supabase.from("job_results").upsert(
      { template_id: t.id, shift_date: shiftRef.date, result: ex?.result ?? null, notes: ex?.notes ?? null, ...(ex ? {} : auditCreate(user)), ...auditUpdate(user), ...patch },
      { onConflict: "template_id,shift_date" },
    );
    if (error) toast.error("Erro ao salvar resultado."); else refresh();
  };

  const save = async () => {
    if (!need()) return;
    const v = { ...draft, job_name: draft.job_name.trim(), bi_folder: draft.bi_folder.trim() || null, environment: draft.environment.trim() || null, run_time: draft.run_time || null };
    if (!v.job_name) { toast.error("Informe o nome do job."); return; }
    const { error } = editing === "new"
      ? await supabase.from("job_templates").insert({ ...v, kind: "job", sort: (jobs.at(-1)?.sort ?? 0) + 1, ...auditCreate(user) })
      : await supabase.from("job_templates").update({ ...v, ...auditUpdate(user) }).eq("id", editing!);
    if (error) { toast.error("Erro ao salvar job."); return; }
    setEditing(null); refresh();
  };
  const remove = async (t: JobTemplate) => {
    if (!confirm(`Excluir o job "${t.job_name}"?`)) return;
    const { error } = await supabase.from("job_templates").update({ active: false, ...auditUpdate(user) }).eq("id", t.id);
    if (error) toast.error("Erro ao excluir."); else refresh();
  };
  const startEdit = (t?: JobTemplate) => { setDraft(toDraft(t)); setEditing(t?.id ?? "new"); };

  const ResultSel = ({ t }: { t: JobTemplate }) => {
    const r = results.get(t.id)?.result ?? "";
    return (
      <select value={r} onChange={(e) => setResult(t, { result: e.target.value || null })}
        className={cn("h-7 w-24 rounded border border-border px-1 text-xs font-semibold", resCls(r))}>
        {RESULTS.map((o) => <option key={o.key} value={o.key} className="bg-background text-foreground">{o.label}</option>)}
      </select>
    );
  };
  const Notes = ({ t }: { t: JobTemplate }) => {
    const n = results.get(t.id)?.notes ?? "";
    return <Input key={n} className="h-7 min-w-40" defaultValue={n} onBlur={(e) => e.target.value !== n && setResult(t, { notes: e.target.value })} />;
  };
  const ed = (k: keyof Draft, props: React.ComponentProps<typeof Input> = {}) => (
    <Input className="h-7" value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
      onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(null); }} {...props} />
  );
  const editRow = (key: string) => (
    <tr key={key} className="border-t border-border bg-primary/5">
      <td className="p-1">{ed("job_name", { autoFocus: true, placeholder: "Nome do job" })}</td>
      <td className="p-1">{ed("bi_folder", { placeholder: "Pasta / Spool" })}</td>
      <td className="p-1">{ed("environment", { list: "env-list" })}</td>
      <td className="p-1">
        <select className="h-7 rounded border border-border bg-background px-1 text-xs" value={draft.shift} onChange={(e) => setDraft({ ...draft, shift: e.target.value })}>
          {SHIFTS.map((s) => <option key={s} value={s}>{shiftLabel(s)}</option>)}
        </select>
      </td>
      <td className="p-1">{ed("cycle", { list: "job-cycle-list" })}</td>
      <td className="p-1">{ed("run_time", { type: "time" })}</td>
      <td className="p-1 text-xs text-muted-foreground" colSpan={2}>Resultado e obs. após salvar</td>
      <td className="p-1 whitespace-nowrap">
        <Button size="icon" variant="ghost" className="h-7 w-7 text-success" onClick={save} title="Confirmar"><Check className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(null)} title="Cancelar"><X className="h-4 w-4" /></Button>
      </td>
    </tr>
  );
  const sel = "h-8 rounded border border-border bg-background px-2 text-sm";

  return (
    <div className="grid gap-4">
      <datalist id="env-list">{envs.map((e) => <option key={e} value={e} />)}</datalist>
      <datalist id="job-cycle-list">{cycles.map((c) => <option key={c} value={c} />)}</datalist>

      <section className="overflow-x-auto rounded border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-destructive text-destructive-foreground">
            <tr><th className="p-2 text-left">Tarefa</th><th className="w-28 p-2 text-left">Estado</th><th className="p-2 text-left">Obs.</th></tr>
          </thead>
          <tbody>
            {situ.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="p-2 font-medium">{t.job_name}</td>
                <td className="p-2"><ResultSel t={t} /></td>
                <td className="p-2"><Notes t={t} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
          <h2 className="mr-2 font-semibold">Monitoramento de Jobs · {brDate(shiftRef.date)}</h2>
          <select className={sel} value={shiftF} onChange={(e) => setShiftF(e.target.value)}>
            <option value="all">Todos os turnos</option>
            {SHIFTS.map((s) => <option key={s} value={s}>{shiftLabel(s)}</option>)}
          </select>
          <Popover open={cyclesOpen} onOpenChange={setCyclesOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">Ciclos: {cycleSel === null ? "Todos" : cycleSel.length === 1 ? cycleSel[0] : `${cycleSel.length} selecionados`} ▾</Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-60 p-2 text-sm">
              <label className="flex items-center gap-2 py-1 font-medium">
                <input type="checkbox" checked={cycleSel === null} onChange={(e) => setCycleSel(e.target.checked ? null : [])} />(Selecionar tudo)
              </label>
              <button type="button" className="w-full rounded px-1 py-1 text-left text-primary hover:bg-muted"
                onClick={() => { setCycleSel(cycles.filter((c) => cycleAppliesOn(c, shiftRef.date))); setCyclesOpen(false); }}>
                Aplicáveis em {brDate(shiftRef.date)}
              </button>
              <div className="max-h-64 overflow-y-auto border-t border-border pt-1">
                {cycles.map((c) => (
                  <label key={c} className="flex items-center gap-2 py-0.5">
                    <input type="checkbox" checked={cycleSel === null || cycleSel.includes(c)} onChange={(e) => {
                      const cur = cycleSel ?? cycles;
                      const next = e.target.checked ? [...cur, c] : cur.filter((x) => x !== c);
                      setCycleSel(next.length === cycles.length ? null : next);
                    }} />{c}
                  </label>
                ))}
              </div>
              <div className="mt-2 flex justify-end border-t border-border pt-2"><Button size="sm" onClick={() => setCyclesOpen(false)}>OK</Button></div>
            </PopoverContent>
          </Popover>
          <select className={sel} value={envF} onChange={(e) => setEnvF(e.target.value)}>
            <option value="all">Todos os ambientes</option>
            {envs.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <select className={sel} value={resF} onChange={(e) => setResF(e.target.value)}>
            <option value="all">Todos os resultados</option>
            {RESULTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <Input className="h-8 w-48" placeholder="Buscar job ou pasta…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="text-xs text-muted-foreground">{shown.length} de {jobs.length} jobs · OK {stat("ok")} · NOK {stat("nok")} · Pendente {stat("pendente")}</span>
          <Button size="sm" className="ml-auto" onClick={() => startEdit()} disabled={editing !== null}><Plus className="mr-1 h-4 w-4" />Novo job</Button>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-destructive text-destructive-foreground">
              <tr className="text-left">
                <th className="p-2">Job – SAP PRO</th><th className="p-2">BI - Pastas</th><th className="p-2">Ambiente</th><th className="p-2">Turno</th>
                <th className="p-2">Ciclo</th><th className="p-2">Hora</th><th className="p-2">Resultado</th><th className="p-2">Obs.</th><th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {editing === "new" && editRow("new")}
              {isLoading && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>}
              {shown.map((t) => editing === t.id ? editRow(t.id) : (
                <tr key={t.id} className={cn("border-t border-border", shiftRow[t.shift])}>
                  <td className="p-1.5 font-mono text-xs">{t.job_name}</td>
                  <td className="p-1.5 text-xs">{t.bi_folder}</td>
                  <td className="p-1.5 text-xs">{t.environment}</td>
                  <td className="p-1.5 text-xs">{shiftLabel(t.shift as never)}</td>
                  <td className="p-1.5 text-xs">{t.cycle}</td>
                  <td className="p-1.5 font-mono text-xs">{t.run_time}</td>
                  <td className="p-1.5"><ResultSel t={t} /></td>
                  <td className="p-1.5"><Notes t={t} /></td>
                  <td className="p-1.5 whitespace-nowrap">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(t)} disabled={editing !== null} title="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(t)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
              {!isLoading && shown.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Nenhum job com esses filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
