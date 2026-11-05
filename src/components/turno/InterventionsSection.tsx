import { AutoTextarea } from "./AutoTextarea";
import type React from "react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, Check, Copy, Download, Paperclip, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import { parseMsgFile, typeFromEmail, windowFromBody } from "@/lib/emailImport";

async function downloadEmail(path: string, name: string) {
  const { data, error } = await supabase.storage.from("intervention-emails").download(path);
  if (error || !data) { toast.error("Não foi possível baixar o e-mail."); return; }
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { auditCreate, auditUpdate } from "@/lib/identity";
import { useInterventions, useTypes, type Intervention } from "@/lib/data";
import { useTeam } from "@/components/turno/NamePicker";
import { addDays, dtLocalToIso, fromSp, shiftWindow, spParts, type ShiftRef } from "@/lib/shifts";
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
  const { data: members = [] } = useTeam();
  const [fType, setFType] = useState("");
  const [fClient, setFClient] = useState("");
  const [fTicket, setFTicket] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; asc: boolean }>({ k: "start_at", asc: true });

  const rows = useMemo(() => {
    const r = data.filter(
      (i) =>
        (i.status !== "concluida" || !i.concluded_at || (
          spParts(i.concluded_at).date === shiftRef.date &&
          spParts(i.concluded_at).date <= spParts(i.start_at).date
        )) &&
        (!fType || i.type === fType) &&
        (!fClient || (i.client ?? "").toLowerCase().includes(fClient.toLowerCase())) &&
        (!fTicket || (i.ticket ?? "").toLowerCase().includes(fTicket.toLowerCase())),
    );
    return r.sort((a, b) => {
      const va = (a[sort.k] ?? "") as string;
      const vb = (b[sort.k] ?? "") as string;
      return (va < vb ? -1 : va > vb ? 1 : 0) * (sort.asc ? 1 : -1);
    });
  }, [data, fType, fClient, fTicket, sort, shiftRef.date]);

  const guard = () => {
    if (!user) toast.error("Escolha seu nome no topo antes de editar.");
    return !!user;
  };

  const qc = useQueryClient();
  const [draftNew, setDraftNew] = useState<Partial<Intervention> | null>(null);

  const ensureType = async (name: string | null | undefined) => {
    if (name && !types.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      await supabase.from("intervention_types").insert({ name });
      qc.invalidateQueries({ queryKey: ["types"] });
    }
  };

  const save = async (id: string, patch: Partial<Intervention>) => {
    if (!guard()) return false;
    await ensureType(patch.type);
    const { error } = await supabase.from("interventions").update({ ...patch, ...auditUpdate(user) }).eq("id", id);
    if (error) { toast.error("Erro ao salvar."); return false; }
    qc.invalidateQueries({ queryKey: ["interventions"] });
    toast.success("Intervenção atualizada.");
    return true;
  };

  const add = () => {
    if (!guard()) return;
    const { start, end } = shiftWindow(shiftRef);
    const begin = Math.max(start.getTime(), Date.now() - (Date.now() % 1800000));
    const inShift = begin < end.getTime() ? begin : start.getTime();
    setDraftNew({ start_at: new Date(inShift).toISOString(), status: "planejada" });
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const addFromEmail = async (file: File) => {
    if (!guard()) return;
    try {
      const em = await parseMsgFile(file);
      const { start, end } = shiftWindow(shiftRef);
      const begin = Math.max(start.getTime(), Date.now() - (Date.now() % 1800000));
      const w = windowFromBody(em.body ?? "");
      let startAt = new Date(begin < end.getTime() ? begin : start.getTime()).toISOString();
      let endAt: string | null = null;
      if (w.date) {
        const s = w.start ?? "00:00";
        startAt = fromSp(w.date, s).toISOString();
        if (w.end) endAt = fromSp(w.end < s ? addDays(w.date, 1) : w.date, w.end).toISOString();
      }
      setPendingFile(file);
      setDraftNew({
        start_at: startAt, end_at: endAt,
        status: "planejada", type: typeFromEmail(em.subject, em.body ?? ""), client: em.client, email_subject: em.subject,
        sent_by: em.sender, sent_at: em.sentAt, attachment_name: file.name,
      });
      if (!w.date) toast.info("Data da intervenção não encontrada no e-mail — preencha à mão.");
    } catch (e) {
      console.error("Erro ao ler .msg:", e);
      toast.error("Não foi possível ler o e-mail (.msg).");
    }
  };

  const insertNew = async (patch: Partial<Intervention>) => {
    if (!guard()) return false;
    if (pendingFile) {
      const path = `${crypto.randomUUID()}/${pendingFile.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("intervention-emails").upload(path, pendingFile, { contentType: "application/vnd.ms-outlook" });
      if (upErr) { toast.error("Erro ao enviar o anexo."); return false; }
      patch = { ...patch, attachment_path: path, attachment_name: pendingFile.name };
    }
    await ensureType(patch.type);
    const { error } = await supabase.from("interventions").insert({ ...(patch as { start_at: string }), ...auditCreate(user) });
    if (error) { toast.error("Erro ao salvar."); return false; }
    setDraftNew(null);
    setPendingFile(null);
    qc.invalidateQueries({ queryKey: ["interventions"] });
    toast.success("Intervenção adicionada.");
    return true;
  };

  const duplicate = async (i: Intervention) => {
    if (!guard()) return;
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = i;
    await supabase.from("interventions").insert({ ...rest, ...auditCreate(user) });
    qc.invalidateQueries({ queryKey: ["interventions"] });
  };

  const remove = async (id: string) => {
    if (!guard()) return;
    if (!isAdmin) { toast.error("Apenas administradores podem excluir intervenções."); return; }
    if (confirm("Excluir esta intervenção?")) {
      const { error } = await supabase.from("interventions").delete().eq("id", id);
      if (error) { toast.error("Não foi possível excluir."); return; }
      qc.invalidateQueries({ queryKey: ["interventions"] });
    }
  };

  const Th = ({ k, children, className }: { k?: SortKey; children: ReactNode; className?: string }) => (
    <th className={cn("sticky top-0 z-10 whitespace-nowrap border-b border-r border-border bg-muted px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide", className)}>
      {k ? (
        <button className="inline-flex items-center gap-1" onClick={() => setSort({ k, asc: sort.k === k ? !sort.asc : true })}>
          {children} <ArrowUpDown className="h-3 w-3 opacity-50" />
        </button>
      ) : children}
    </th>
  );

  return (
    <section
      className="relative min-w-0 rounded-lg border border-border bg-card"
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; if (!dragging) setDragging(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
      onDrop={(e) => {
        e.preventDefault(); setDragging(false);
        const f = Array.from(e.dataTransfer.files).find((x) => x.name.toLowerCase().endsWith(".msg"));
        if (!f) { toast.error("Solte um e-mail do Outlook (.msg)."); return; }
        if (draftNew) { toast.error("Confirme ou cancele a linha em edição primeiro."); return; }
        addFromEmail(f);
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/85 text-sm font-semibold text-primary">
          Solte o e-mail (.msg) aqui para criar a intervenção
        </div>
      )}
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <h2 className="mr-auto text-sm font-semibold uppercase tracking-wide">Intervenções planejadas</h2>
        <select value={fType} onChange={(e) => setFType(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
          <option value="">Todos os tipos</option>
          {types.map((t) => <option key={t.id}>{t.name}</option>)}
        </select>
        <Input placeholder="Filtrar cliente" value={fClient} onChange={(e) => setFClient(e.target.value)} className="h-8 w-32 text-xs" />
        <Input placeholder="Filtrar ticket" value={fTicket} onChange={(e) => setFTicket(e.target.value)} className="h-8 w-28 text-xs" />
        <TypesDialog />
        <Button size="sm" onClick={add} disabled={!!draftNew}><Plus className="mr-1 h-3.5 w-3.5" />Nova linha</Button>
        <input ref={fileRef} type="file" accept=".msg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) addFromEmail(f); }} />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={!!draftNew}><Paperclip className="mr-1 h-3.5 w-3.5" />Nova linha com e-mail</Button>
      </header>
      <datalist id="members-list">{members.map((m) => <option key={m.id} value={m.name} />)}</datalist>
      <datalist id="types-list">{types.map((t) => <option key={t.id} value={t.name} />)}</datalist>
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
            {draftNew && (
              <Row key="new" item={draftNew} isNew shiftDate={shiftRef.date} onSave={insertNew} onCancel={() => { setDraftNew(null); setPendingFile(null); }} />
            )}
            {rows.map((i) => (
              <Row key={i.id} item={i} shiftDate={shiftRef.date} onSave={(p) => save(i.id, p)} onDuplicate={() => duplicate(i)} onRemove={isAdmin ? () => remove(i.id) : undefined} />
            ))}
            {rows.length === 0 && !draftNew && (
              <tr><td colSpan={12} className="p-6 text-center text-sm text-muted-foreground">Nenhuma intervenção cadastrada.</td></tr>
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

const FIELDS = ["type", "client", "ticket", "start_at", "end_at", "email_subject", "sent_by", "sent_at", "notes", "status"] as const;

function Row({ item, isNew, shiftDate, onSave, onCancel, onDuplicate, onRemove }: {
  item: Partial<Intervention>; isNew?: boolean; shiftDate: string;
  onSave: (patch: Partial<Intervention>) => Promise<boolean>;
  onCancel?: () => void; onDuplicate?: () => void; onRemove?: () => void;
}) {
  const [editing, setEditing] = useState(!!isNew);
  const [d, setD] = useState<Partial<Intervention>>(item);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!editing) setD(item); }, [item, editing]);

  const set = (patch: Partial<Intervention>) => { setD((x) => ({ ...x, ...patch })); setEditing(true); };
  const sp = spParts(d.start_at ?? new Date().toISOString());
  const st = STATUSES.find((s) => s.key === d.status) ?? STATUSES[0]!;
  const nn = (v: string) => (v.trim() === "" ? null : v);

  const confirmSave = async () => {
    const patch: Partial<Intervention> = {};
    for (const k of FIELDS) {
      const v = d[k] ?? null;
      if (isNew || v !== (item[k] ?? null)) (patch as Record<string, unknown>)[k] = typeof v === "string" ? v.trim() || null : v;
    }
    if (!isNew && Object.keys(patch).length === 0) { setEditing(false); return; }
    if (isNew && !patch.start_at) { toast.error("Informe a data e o início."); return; }
    setBusy(true);
    const ok = await onSave(patch);
    setBusy(false);
    if (ok) setEditing(false);
  };
  const cancel = () => { setD(item); setEditing(false); onCancel?.(); };

  const cellProps = {
    readOnly: !editing,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter") { e.preventDefault(); confirmSave(); }
      if (e.key === "Escape") cancel();
    },
  };

  return (
    <tr
      className={cn("group", editing ? "bg-warning/10 outline outline-1 outline-warning" : "hover:bg-accent/40")}
      title={isNew ? "Nova intervenção (não salva)" : `Criado por ${item.created_by ?? "—"} em ${spParts(item.created_at ?? null).br} · alterado por ${item.updated_by ?? "—"} em ${spParts(item.updated_at ?? null).br}`}
    >
      <Td><Cell {...cellProps} value={d.type ?? ""} list="types-list" onChange={(v) => set({ type: nn(v) })} className="w-28" /></Td>
      <Td><Cell {...cellProps} value={d.client ?? ""} onChange={(v) => set({ client: nn(v) })} className="w-28" /></Td>
      <Td><Cell {...cellProps} type="date" value={sp.date} onChange={(v) => v && set({ start_at: fromSp(v, sp.time).toISOString() })} className={cn("w-32 font-mono", sp.date === shiftDate && "bg-warning font-semibold text-warning-foreground")} /></Td>
      <Td><Cell {...cellProps} value={d.ticket ?? ""} onChange={(v) => set({ ticket: nn(v) })} className="w-24 font-mono" /></Td>
      <Td><Cell {...cellProps} type="time" value={sp.time} onChange={(v) => v && set({ start_at: fromSp(sp.date, v).toISOString() })} className="w-20 font-mono" /></Td>
      <Td><Cell {...cellProps} type="time" value={d.end_at ? spParts(d.end_at).time : ""} onChange={(v) => {
        if (!v) return set({ end_at: null });
        const date = v < sp.time ? addDays(sp.date, 1) : sp.date;
        set({ end_at: fromSp(date, v).toISOString() });
      }} className="w-20 font-mono" /></Td>
      <Td>
        <div className="flex items-center gap-1">
          <Cell {...cellProps} value={d.email_subject ?? ""} onChange={(v) => set({ email_subject: nn(v) })} className="w-48" />
          {d.attachment_name && (
            <button
              type="button"
              title={item.attachment_path ? `Baixar ${d.attachment_name}` : `${d.attachment_name} (será anexado ao confirmar)`}
              className="shrink-0 text-primary hover:opacity-70 disabled:opacity-50"
              disabled={!item.attachment_path}
              onClick={() => item.attachment_path && downloadEmail(item.attachment_path, item.attachment_name ?? "email.msg")}
            >
              {item.attachment_path ? <Download className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </Td>
      <Td><Cell {...cellProps} value={d.sent_by ?? ""} list="members-list" onChange={(v) => set({ sent_by: nn(v) })} className="w-28" /></Td>
      <Td><Cell {...cellProps} type="datetime-local" value={spParts(d.sent_at ?? null).dt} onChange={(v) => set({ sent_at: dtLocalToIso(v) })} className="w-44 font-mono" /></Td>
      <Td>
        <AutoTextarea
          value={d.notes ?? ""}
          readOnly={!editing}
          tabIndex={!editing ? -1 : undefined}
          onChange={(e) => set({ notes: nn(e.target.value) })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); confirmSave(); }
            if (e.key === "Escape") cancel();
          }}
          className={cn("w-56 rounded-sm bg-transparent px-1 py-0.5 outline-none", !editing ? "cursor-default" : "bg-background ring-1 ring-ring/40 focus:ring-ring")}
        />
      </Td>
      <Td>
        <select value={d.status ?? "planejada"} disabled={busy} onChange={async (e) => {
          const v = e.target.value;
          if (editing) return set({ status: v });
          setD((x) => ({ ...x, status: v }));
          setBusy(true);
          const ok = await onSave({ status: v });
          setBusy(false);
          if (!ok) setD(item);
        }} className={cn("cursor-pointer rounded px-1.5 py-0.5 font-medium outline-none", st.cls)}>
          {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </Td>
      <td className="whitespace-nowrap border-b border-border px-1">
        {editing ? (
          <>
            <Button size="icon" className="h-6 w-6 bg-success text-primary-foreground hover:bg-success/90" title="Confirmar" disabled={busy} onClick={confirmSave}><Check className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="ml-1 h-6 w-6" title="Cancelar" disabled={busy} onClick={cancel}><X className="h-3.5 w-3.5" /></Button>
          </>
        ) : (
          <>
            <Button size="icon" variant="ghost" className="h-6 w-6" title="Editar" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" title="Duplicar" onClick={onDuplicate}><Copy className="h-3 w-3" /></Button>
            {onRemove && <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" title="Excluir" onClick={onRemove}><Trash2 className="h-3 w-3" /></Button>}
          </>
        )}
      </td>
    </tr>
  );
}

function Cell({ value, onChange, type = "text", className, list, readOnly, onKeyDown }: {
  value: string; onChange: (v: string) => void; type?: string; className?: string; list?: string;
  readOnly?: boolean; onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  return (
    <input
      type={type}
      list={list}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      tabIndex={readOnly ? -1 : undefined}
      onKeyDown={onKeyDown}
      className={cn("rounded-sm bg-transparent px-1 py-0.5 outline-none", readOnly ? "cursor-default" : "bg-background ring-1 ring-ring/40 focus:ring-ring", className)}
    />
  );
}

function TypesDialog() {
  const { data: types = [] } = useTypes();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const del = async (id: string, n: string) => {
    setBusy(id);
    const { error } = await supabase.from("intervention_types").delete().eq("id", id);
    setBusy(null);
    if (error) { toast.error("Não foi possível excluir o tipo."); return; }
    await qc.invalidateQueries({ queryKey: ["types"] });
    toast.success(`Tipo "${n}" removido.`);
  };
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Settings2 className="mr-1 h-3.5 w-3.5" />Tipos</Button></DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Tipos de intervenção</DialogTitle></DialogHeader>
        <ul className="grid gap-1">
          {types.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded border border-border px-2 py-1 text-sm">
              {t.name}
              <Button type="button" size="icon" variant="ghost" className="h-6 w-6" disabled={busy === t.id} title="Excluir tipo" onClick={() => del(t.id, t.name)}><X className="h-3 w-3" /></Button>
            </li>
          ))}
        </ul>
        <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; const { error } = await supabase.from("intervention_types").insert({ name: name.trim() }); if (error) { toast.error("Não foi possível adicionar (talvez já exista)."); return; } setName(""); qc.invalidateQueries({ queryKey: ["types"] }); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Novo tipo" />
          <Button type="submit">Adicionar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
