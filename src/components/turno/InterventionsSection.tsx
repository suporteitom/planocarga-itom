import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Copy, Plus, Settings2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { auditCreate, auditUpdate } from "@/lib/identity";
import { useInterventions, useMembers, useTypes, type Intervention } from "@/lib/data";
import { dtLocalToIso, fromSp, shiftWindow, spParts, type ShiftRef } from "@/lib/shifts";
import { cn } from "@/lib/utils";

export const STATUSES = [
  { key: "planejada", label: "Planejada", cls: "bg-info/15 text-info" },
  { key: "andamento", label: "Em andamento", cls: "bg-warning/20 text-foreground" },
  { key: "concluida", label: "Concluída", cls: "bg-success/15 text-success" },
  { key: "cancelada", label: "Cancelada", cls: "bg-muted text-muted-foreground line-through" },
];

type SortKey = "type" | "client" | "ticket" | "start_at";

export function InterventionsSection({ shiftRef, user }: { shiftRef: ShiftRef; user: string }) {
  const { data = [] } = useInterventions(shiftRef);
  const { data: types = [] } = useTypes();
  const { data: members = [] } = useMembers();
  const [fType, setFType] = useState("");
  const [fClient, setFClient] = useState("");
  const [fTicket, setFTicket] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; asc: boolean }>({ k: "start_at", asc: true });

  const rows = useMemo(() => {
    const r = data.filter(
      (i) =>
        (!fType || i.type === fType) &&
        (!fClient || (i.client ?? "").toLowerCase().includes(fClient.toLowerCase())) &&
        (!fTicket || (i.ticket ?? "").toLowerCase().includes(fTicket.toLowerCase())),
    );
    return r.sort((a, b) => {
      const va = (a[sort.k] ?? "") as string;
      const vb = (b[sort.k] ?? "") as string;
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sort.asc ? 1 : -1);
    });
  }, [data, fType, fClient, fTicket, sort]);

  const guard = () => {
    if (!user) toast.error("Escolha seu nome no topo antes de editar.");
    return !!user;
  };

  const save = async (id: string, patch: Partial<Intervention>) => {
    if (!guard()) return;
    const { error } = await supabase.from("interventions").update({ ...patch, ...auditUpdate(user) }).eq("id", id);
    if (error) toast.error("Erro ao salvar.");
  };

  const add = async () => {
    if (!guard()) return;
    const { start } = shiftWindow(shiftRef);
    const begin = Math.max(start.getTime(), Date.now() - (Date.now() % 1800000));
    const inShift = begin < shiftWindow(shiftRef).end.getTime() ? begin : start.getTime();
    await supabase.from("interventions").insert({ start_at: new Date(inShift).toISOString(), status: "planejada", ...auditCreate(user) });
  };

  const duplicate = async (i: Intervention) => {
    if (!guard()) return;
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = i;
    await supabase.from("interventions").insert({ ...rest, ...auditCreate(user) });
  };

  const remove = async (id: string) => {
    if (!guard()) return;
    if (confirm("Excluir esta intervenção?")) await supabase.from("interventions").delete().eq("id", id);
  };

  const Th = ({ k, children, className }: { k?: SortKey; children: ReactNode; className?: string }) => (
    <th className={cn("sticky top-0 whitespace-nowrap border-b border-r border-border bg-muted px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide", className)}>
      {k ? (
        <button className="inline-flex items-center gap-1" onClick={() => setSort({ k, asc: sort.k === k ? !sort.asc : true })}>
          {children} <ArrowUpDown className="h-3 w-3 opacity-50" />
        </button>
      ) : children}
    </th>
  );

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <h2 className="mr-auto text-sm font-semibold uppercase tracking-wide">Intervenções planejadas</h2>
        <select value={fType} onChange={(e) => setFType(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
          <option value="">Todos os tipos</option>
          {types.map((t) => <option key={t.id}>{t.name}</option>)}
        </select>
        <Input placeholder="Filtrar cliente" value={fClient} onChange={(e) => setFClient(e.target.value)} className="h-8 w-32 text-xs" />
        <Input placeholder="Filtrar ticket" value={fTicket} onChange={(e) => setFTicket(e.target.value)} className="h-8 w-28 text-xs" />
        <TypesDialog />
        <Button size="sm" onClick={add}><Plus className="mr-1 h-3.5 w-3.5" />Nova linha</Button>
      </header>
      <datalist id="members-list">{members.map((m) => <option key={m.id} value={m.name} />)}</datalist>
      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <Th k="type">Tipo</Th><Th k="client">Cliente</Th><Th k="start_at">Data</Th><Th k="ticket">Ticket</Th>
              <Th>Início</Th><Th>Fim previsto</Th><Th>E-mail (assunto)</Th><Th>Quem enviou</Th><Th>Envio</Th>
              <Th>Observações</Th><Th>Status</Th><Th className="border-r-0"> </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const st = STATUSES.find((s) => s.key === i.status) ?? STATUSES[0];
              const sp = spParts(i.start_at);
              return (
                <tr key={i.id} className="group hover:bg-accent/40" title={`Criado por ${i.created_by ?? "—"} em ${spParts(i.created_at).br} · alterado por ${i.updated_by ?? "—"} em ${spParts(i.updated_at).br}`}>
                  <Td>
                    <select value={i.type ?? ""} onChange={(e) => save(i.id, { type: e.target.value || null })} className="w-28 bg-transparent outline-none">
                      <option value="">—</option>
                      {types.map((t) => <option key={t.id}>{t.name}</option>)}
                      {i.type && !types.some((t) => t.name === i.type) && <option>{i.type}</option>}
                    </select>
                  </Td>
                  <Td><Cell value={i.client} onCommit={(v) => save(i.id, { client: v })} className="w-28" /></Td>
                  <Td><Cell type="date" value={sp.date} onCommit={(v) => v && save(i.id, { start_at: fromSp(v, sp.time).toISOString() })} className="w-32 font-mono" /></Td>
                  <Td><Cell value={i.ticket} onCommit={(v) => save(i.id, { ticket: v })} className="w-24 font-mono" /></Td>
                  <Td><Cell type="time" value={sp.time} onCommit={(v) => v && save(i.id, { start_at: fromSp(sp.date, v).toISOString() })} className="w-20 font-mono" /></Td>
                  <Td><Cell type="datetime-local" value={spParts(i.end_at).dt} onCommit={(v) => save(i.id, { end_at: dtLocalToIso(v ?? "") })} className="w-44 font-mono" /></Td>
                  <Td><Cell value={i.email_subject} onCommit={(v) => save(i.id, { email_subject: v })} className="w-48" /></Td>
                  <Td><Cell value={i.sent_by} list="members-list" onCommit={(v) => save(i.id, { sent_by: v })} className="w-28" /></Td>
                  <Td><Cell type="datetime-local" value={spParts(i.sent_at).dt} onCommit={(v) => save(i.id, { sent_at: dtLocalToIso(v ?? "") })} className="w-44 font-mono" /></Td>
                  <Td><Cell value={i.notes} onCommit={(v) => save(i.id, { notes: v })} className="w-56" /></Td>
                  <Td>
                    <select value={i.status} onChange={(e) => save(i.id, { status: e.target.value })} className={cn("rounded px-1.5 py-0.5 font-medium outline-none", st.cls)}>
                      {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </Td>
                  <td className="whitespace-nowrap border-b border-border px-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" title="Duplicar" onClick={() => duplicate(i)}><Copy className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" title="Excluir" onClick={() => remove(i.id)}><Trash2 className="h-3 w-3" /></Button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={12} className="p-6 text-center text-sm text-muted-foreground">Nenhuma intervenção neste turno.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const Td = ({ children }: { children: ReactNode }) => (
  <td className="border-b border-r border-border px-1.5 py-1 align-middle">{children}</td>
);

function Cell({ value, onCommit, type = "text", className, list }: { value: string | null; onCommit: (v: string | null) => void; type?: string; className?: string; list?: string }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  return (
    <input
      type={type}
      list={list}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== (value ?? "") && onCommit(v.trim() === "" ? null : v)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={cn("rounded-sm bg-transparent px-1 py-0.5 outline-none focus:bg-background focus:ring-1 focus:ring-ring", className)}
    />
  );
}

function TypesDialog() {
  const { data: types = [] } = useTypes();
  const [name, setName] = useState("");
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Settings2 className="mr-1 h-3.5 w-3.5" />Tipos</Button></DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Tipos de intervenção</DialogTitle></DialogHeader>
        <ul className="grid gap-1">
          {types.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded border border-border px-2 py-1 text-sm">
              {t.name}
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => supabase.from("intervention_types").delete().eq("id", t.id)}><X className="h-3 w-3" /></Button>
            </li>
          ))}
        </ul>
        <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; await supabase.from("intervention_types").insert({ name: name.trim() }); setName(""); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Novo tipo" />
          <Button type="submit">Adicionar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
