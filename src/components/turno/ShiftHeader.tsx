import { ChevronLeft, ChevronRight, Clock, Download, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NamePicker } from "./NamePicker";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateShift, useAttendance } from "@/lib/data";
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
  const { data } = useAttendance(shiftRef);
  const people = data?.people ?? [];
  const now = shiftOf();
  const isCurrent = now.date === shiftRef.date && now.shift === shiftRef.shift;
  const hasSomething = counts.messages + counts.interventions > 0;

  const addPerson = async (name: string) => {
    if (!user) return toast.error("Escolha seu nome no topo antes de editar.");
    const id = data?.shiftId ?? (await getOrCreateShift(shiftRef, user));
    const { error } = await supabase.from("shift_attendance").insert({ shift_id: id, member_name: name, created_by: user });
    if (error && !error.message.includes("duplicate")) toast.error("Não foi possível adicionar.");
  };
  const removePerson = async (id: string) => {
    if (!user) return toast.error("Escolha seu nome no topo antes de editar.");
    await supabase.from("shift_attendance").delete().eq("id", id);
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

      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Equipe em turno</span>
        {people.map((p) => (
          <Badge key={p.id} variant="secondary" className="gap-1 pr-1">
            {p.member_name}
            <button onClick={() => removePerson(p.id)} className="rounded hover:bg-background/60" aria-label={`Remover ${p.member_name}`}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <NamePicker placeholder="+ Adicionar" onSelect={addPerson} exclude={people.map((p) => p.member_name)} className="h-7 w-32" />
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
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="mr-1 h-3.5 w-3.5" /> Excel do turno
        </Button>
      </div>
    </div>
  );
}
