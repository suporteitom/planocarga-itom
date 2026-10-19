import type { ReactNode } from "react";
import { useState } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Intervention, Message } from "@/lib/data";
import { exportAll, exportXlsx } from "@/lib/export";
import { toast } from "sonner";
import { SHIFTS, addDays, brDate, fromSp, shiftLabel, shiftOf, spParts } from "@/lib/shifts";

export function HistoryPanel({ onOpenShift }: { onOpenShift: (date: string, shift: string) => void }) {
  const today = shiftOf().date;
  const [from, setFrom] = useState(addDays(today, -7));
  const [to, setTo] = useState(today);
  const [shift, setShift] = useState("");
  const [client, setClient] = useState("");
  const [ticket, setTicket] = useState("");
  const [person, setPerson] = useState("");
  const [kw, setKw] = useState("");
  const [res, setRes] = useState<{ m: Message[]; i: Intervention[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    let mq = supabase.from("messages").select("*").gte("shift_date", from).lte("shift_date", to).order("occurred_at");
    if (shift) mq = mq.eq("shift", shift);
    if (person) mq = mq.or(`author.ilike.%${person}%,created_by.ilike.%${person}%,updated_by.ilike.%${person}%`);
    if (kw) mq = mq.ilike("body", `%${kw}%`);
    let iq = supabase
      .from("interventions")
      .select("*")
      .gte("start_at", fromSp(from, "07:00").toISOString())
      .lt("start_at", fromSp(addDays(to, 1), "07:00").toISOString())
      .order("start_at");
    if (client) iq = iq.ilike("client", `%${client}%`);
    if (ticket) iq = iq.ilike("ticket", `%${ticket}%`);
    if (person) iq = iq.or(`sent_by.ilike.%${person}%,created_by.ilike.%${person}%,updated_by.ilike.%${person}%`);
    if (kw) iq = iq.or(`notes.ilike.%${kw}%,email_subject.ilike.%${kw}%,client.ilike.%${kw}%,ticket.ilike.%${kw}%`);
    const [m, i] = await Promise.all([client || ticket ? Promise.resolve({ data: [] as Message[] }) : mq, iq]);
    let ints = (i.data ?? []) as Intervention[];
    if (shift) ints = ints.filter((x) => shiftOf(new Date(x.start_at)).shift === shift);
    setRes({ m: (m.data ?? []) as Message[], i: ints });
    setLoading(false);
  };

  return (
    <div className="grid gap-4 p-3 md:p-4">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3">
        <Field label="De"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 font-mono text-xs" /></Field>
        <Field label="Até"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 font-mono text-xs" /></Field>
        <Field label="Turno">
          <select value={shift} onChange={(e) => setShift(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
            <option value="">Todos</option>
            {SHIFTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Cliente"><Input value={client} onChange={(e) => setClient(e.target.value)} className="h-8 w-28 text-xs" /></Field>
        <Field label="Ticket"><Input value={ticket} onChange={(e) => setTicket(e.target.value)} className="h-8 w-24 text-xs" /></Field>
        <Field label="Pessoa"><Input value={person} onChange={(e) => setPerson(e.target.value)} className="h-8 w-28 text-xs" /></Field>
        <Field label="Palavra-chave"><Input value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} className="h-8 w-40 text-xs" /></Field>
        <Button size="sm" onClick={search} disabled={loading}><Search className="mr-1 h-3.5 w-3.5" />Buscar</Button>
        <Button size="sm" onClick={async () => { try { await exportAll(from, to); } catch { toast.error("Não foi possível exportar"); } }}>
          <Download className="mr-1 h-3.5 w-3.5" />Exportar tudo (Excel)
        </Button>
        {res && (
          <Button size="sm" variant="outline" onClick={() => exportXlsx(`passagem-turno_${from}_a_${to}.xlsx`, res.m, res.i)}>
            <Download className="mr-1 h-3.5 w-3.5" />Exportar período
          </Button>
        )}
      </div>

      {res && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card">
            <h3 className="border-b border-border px-4 py-2 text-sm font-semibold">Recados ({res.m.length})</h3>
            <ul className="max-h-[60vh] divide-y divide-border overflow-auto">
              {res.m.map((m) => (
                <li key={m.id} className="cursor-pointer px-4 py-2 text-sm hover:bg-accent/40" onClick={() => onOpenShift(m.shift_date, m.shift)}>
                  <div className="font-mono text-xs text-muted-foreground">{brDate(m.shift_date)} · {shiftLabel(m.shift)} · {m.author} · {m.status}</div>
                  <p className="line-clamp-2">{m.body}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-card">
            <h3 className="border-b border-border px-4 py-2 text-sm font-semibold">Intervenções ({res.i.length})</h3>
            <ul className="max-h-[60vh] divide-y divide-border overflow-auto">
              {res.i.map((i) => {
                const r = shiftOf(new Date(i.start_at));
                return (
                  <li key={i.id} className="cursor-pointer px-4 py-2 text-sm hover:bg-accent/40" onClick={() => onOpenShift(r.date, r.shift)}>
                    <div className="font-mono text-xs text-muted-foreground">{spParts(i.start_at).br} · {i.type} · {i.status}</div>
                    <p>{i.client} {i.ticket && <span className="font-mono">#{i.ticket}</span>} {i.email_subject}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="grid gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}{children}</label>
);
