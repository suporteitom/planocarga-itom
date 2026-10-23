import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Identidade = conta conectada. Nome vem do cadastro (área de Contas). */
export function useCurrentUser() {
  const [name, setNameState] = useState("");
  useEffect(() => {
    const apply = (u: { email?: string; user_metadata?: Record<string, unknown> } | null | undefined) =>
      setNameState(((u?.user_metadata?.["name"] as string) || (u?.email ?? "").split("@")[0] || "").trim());
    supabase.auth.getUser().then(({ data }) => apply(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => apply(s?.user));
    return () => sub.subscription.unsubscribe();
  }, []);
  return { name, setName: (_: string) => {} };
}

export const auditCreate = (name: string) => ({ created_by: name, updated_by: name });
export const auditUpdate = (name: string) => ({ updated_by: name, updated_at: new Date().toISOString() });
