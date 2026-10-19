import { ChevronLeft, ChevronRight, Clock, Download, Lock, Play, RotateCcw, Square, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NamePicker } from "./NamePicker";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateShift, setShiftStatus, useAttendance } from "@/lib/data";
import { SHIFTS, nextShift, prevShift, shiftOf, type ShiftKey, type ShiftRef } from "@/lib/shifts";

export function ShiftHeader({
  shiftRef,
  setShiftRef,
  user,
  counts,
  onExport,
}: {
  shiftRef: ShiftRef;
  setShiftRef: (r: ShiftRef) => void;
  user: string;
  counts: { messages: number; carried: number; interventions: number };
  onExport: () => void;
}) {
  const qc = useQueryClient();
  const { data } = useAttendance(shiftRef);
  const people = data?.people ?? [];
  const status = data?.status ?? "pendente";
  const canEditTeam = status === "em_andamento";
  const now = shiftOf();
  const isCurrent = now.date === shiftRef.date && now.shift === shiftRef.shift;
  const hasSomething = counts.messages + counts.interventions > 0;
  const fmt = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

  const changeStatus = async (s: "em_andamento" | "encerrado") => {
    if (!user) { toast.error("Escolha seu nome no topo antes de editar."); return; }
    try {
      await setShiftStatus(shiftRef, s, user);
      if (s === "em_andamento" && status === "pendente" && !people.some((p) => p.member_name === user)) {
        const id = await getOrCreateShift(shiftRef, user);
        await supabase.from("shift_attendance").insert({ shift_id: id, member_name: user, created_by: user });
      }
      await qc.invalidateQueries({ queryKey: ["attendance"] });
    } catch {
      toast.error("Não foi possível alterar o turno.");
    }
  };

  const addPerson = async (name: string) => {
    if (!user) { toast.error("Escolha seu nome no topo antes de editar."); return; }
    const id = data?.shiftId ?? (await getOrCreateShift(shiftRef, user));
    const { error } = await supabase.from("shift_attendance").insert({ shift_id: id, member_name: name, created_by: user });
    if (error && !error.message.includes("duplicate")) toast.error("Não foi possível adicionar.");
    qc.invalidateQueries({ queryKey: ["attendance"] });
  };
  const removePerson = async (id: string) => {
    if (!user) { toast.error("Escolha seu nome no topo antes de editar."); return; }
    await supabase.from("shift_attendance").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["attendance"] });
  };

  return (
    <div className="grid gap-3 border-b border-border bg-card p-3 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-6 md:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShiftRef(prevShift(shiftRef))} aria-label="Turno anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input
          type="date"
          value={shiftRef.date}
          onChange={(e) => e.target.value && setShiftRef({ ...shiftRef, date: e.target.value })}
          className="h-8 w-[9.5rem] font-mono text-sm"
        />
        <Select value={shiftRef.shift} onValueChange={(v) => setShiftRef({ ...shiftRef, shift: v as ShiftKey })}>
          <SelectTrigger className="h-8 w-[11rem]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SHIFTS.map((s) => (
              <SelectItem key={s.key} value={s.key}>{s.label} <span className="ml-1 font-mono text-xs text-muted-foreground">{s.hours}</span></SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShiftRef(nextShift(shiftRef))} aria-label="Próximo turno">
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isCurrent && (
          <Button variant="ghost" size="sm" className="h-8" onClick={() => setShiftRef(now)}>
            <Clock className="mr-1 h-3.5 w-3.5" /> Turno atual
          </Button>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {status === "pendente" && (
            <Button size="sm" className="h-7 bg-success text-primary-foreground hover:bg-success/90" onClick={() => changeStatus("em_andamento")}>
              <Play className="mr-1 h-3.5 w-3.5" /> Iniciar turno
            </Button>
          )}
          {status === "em_andamento" && (
            <>
              <Badge className="bg-success/20 text-foreground hover:bg-success/20">
                Em andamento · iniciado {fmt(data?.startedAt)} por {data?.startedBy}
              </Badge>
              <Button size="sm" variant="destructive" className="h-7" onClick={() => { if (confirm("Encerrar este turno? Os registros ficarão bloqueados.")) changeStatus("encerrado"); }}>
                <Square className="mr-1 h-3.5 w-3.5" /> Fechar turno
              </Button>
            </>
          )}
          {status === "encerrado" && (
            <>
              <Badge variant="secondary">
                <Lock className="mr-1 h-3 w-3" /> Encerrado {fmt(data?.closedAt)} por {data?.closedBy}
              </Badge>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => changeStatus("em_andamento")}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reabrir turno
              </Button>
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Equipe em turno</span>
          {people.map((p) => (
            <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
              {p.member_name}
              {canEditTeam && (
                <button onClick={() => removePerson(p.id)} className="rounded hover:bg-background/60" aria-label={`Remover ${p.member_name}`}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
          {canEditTeam ? (
            <NamePicker placeholder="+ Adicionar" onSelect={addPerson} exclude={people.map((p) => p.member_name)} className="h-7 w-32" />
          ) : status === "pendente" ? (
            <span className="text-xs italic text-muted-foreground">Inicie o turno para registrar a equipe</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          className={
            "rounded-md border px-3 py-1.5 text-xs " +
            (hasSomething ? "border-warning bg-warning/15 text-foreground" : "border-border text-muted-foreground")
          }
        >
          {hasSomething ? "Já existe registro neste turno: " : "Nada registrado ainda: "}
          <b className="font-mono">{counts.messages}</b> recados
          {counts.carried > 0 && <> (<b className="font-mono">{counts.carried}</b> pendentes)</>} ·{" "}
          <b className="font-mono">{counts.interventions}</b> intervenções
        </div>
      </div>
    </div>
  );
}
