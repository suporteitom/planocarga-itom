import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { shiftWindow, type ShiftRef } from "./shifts";

export type Member = Tables<"members">;
export type Message = Tables<"messages">;
export type Intervention = Tables<"interventions">;
export type InterventionType = Tables<"intervention_types">;

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export async function ensureMember(name: string) {
  const n = name.trim();
  if (!n) return;
  await supabase.from("members").upsert({ name: n }, { onConflict: "name", ignoreDuplicates: true });
}

export function useTypes() {
  return useQuery({
    queryKey: ["types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("intervention_types").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useAttendance(ref: ShiftRef) {
  return useQuery({
    queryKey: ["attendance", ref.date, ref.shift],
    queryFn: async () => {
      const { data: shift } = await supabase
        .from("shifts")
        .select("id, shift_attendance(*)")
        .eq("shift_date", ref.date)
        .eq("shift", ref.shift)
        .maybeSingle();
      return { shiftId: shift?.id ?? null, people: shift?.shift_attendance ?? [] };
    },
  });
}

export async function getOrCreateShift(ref: ShiftRef, by: string) {
  const { data } = await supabase
    .from("shifts")
    .upsert({ shift_date: ref.date, shift: ref.shift, created_by: by }, { onConflict: "shift_date,shift" })
    .select("id")
    .single();
  return data!.id;
}

/** Recados do turno + recados em aberto de turnos anteriores. */
export function useMessages(ref: ShiftRef) {
  return useQuery({
    queryKey: ["messages", ref.date, ref.shift],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("category", "recados")
        .or(`and(shift_date.eq.${ref.date},shift.eq.${ref.shift}),status.eq.aberto`)
        .order("occurred_at", { ascending: true });
      if (error) throw error;
      const cur = shiftWindow(ref).start.getTime();
      const own: Message[] = [];
      const carried: Message[] = [];
      for (const m of data) {
        if (m.shift_date === ref.date && m.shift === ref.shift) own.push(m);
        else if (shiftWindow({ date: m.shift_date, shift: m.shift as ShiftRef["shift"] }).start.getTime() < cur)
          carried.push(m);
      }
      return { own, carried };
    },
  });
}

/** Todas as intervenções, sem filtro por turno/dia. */
export function useInterventions(_ref?: ShiftRef) {
  return useQuery({
    queryKey: ["interventions", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interventions")
        .select("*")
        .order("start_at");
      if (error) throw error;
      return data;
    },
  });
}

/** Tempo real: qualquer mudança nas tabelas atualiza a tela de todos. */
export function useRealtimeSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const map: Record<string, string[]> = {
      members: ["members"],
      intervention_types: ["types"],
      shifts: ["attendance"],
      shift_attendance: ["attendance"],
      messages: ["messages"],
      interventions: ["interventions"],
    };
    let ch = supabase.channel("passagem-turno");
    for (const table of Object.keys(map)) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        map[table]!.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      });
    }
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
}
