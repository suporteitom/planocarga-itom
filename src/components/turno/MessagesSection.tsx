import { useState } from "react";
import { AlertTriangle, Check, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NamePicker } from "./NamePicker";
import { supabase } from "@/integrations/supabase/client";
import { auditCreate, auditUpdate } from "@/lib/identity";
import { useMessages, type Message } from "@/lib/data";
import { brDate, dtLocalToIso, shiftLabel, spParts, type ShiftRef } from "@/lib/shifts";
import { cn } from "@/lib/utils";

export function MessagesSection({ shiftRef, user }: { shiftRef: ShiftRef; user: string }) {
  const { data } = useMessages(shiftRef);
  const [body, setBody] = useState("");
  const [important, setImportant] = useState(false);
  const [when, setWhen] = useState("");
  const [author, setAuthor] = useState("");

  const add = async () => {
    if (!user) { toast.error("Escolha seu nome no topo antes de registrar."); return; }
    if (!body.trim()) { return; }
    const { error } = await supabase.from("messages").insert({
      category: "recados",
      shift_date: shiftRef.date,
      shift: shiftRef.shift,
      body: body.trim(),
      importance: important ? "importante" : "normal",
      occurred_at: dtLocalToIso(when) ?? new Date().toISOString(),
      author: author || user,
      ...auditCreate(user),
    });
    if (error) { toast.error("Erro ao salvar recado."); return; }
    setBody("");
    setImportant(false);
    setWhen("");
  };

  const carried = data?.carried ?? [];
  const own = data?.own ?? [];

  return (
    <section className="min-w-0 rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Recados</h2>
        <span className="font-mono text-xs text-muted-foreground">{own.length} no turno · {carried.length} pendentes</span>
      </header>

      <div className="grid gap-2 border-b border-border p-3">
        <Textarea
          placeholder="O que aconteceu? (Ctrl+Enter para salvar)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && add()}
          rows={2}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-8 w-auto font-mono text-xs" title="Data/hora (vazio = agora)" />
          <NamePicker value={author || user} onSelect={setAuthor} placeholder="Autor" className="h-8 w-40" />
          <Button type="button" size="sm" variant={important ? "default" : "outline"} className={cn(important && "bg-destructive text-destructive-foreground hover:bg-destructive/90")} onClick={() => setImportant(!important)}>
            <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Importante
          </Button>
          <Button size="sm" onClick={add} disabled={!body.trim()} className="ml-auto">Adicionar recado</Button>
        </div>
      </div>

      <ul className="divide-y divide-border">
        {carried.map((m) => <MessageRow key={m.id} m={m} user={user} carried />)}
        {own.map((m) => <MessageRow key={m.id} m={m} user={user} />)}
        {carried.length + own.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nenhum recado neste turno.</li>}
      </ul>
    </section>
  );
}

function MessageRow({ m, user, carried }: { m: Message; user: string; carried?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.body);
  const resolved = m.status === "resolvido";
  const important = m.importance === "importante";

  const update = async (patch: Partial<Message>) => {
    if (!user) { toast.error("Escolha seu nome no topo antes de editar."); return; }
    const { error } = await supabase.from("messages").update({ ...patch, ...auditUpdate(user) }).eq("id", m.id);
    if (error) toast.error("Erro ao atualizar.");
  };

  return (
    <li className={cn("grid gap-1 px-4 py-2.5", carried && "border-l-4 border-l-warning bg-warning/10", important && !resolved && "border-l-4 border-l-destructive", resolved && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono text-muted-foreground">{spParts(m.occurred_at).br}</span>
        <span className="font-medium">{m.author}</span>
        {important && <Badge variant="destructive" className="h-5 text-[10px]">IMPORTANTE</Badge>}
        {carried && <Badge className="h-5 bg-warning text-[10px] text-warning-foreground hover:bg-warning">Pendente de {brDate(m.shift_date)} {shiftLabel(m.shift)}</Badge>}
        <Badge variant="outline" className={cn("h-5 text-[10px]", resolved ? "border-success text-success" : "")}>{resolved ? "Resolvido" : "Aberto"}</Badge>
        <div className="ml-auto flex gap-0.5">
          <Button size="icon" variant="ghost" className="h-7 w-7" title={important ? "Marcar normal" : "Marcar importante"} onClick={() => update({ importance: important ? "normal" : "importante" })}>
            <AlertTriangle className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={() => setEditing(!editing)}><Pencil className="h-3.5 w-3.5" /></Button>
          {resolved ? (
            <Button size="sm" variant="ghost" className="h-7" onClick={() => update({ status: "aberto", resolved_at: null, resolved_by: null })}><RotateCcw className="mr-1 h-3.5 w-3.5" />Reabrir</Button>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 text-success" onClick={() => update({ status: "resolvido", resolved_at: new Date().toISOString(), resolved_by: user })}><Check className="mr-1 h-3.5 w-3.5" />Resolver</Button>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Excluir" onClick={async () => {
            if (!user) { toast.error("Escolha seu nome no topo antes de editar."); return; }
            if (confirm("Excluir este recado?")) await supabase.from("messages").delete().eq("id", m.id);
          }}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      {editing ? (
        <div className="flex gap-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} />
          <Button size="sm" onClick={async () => { await update({ body: text }); setEditing(false); }}>Salvar</Button>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm">{m.body}</p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Criado por {m.created_by ?? "—"} em {spParts(m.created_at).br}
        {m.updated_by && m.updated_at !== m.created_at && <> · alterado por {m.updated_by} em {spParts(m.updated_at).br}</>}
        {m.resolved_by && <> · resolvido por {m.resolved_by}</>}
      </p>
    </li>
  );
}
