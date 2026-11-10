import { useEffect, useMemo, useState } from "react";
import { Siren } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useInterventions } from "@/lib/data";

const KEY = "critical-acks";
const readAcks = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" }) : "—";

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "square"; o.frequency.value = 880; g.gain.value = 0.08;
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
  } catch { /* som bloqueado pelo navegador */ }
}

/** Pop-up + som para intervenções com prioridade 1 ainda não reconhecidas neste navegador. */
export function CriticalAlertModal({ onGoToInterventions }: { onGoToInterventions: () => void }) {
  const { data = [] } = useInterventions();
  const [acks, setAcks] = useState<string[]>([]);
  useEffect(() => setAcks(readAcks()), []);
  const pending = useMemo(() => {
    const since = Date.now() - 12 * 3600_000;
    return data.filter((i) => i.priority === "1" && i.status !== "concluida" && i.status !== "cancelada"
      && new Date(i.updated_at ?? i.created_at).getTime() > since
      && !acks.includes(`${i.id}:${i.updated_at}`));
  }, [data, acks]);
  const cur = pending[0];
  useEffect(() => { if (cur) beep(); }, [cur?.id]);
  const ack = () => {
    if (!cur) return;
    const next = [...readAcks(), `${cur.id}:${cur.updated_at}`].slice(-200);
    localStorage.setItem(KEY, JSON.stringify(next)); setAcks(next);
  };
  if (!cur) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && ack()}>
      <DialogContent className="border-destructive">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive"><Siren className="h-5 w-5" />Intervenção Crítica (Prioridade 1)</DialogTitle>
          <DialogDescription>Uma intervenção foi marcada como 1 - Crítico.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="font-medium">Cliente</dt><dd>{cur.client ?? "—"}</dd>
          <dt className="font-medium">Ticket</dt><dd>{cur.ticket ?? "—"}</dd>
          <dt className="font-medium">Tipo</dt><dd>{cur.type ?? "—"}</dd>
          <dt className="font-medium">Início</dt><dd>{fmt(cur.start_at)}</dd>
          {cur.notes && (<><dt className="font-medium">Obs.</dt><dd className="whitespace-pre-wrap">{cur.notes}</dd></>)}
        </dl>
        <DialogFooter>
          <Button variant="outline" onClick={() => { ack(); onGoToInterventions(); }}>Ir para Intervenções</Button>
          <Button variant="destructive" onClick={ack}>Ciente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
