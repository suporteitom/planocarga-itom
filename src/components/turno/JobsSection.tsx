import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { auditCreate, auditUpdate } from "@/lib/identity";
import { useJobs, type JobTemplate } from "@/lib/data";
import { SHIFTS, shiftLabel, cycleAppliesOn, type ShiftRef } from "@/lib/shifts";
import { cn } from "@/lib/utils";

const RESULTS = [
  { key: "ok", label: "OK", cls: "bg-success text-primary-foreground" },
  { key: "nok", label: "NOK", cls: "bg-destructive text-destructive-foreground" },
  { key: "na", label: "N/A", cls: "bg-muted-foreground text-background" },
  { key: "exec", label: "EXEC", cls: "bg-info text-background" },
  { key: "nexec", label: "N/EXEC", cls: "border border-info bg-transparent text-info" },
  { key: "pendente", label: "Pendente", cls: "bg-warning text-foreground" },
];
const rowCls: Record<string, string> = { noite: "bg-card", manha: "bg-primary/10", tarde: "bg-muted/60" };
type Draft = { job_name: string; bi_folder: string; environment: string; shift: string; cycle: string; run_time: string };

export function JobsSection({ shiftRef, user }: { shiftRef: ShiftRef; user: string }) {
  const qc = useQueryClient();
  const { data } = useJobs(shiftRef.date);
  const [shiftF, setShiftF] = useState("all");
  const [cycleSel, setCycleSel] = useState<string[] | null>(null);
  const [cyclesOpen, setCyclesOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [form, setForm] = useState<Draft>({ job_name: "", bi_folder: "", environment: "PRO-940", shift: shiftRef.shift, cycle: "Diário", run_time: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["jobs"] });
  const need = () => { if (!user) { toast.error("Escolha seu nome no topo antes de registrar."); return false; } return true; };

  const all = data?.templates ?? [];
  const situ = all.filter((t) => t.kind === "situacao");
  const allJ = all.filter((t) => t.kind === "job");
  const cycles = [...new Set(allJ.map((t) => t.cycle))].sort();
  const jobs = allJ
    .filter((t) => shiftF === "all" || t.shift === shiftF)
    .filter((t) => cycleSel === null || cycleSel.includes(t.cycle));
  const results = new Map((data?.results ?? []).map((r) => [r.template_id, r]));
  const clean = (d: Draft) => ({ ...d, job_name: d.job_name.trim(), bi_folder: d.bi_folder.trim() || null, environment: d.environment.trim() || null, run_time: d.run_time || null });

  const setResult = async (t: JobTemplate, patch: { result?: string | null; notes?: string }) => {
    if (!need()) return;
    const ex = results.get(t.id);
    const { error } = await supabase.from("job_results").upsert(
      { template_id: t.id, shift_date: shiftRef.date, result: ex?.result ?? "pendente", notes: ex?.notes ?? null, ...(ex ? {} : auditCreate(user)), ...auditUpdate(user), ...patch },
      { onConflict: "template_id,shift_date" },
    );
    if (error) toast.error("Erro ao salvar resultado."); else refresh();
  };
  const add = async () => {
    if (!need() || !form.job_name.trim()) return;
    const { error } = await supabase.from("job_templates").insert({ ...clean(form), kind: "job", sort: (allJ.at(-1)?.sort ?? 0) + 1, ...auditCreate(user) });
    if (error) { toast.error("Erro ao criar job."); return; }
    setForm({ ...form, job_name: "", bi_folder: "", run_time: "" });
    refresh();
  };
  const startEdit = (t: JobTemplate) => {
    setEditId(t.id);
    setDraft({ job_name: t.job_name, bi_folder: t.bi_folder ?? "", environment: t.environment ?? "", shift: t.shift, cycle: t.cycle, run_time: t.run_time ?? "" });
  };
  const cancelEdit = () => { setEditId(null); setDraft(null); };
  const saveEdit = async () => {
    if (!need() || !editId || !draft || !draft.job_name.trim()) return;
    const { error } = await supabase.from("job_templates").update({ ...clean(draft), ...auditUpdate(user) }).eq("id", editId);
    if (error) { toast.error("Erro ao salvar job."); return; }
    cancelEdit(); refresh();
  };
  const remove = async (t: JobTemplate) => {
    if (!confirm(`Excluir o job "${t.job_name}"?`)) return;
    const { error } = await supabase.from("job_templates").update({ active: false, ...auditUpdate(user) }).eq("id", t.id);
    if (error) toast.error("Erro ao excluir."); else refresh();
  };

  const resultBtns = (t: JobTemplate) => {
    const cur = results.get(t.id)?.result ?? "pendente";
    return (
      <div className="flex gap-1">
        {RESULTS.map((o) => (
          <button key={o.key} type="button" onClick={() => setResult(t, { result: o.key })}
            className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", cur === o.key ? o.cls : "bg-muted text-muted-foreground")}>{o.label}</button>
        ))}
      </div>
    );
  };
  const notes = (t: JobTemplate) => {
    const n = results.get(t.id)?.notes ?? "";
    return <AutoTextarea key={n} className="min-w-48 rounded-md border border-input bg-transparent px-2 py-1 text-sm" defaultValue={n} onBlur={(e) => e.target.value !== n && setResult(t, { notes: e.target.value })} />;
  };
  const sel = "h-8 rounded border border-input bg-background px-2 text-sm";

  return (
    <div className="grid gap-4">
      <section className="rounded border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-destructive/70 text-xs text-destructive-foreground">
            <tr><th className="p-2 text-left">Tarefa</th><th className="p-2">Estado</th><th className="p-2">Obs.</th></tr>
          </thead>
          <tbody>
            {situ.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="p-2">{t.job_name}</td>
                <td className="p-2">{resultBtns(t)}</td>
                <td className="p-2">{notes(t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded border border-border bg-card">
        <div className="bg-destructive py-2 text-center text-lg font-semibold text-destructive-foreground">Monitoramento de Jobs</div>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <select className={sel} value={shiftF} onChange={(e) => setShiftF(e.target.value)}>
            <option value="all">Todos os turnos</option>
            {SHIFTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <Popover open={cyclesOpen} onOpenChange={setCyclesOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="flex h-8 items-center rounded border border-input bg-background px-2 text-sm">
                Ciclos: {cycleSel === null ? "Todos" : cycleSel.length === 1 ? cycleSel[0] : `${cycleSel.length} selecionados`} ▾
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-2 text-sm">
              <label className="flex items-center gap-2 py-1 font-medium">
                <input type="checkbox" checked={cycleSel === null} onChange={(e) => setCycleSel(e.target.checked ? null : [])} />(Selecionar tudo)
              </label>
              <button type="button" className="mb-1 w-full rounded px-1 py-1 text-left text-primary hover:bg-muted" onClick={() => { setCycleSel(cycles.filter((c) => cycleAppliesOn(c, shiftRef.date))); setCyclesOpen(false); }}>
                Aplicáveis em {shiftRef.date.split("-").reverse().join("/")}
              </button>
              <div className="max-h-64 overflow-y-auto border-t border-border pt-1">
                {cycles.map((c) => (
                  <label key={c} className="flex items-center gap-2 py-1">
                    <input type="checkbox" checked={cycleSel === null || cycleSel.includes(c)} onChange={(e) => {
                      const cur = cycleSel ?? cycles;
                      const next = e.target.checked ? [...cur, c] : cur.filter((x) => x !== c);
                      setCycleSel(next.length === cycles.length ? null : next);
                    }} />{c}
                  </label>
                ))}
              </div>
              <div className="mt-2 flex justify-end border-t border-border pt-2">
                <Button size="sm" className="h-7" onClick={() => setCyclesOpen(false)}>OK</Button>
              </div>
            </PopoverContent>
          </Popover>
          <span className="ml-auto text-xs text-muted-foreground">{jobs.length} de {allJ.length} jobs</span>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Input className="h-8 min-w-48 flex-1" value={form.job_name} onChange={(e) => setForm({ ...form, job_name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Novo job" />
          <Input className="h-8 w-36" value={form.bi_folder} onChange={(e) => setForm({ ...form, bi_folder: e.target.value })} placeholder="BI - Pastas" />
          <Input className="h-8 w-28" value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })} placeholder="Ambiente" />
          <select className={sel} value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}>
            {SHIFTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <Input className="h-8 w-32" list="job-cycles" value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })} placeholder="Ciclo" />
          <datalist id="job-cycles">{cycles.map((c) => <option key={c} value={c} />)}</datalist>
          <Input className="h-8 w-24" type="time" value={form.run_time} onChange={(e) => setForm({ ...form, run_time: e.target.value })} />
          <Button size="sm" onClick={add}><Plus className="mr-1 h-4 w-4" />Novo job</Button>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-destructive/70 text-center text-xs text-destructive-foreground">
              <tr><th className="p-2 text-left">Job – SAP PRO</th><th className="p-2">BI - Pastas</th><th className="p-2">Ambiente</th><th className="p-2">Turno</th><th className="p-2">Ciclo</th><th className="p-2">Hora</th><th className="p-2">Resultado</th><th className="p-2">Obs.</th><th /></tr>
            </thead>
            <tbody>
              {jobs.map((t) => {
                const editing = editId === t.id && draft;
                return (
                  <tr key={t.id} className={cn("border-t border-border", rowCls[t.shift])}>
                    {editing ? (
                      <>
                        <td className="p-2"><Input className="h-7" autoFocus value={draft.job_name} onChange={(e) => setDraft({ ...draft, job_name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }} /></td>
                        <td className="p-2"><Input className="h-7 w-28" value={draft.bi_folder} onChange={(e) => setDraft({ ...draft, bi_folder: e.target.value })} /></td>
                        <td className="p-2"><Input className="h-7 w-24" value={draft.environment} onChange={(e) => setDraft({ ...draft, environment: e.target.value })} /></td>
                        <td className="p-2">
                          <select className="h-7 rounded border border-input bg-background px-1 text-xs" value={draft.shift} onChange={(e) => setDraft({ ...draft, shift: e.target.value })}>
                            {SHIFTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                          </select>
                        </td>
                        <td className="p-2"><Input className="h-7 w-28" list="job-cycles" value={draft.cycle} onChange={(e) => setDraft({ ...draft, cycle: e.target.value })} /></td>
                        <td className="p-2"><Input className="h-7 w-20" type="time" value={draft.run_time} onChange={(e) => setDraft({ ...draft, run_time: e.target.value })} /></td>
                      </>
                    ) : (
                      <>
                        <td className="p-2 font-mono text-xs">{t.job_name}</td>
                        <td className="p-2 text-xs">{t.bi_folder ?? ""}</td>
                        <td className="p-2 text-xs">{t.environment ?? ""}</td>
                        <td className="p-2 text-xs">{shiftLabel(t.shift)}</td>
                        <td className="p-2 text-xs">{t.cycle}</td>
                        <td className="p-2 font-mono text-xs">{t.run_time ?? ""}</td>
                      </>
                    )}
                    <td className="p-2">{resultBtns(t)}</td>
                    <td className="p-2">{notes(t)}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        {editing ? (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-success" onClick={saveEdit} title="Confirmar"><Check className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit} title="Cancelar"><X className="h-4 w-4" /></Button>
                          </>
                        ) : (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(t)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(t)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!jobs.length && <p className="p-4 text-sm text-muted-foreground">Nenhum job para este filtro.</p>}
        </div>
      </section>
    </div>
  );
}
