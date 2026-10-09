import { useEffect, useState } from "react";

/**
 * Identidade do usuário atual. Nesta versão (sem login) é apenas um nome escolhido
 * e guardado no navegador. Para adicionar login depois, troque a implementação
 * deste hook para ler o usuário autenticado — o restante do app só usa `name`.
 */
const KEY = "pt-current-user";
const listeners = new Set<(n: string) => void>();

export function useCurrentUser() {
  const [name, setNameState] = useState("");
  useEffect(() => {
    setNameState(localStorage.getItem(KEY) ?? "");
    const fn = (n: string) => setNameState(n);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  const setName = (n: string) => {
    localStorage.setItem(KEY, n);
    listeners.forEach((l) => l(n));
  };
  return { name, setName };
}

export const auditCreate = (name: string) => ({ created_by: name, updated_by: name });
export const auditUpdate = (name: string) => ({ updated_by: name, updated_at: new Date().toISOString() });
