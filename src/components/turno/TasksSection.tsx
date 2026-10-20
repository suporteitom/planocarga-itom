import { AutoTextarea } from "./AutoTextarea";
import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { auditCreate, auditUpdate } from "@/lib/identity";
import { useTasks, type TaskTemplate } from "@/lib/data";
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

export function TasksSection({ shiftRef, user }: { shiftRef: ShiftRef; user: string }) {
  const qc = useQueryClient();
  const { data } = useTasks(shiftRef.date);
  const [shiftF, setShiftF] = useState("all");
  const [cycleSel, setCycleSel] = useState<string[] | null>(null);
  const [cyclesOpen, setCyclesOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ category: string; shift: string; cycle: string; time_start: string; time_end: string; title: string } | null>(null);

  const startEdit = (t: TaskTemplate) => {
    setEditId(t.id);
    setDraft({ category: t.category, shift: t.shift, cycle: t.cycle, time_start: t.time_start ?? "", time_end: t.time_end ?? "", title: t.title });
  };
  const cancelEdit = () => { setEditId(null); setDraft(null); };
  const saveEdit = async () => {
    if (!need() || !editId || !draft || !draft.title.trim()) return;
    const { error } = await supabase.from("task_templates").update({ ...draft, title: draft.title.trim(), time_start: draft.time_start || null, time_end: draft.time_end || null, ...auditUpdate(user) }).eq("id", editId);
    if (error) { toast.error("Erro ao salvar tarefa."); return; }
    cancelEdit();
    refresh();
  };
  const [form, setForm] = useState({ category: "Tarefas Diárias ITOM", shift: shiftRef.shift as string, cycle: "DIÁRIO", time_start: "", time_end: "", title: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks"] });
  const need = () => { if (!user) { toast.error("Escolha seu nome no topo antes de registrar."); return false; } return true; };

  const order: Record<string, number> = { noite: 0, manha: 1, tarde: 2 };
  const tkey = (t: TaskTemplate) => {
    const s = t.time_start ?? "99:99";
    return t.shift === "noite" && s < "12:00" ? `3${s}` : `1${s}`;
  };
  const allT = (data?.templates ?? []).filter((t) => t.category === "Tarefas Diárias ITOM");
  const cycles = [...new Set(allT.map((t) => t.cycle))].sort();
  const templates = allT
    .filter((t) => shiftF === "all" || t.shift === shiftF)
    .filter((t) => cycleSel === null || cycleSel.includes(t.cycle))
    .sort((a, b) => (order[a.shift] ?? 9) - (order[b.shift] ?? 9) || tkey(a).localeCompare(tkey(b)) || a.sort - b.sort);
  const results = new Map((data?.results ?? []).map((r) => [r.template_id, r]));
  const groups = new Map<string, TaskTemplate[]>([["all", templates]]);
  const rowCls: Record<string, string> = { noite: "bg-card", manha: "bg-primary/10", tarde: "bg-muted/60" };

  const setResult = async (t: TaskTemplate, patch: { result?: string; notes?: string }) => {
    if (!need()) return;
    const ex = results.get(t.id);
    const { error } = await supabase.from("task_results").upsert(
      { template_id: t.id, shift_date: shiftRef.date, result: ex?.result ?? "pendente", notes: ex?.notes ?? null, ...(ex ? {} : auditCreate(user)), ...auditUpdate(user), ...patch },
      { onConflict: "template_id,shift_date" },
    );
    if (error) toast.error("Erro ao salvar resultado."); else refresh();
  };

  const add = async () => {
    if (!need() || !form.title.trim()) return;
    const { error } = await supabase.from("task_templates").insert({ ...form, title: form.title.trim(), time_start: form.time_start || null, time_end: form.time_end || null, ...auditCreate(user) });
    if (error) { toast.error("Erro ao criar tarefa."); return; }
    setForm({ ...form, title: "", time_start: "", time_end: "" });
    refresh();
  };

  const remove = async (t: TaskTemplate) => {
    if (!confirm(`Excluir a tarefa "${t.title}"?`)) return;
    const { error } = await supabase.from("task_templates").update({ active: false, ...auditUpdate(user) }).eq("id", t.id);
    if (error) toast.error("Erro ao excluir."); else refresh();
  };

  return (
    <section className="rounded border border-border bg-card">
      <div className="bg-destructive py-2 text-center text-lg font-semibold text-destructive-foreground">Tarefas Diárias ITOM</div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <select className="h-8 rounded border border-input bg-background px-2 text-sm" value={shiftF} onChange={(e) => setShiftF(e.target.value)}>
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
            <div className="border-t border-border pt-1">
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
        <span className="ml-auto text-xs text-muted-foreground">{templates.length} de {allT.length} tarefas</span>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-border p-3">
        <select className="h-8 rounded border border-input bg-background px-2 text-sm" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}>
          {SHIFTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <Input className="h-8 w-28" list="task-cycles" value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })} placeholder="Ciclo" />
        <datalist id="task-cycles">{["DIÁRIO", "DU", "segunda-feira", "sexta-feira", "sábado", "domingo", "MENSAL - DIA 5"].map((c) => <option key={c} value={c} />)}</datalist>
        <Input className="h-8 w-24" type="time" value={form.time_start} onChange={(e) => setForm({ ...form, time_start: e.target.value })} />
        <Input className="h-8 w-24" type="time" value={form.time_end} onChange={(e) => setForm({ ...form, time_end: e.target.value })} />
        <Input className="h-8 min-w-48 flex-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Nova tarefa" />
        <Button size="sm" onClick={add}><Plus className="mr-1 h-4 w-4" />Nova tarefa</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-destructive/70 text-center text-xs text-destructive-foreground">
            <tr><th className="p-2">Turno</th><th className="p-2">Ciclo</th><th className="p-2">Hora I</th><th className="p-2">Hora F</th><th className="p-2 text-left">Tarefa</th><th className="p-2">Resultado</th><th className="p-2">Obs.</th><th /></tr>
          </thead>
          {[...groups].map(([cat, items]) => (
            <tbody key={cat}>
              {items.map((t) => {
                const r = results.get(t.id);
                const editing = editId === t.id && draft;
                return (
                  <tr key={t.id} className={cn("border-t border-border", rowCls[t.shift])}>
                    {editing ? (
                      <>
                        <td className="p-2">
                          <select className="h-7 rounded border border-input bg-background px-1 text-xs" value={draft.shift} onChange={(e) => setDraft({ ...draft, shift: e.target.value })}>
                            {SHIFTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                          </select>
                        </td>
                        <td className="p-2"><Input className="h-7 w-24" value={draft.cycle} onChange={(e) => setDraft({ ...draft, cycle: e.target.value })} /></td>
                        <td className="p-2"><Input className="h-7 w-20" type="time" value={draft.time_start} onChange={(e) => setDraft({ ...draft, time_start: e.target.value })} /></td>
                        <td className="p-2"><Input className="h-7 w-20" type="time" value={draft.time_end} onChange={(e) => setDraft({ ...draft, time_end: e.target.value })} /></td>
                        <td className="p-2"><Input className="h-7" autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }} /></td>
                      </>
                    ) : (
                      <>
                        <td className="p-2 text-xs">{shiftLabel(t.shift)}</td>
                        <td className="p-2 text-xs">{t.cycle}</td>
                        <td className="p-2 font-mono text-xs">{t.time_start ?? ""}</td>
                        <td className="p-2 font-mono text-xs">{t.time_end ?? ""}</td>
                        <td className="p-2">{t.title}</td>
                      </>
                    )}
                    <td className="p-2">
                      <div className="flex gap-1">
                        {RESULTS.map((o) => (
                          <button key={o.key} type="button" onClick={() => setResult(t, { result: o.key })}
                            className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", (r?.result ?? "pendente") === o.key ? o.cls : "bg-muted text-muted-foreground")}>{o.label}</button>
                        ))}
                      </div>
                    </td>
                    <td className="p-2"><AutoTextarea key={r?.notes ?? ""} className="min-w-48 rounded-md border border-input bg-transparent px-2 py-1 text-sm" defaultValue={r?.notes ?? ""} onBlur={(e) => e.target.value !== (r?.notes ?? "") && setResult(t, { notes: e.target.value })} /></td>
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
          ))}
        </table>
        {!templates.length && <p className="p-4 text-sm text-muted-foreground">Nenhuma tarefa para este turno.</p>}
      </div>
    </section>
  );
}
