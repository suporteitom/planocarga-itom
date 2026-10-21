import { useEffect, useState } from "react";

// Filtros que sobrevivem à troca de abas. Chave inclui o turno: outro turno = filtros novos.
const store = new Map<string, unknown>();

export function usePersistentFilter<T>(key: string, initial: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => (store.has(key) ? (store.get(key) as T) : initial));
  useEffect(() => {
    setVal(store.has(key) ? (store.get(key) as T) : initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = (v: T) => {
    store.set(key, v);
    setVal(v);
  };
  return [val, set];
}

/** Limpa os filtros de um turno (chamado ao encerrar o turno). */
export function clearFilters(shiftKey: string) {
  for (const k of [...store.keys()]) if (k.endsWith(`:${shiftKey}`)) store.delete(k);
}

export const shiftFilterKey = (date: string, shift: string) => `${date}_${shift}`;
