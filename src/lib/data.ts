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
        .select("id, status, started_at, started_by, closed_at, closed_by, shift_attendance(*)")
        .eq("shift_date", ref.date)
        .eq("shift", ref.shift)
        .maybeSingle();
      return {
        shiftId: shift?.id ?? null,
        people: shift?.shift_attendance ?? [],
        status: (shift?.status ?? "pendente") as "pendente" | "em_andamento" | "encerrado",
        startedAt: shift?.started_at ?? null,
        startedBy: shift?.started_by ?? null,
        closedAt: shift?.closed_at ?? null,
        closedBy: shift?.closed_by ?? null,
      };
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

export async function setShiftStatus(ref: ShiftRef, status: "pendente" | "em_andamento" | "encerrado", by: string) {
  const id = await getOrCreateShift(ref, by);
  const now = new Date().toISOString();
  const patch =
    status === "em_andamento"
      ? { status, started_at: now, started_by: by, closed_at: null, closed_by: null }
      : status === "encerrado"
        ? { status, closed_at: now, closed_by: by }
        : { status };
  const { error } = await supabase.from("shifts").update(patch).eq("id", id);
  if (error) throw error;
}

/** Recados do turno + recados em aberto de turnos anteriores. */
export function useMessages(_ref?: ShiftRef, category: string = "recados") {
  return useQuery({
    queryKey: ["messages", category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("category", category)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return { own: data as Message[], carried: [] as Message[] };
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
      task_templates: ["tasks"],
      task_results: ["tasks"],
      job_templates: ["jobs"],
      job_results: ["jobs"],
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

export type TaskTemplate = Tables<"task_templates">;
export type TaskResult = Tables<"task_results">;

export function useTasks(date: string) {
  return useQuery({
    queryKey: ["tasks", date],
    queryFn: async () => {
      const [t, r] = await Promise.all([
        supabase.from("task_templates").select("*").eq("active", true).order("category").order("sort").order("time_start"),
        supabase.from("task_results").select("*").eq("shift_date", date),
      ]);
      if (t.error) throw t.error;
      if (r.error) throw r.error;
      return { templates: t.data, results: r.data };
    },
  });
}

export type JobTemplate = Tables<"job_templates">;
export type JobResult = Tables<"job_results">;

export function useJobs(date: string) {
  return useQuery({
    queryKey: ["jobs", date],
    queryFn: async () => {
      const [t, r] = await Promise.all([
        supabase.from("job_templates").select("*").eq("active", true).order("sort").range(0, 4999),
        supabase.from("job_results").select("*").eq("shift_date", date).range(0, 4999),
      ]);
      if (t.error) throw t.error;
      if (r.error) throw r.error;
      return { templates: t.data, results: r.data };
    },
  });
}
