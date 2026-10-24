import { useMemo, useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { auditCreate, auditUpdate } from "@/lib/identity";
import { parseJobsPaste } from "@/lib/jobImport";
import { shiftLabel } from "@/lib/shifts";

export function JobsImportDialog({ user, shiftDate, nextSort, existingIds, onDone }: {
  user: string; shiftDate: string; nextSort: number; existingIds: string[]; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => parseJobsPaste(text), [text]);
  const ok = rows.filter((r) => !r.error);
  const bad = rows.length - ok.length;
  const count = (s: string) => ok.filter((r) => r.shift === s).length;

  const save = async () => {
    if (!user) { toast.error("Identifique-se antes de importar."); return; }
    if (!ok.length) return;
    if (mode === "replace" && !confirm(`Substituir os ${existingIds.length} jobs atuais por ${ok.length} novos?`)) return;
    setBusy(true);
    try {
      if (mode === "replace" && existingIds.length) {
        for (let i = 0; i < existingIds.length; i += 500) {
          const { error } = await supabase.from("job_templates").update({ active: false, ...auditUpdate(user) }).in("id", existingIds.slice(i, i + 500));
          if (error) throw error;
        }
      }
      const base = mode === "replace" ? 1 : nextSort;
      const results: { template_id: string; shift_date: string; result: string; notes: string | null }[] = [];
      for (let i = 0; i < ok.length; i += 500) {
        const chunk = ok.slice(i, i + 500);
        const { data, error } = await supabase.from("job_templates").insert(chunk.map((r, k) => ({
          job_name: r.job_name, bi_folder: r.bi_folder, environment: r.environment, shift: r.shift, cycle: r.cycle,
          run_time: r.run_time, kind: "job", sort: base + i + k, ...auditCreate(user),
        }))).select("id");
        if (error) throw error;
        data.forEach((d, k) => {
          const r = chunk[k];
          if (r.result || r.notes) results.push({ template_id: d.id, shift_date: shiftDate, result: r.result ?? "pendente", notes: r.notes });
        });
      }
      for (let i = 0; i < results.length; i += 500) {
        const { error } = await supabase.from("job_results").upsert(results.slice(i, i + 500).map((r) => ({ ...r, ...auditCreate(user), ...auditUpdate(user) })), { onConflict: "template_id,shift_date" });
        if (error) throw error;
      }
      toast.success(`${ok.length} jobs importados.`);
      setText(""); setOpen(false); onDone();
    } catch {
      toast.error("Erro ao importar. Nada foi perdido; tente novamente.");
      onDone();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><ClipboardPaste className="mr-1 h-4 w-4" />Colar do Excel</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader><DialogTitle>Importar jobs colando do Excel</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Selecione as linhas no Excel (pode incluir o cabeçalho), Ctrl+C e cole abaixo. Ordem das colunas:
          Job – SAP PRO · BI - Pastas · Ambiente · Turno · Ciclo · Hora · Resultado · Obs.
          Resultado e Obs. ficam gravados no dia do turno aberto.
        </p>
        <textarea className="h-40 w-full rounded border border-input bg-background p-2 font-mono text-xs" placeholder="Cole aqui (Ctrl+V)…" value={text} onChange={(e) => setText(e.target.value)} />
        {rows.length > 0 && (
          <>
            <div className="text-sm">
              <b>{ok.length}</b> jobs válidos — Noite {count("noite")}, Manhã {count("manha")}, Tarde {count("tarde")}
              {bad > 0 && <span className="text-destructive"> · {bad} linhas com erro (serão ignoradas)</span>}
            </div>
            <div className="max-h-64 overflow-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted"><tr>{["Job", "BI", "Ambiente", "Turno", "Ciclo", "Hora", "Resultado", "Obs.", ""].map((h) => <th key={h} className="p-1 text-left">{h}</th>)}</tr></thead>
                <tbody>
                  {rows.slice(0, 300).map((r, i) => (
                    <tr key={i} className={r.error ? "bg-destructive/10" : "border-t border-border"}>
                      <td className="p-1">{r.job_name}</td><td className="p-1">{r.bi_folder}</td><td className="p-1">{r.environment}</td>
                      <td className="p-1">{r.error ? "—" : shiftLabel(r.shift)}</td><td className="p-1">{r.cycle}</td><td className="p-1">{r.run_time}</td>
                      <td className="p-1">{r.result}</td><td className="p-1">{r.notes}</td><td className="p-1 text-destructive">{r.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 300 && <div className="p-1 text-xs text-muted-foreground">… mais {rows.length - 300} linhas</div>}
            </div>
          </>
        )}
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1"><input type="radio" checked={mode === "add"} onChange={() => setMode("add")} />Acrescentar aos jobs atuais</label>
          <label className="flex items-center gap-1"><input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} />Substituir jobs atuais ({existingIds.length})</label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={busy || !ok.length} onClick={save}>{busy ? "Importando…" : `Importar ${ok.length} jobs`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
