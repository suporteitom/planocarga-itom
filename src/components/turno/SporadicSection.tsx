import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { auditCreate, auditUpdate } from "@/lib/identity";
import { useTasks, type TaskTemplate } from "@/lib/data";
import type { ShiftRef } from "@/lib/shifts";
import { cn } from "@/lib/utils";

export const SPORADIC_CATEGORIES = ["Aplicacional - CTT", "Requests - CTT", "Processamento"];

const RESULTS = [
  { key: "ok", label: "OK", cls: "bg-success text-primary-foreground" },
  { key: "nok", label: "NOK", cls: "bg-destructive text-destructive-foreground" },
  { key: "na", label: "N/A", cls: "bg-muted-foreground text-background" },
  { key: "exec", label: "EXEC", cls: "bg-info text-background" },
  { key: "nexec", label: "N/EXEC", cls: "border border-info bg-transparent text-info" },
  { key: "pendente", label: "Pendente", cls: "bg-warning text-foreground" },
];

export function SporadicSection({ shiftRef, user }: { shiftRef: ShiftRef; user: string }) {
  const qc = useQueryClient();
  const { data } = useTasks(shiftRef.date);
  const [newTitle, setNewTitle] = useState<Record<string, string>>({});
  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks"] });
  const need = () => { if (!user) { toast.error("Escolha seu nome no topo antes de registrar."); return false; } return true; };
  const results = new Map((data?.results ?? []).map((r) => [r.template_id, r]));
  const all = data?.templates ?? [];

  const setResult = async (t: TaskTemplate, patch: { result?: string; notes?: string }) => {
    if (!need()) return;
    const ex = results.get(t.id);
    const { error } = await supabase.from("task_results").upsert(
      { template_id: t.id, shift_date: shiftRef.date, result: ex?.result ?? "pendente", notes: ex?.notes ?? null, ...(ex ? {} : auditCreate(user)), ...auditUpdate(user), ...patch },
      { onConflict: "template_id,shift_date" },
    );
    if (error) toast.error("Erro ao salvar resultado."); else refresh();
  };
  const add = async (cat: string) => {
    const title = (newTitle[cat] ?? "").trim();
    if (!need() || !title) return;
    const sort = all.filter((t) => t.category === cat).length;
    const { error } = await supabase.from("task_templates").insert({ category: cat, shift: shiftRef.shift, cycle: "ESPORÁDICA", title, sort, ...auditCreate(user) });
    if (error) { toast.error("Erro ao criar tarefa."); return; }
    setNewTitle({ ...newTitle, [cat]: "" });
    refresh();
  };
  const remove = async (t: TaskTemplate) => {
    if (!confirm(`Excluir "${t.title}"?`)) return;
    const { error } = await supabase.from("task_templates").update({ active: false, ...auditUpdate(user) }).eq("id", t.id);
    if (error) toast.error("Erro ao excluir."); else refresh();
  };

  return (
    <div className="grid gap-4">
      {SPORADIC_CATEGORIES.map((cat) => {
        const items = all.filter((t) => t.category === cat).sort((a, b) => a.sort - b.sort);
        return (
          <section key={cat} className="overflow-x-auto rounded border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-destructive text-destructive-foreground">
                <tr><th className="p-2 text-center font-semibold">{cat}</th><th className="w-56 p-2">Resultado</th><th className="p-2">Obs.</th><th className="w-10" /></tr>
              </thead>
              <tbody>
                <tr className="border-b border-border bg-muted/30">
                  <td colSpan={4} className="p-2">
                    <div className="flex gap-2">
                      <Input className="h-8" placeholder="Nova linha…" value={newTitle[cat] ?? ""} onChange={(e) => setNewTitle({ ...newTitle, [cat]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add(cat)} />
                      <Button size="sm" onClick={() => add(cat)}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
                    </div>
                  </td>
                </tr>
                {items.map((t) => {
                  const r = results.get(t.id);
                  return (
                    <tr key={t.id} className="border-t border-border">
                      <td className="p-2">{t.title}</td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          {RESULTS.map((o) => (
                            <button key={o.key} type="button" onClick={() => setResult(t, { result: o.key })}
                              className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", (r?.result ?? "pendente") === o.key ? o.cls : "bg-muted text-muted-foreground")}>{o.label}</button>
                          ))}
                        </div>
                      </td>
                      <td className="p-2"><AutoTextarea key={r?.notes ?? ""} className="min-w-48 rounded-md border border-input bg-transparent px-2 py-1 text-sm" defaultValue={r?.notes ?? ""} onBlur={(e) => e.target.value !== (r?.notes ?? "") && setResult(t, { notes: e.target.value })} /></td>
                      <td className="p-2"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(t)} title="Excluir"><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
