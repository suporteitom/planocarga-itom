import { useEffect, useState } from "react";
import { AlertTriangle, Clock, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useInterventions, type Intervention } from "@/lib/data";
import { spParts } from "@/lib/shifts";

const DEFAULT_TITLE = "Plano de Trabalho - ITOM";

export function InterventionAlertModal({ onGoToInterventions }: { onGoToInterventions?: () => void }) {
  const { data: interventions = [] } = useInterventions();
  const [activeAlert, setActiveAlert] = useState<{ item: Intervention; minutesLeft: number } | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const saved = sessionStorage.getItem("dismissed_intervention_alerts");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // 1. Verificação periódica de intervenções próximas (a cada 30 segundos)
  useEffect(() => {
    function checkUpcoming() {
      const now = Date.now();

      // Procura intervenções não concluídas nem canceladas que iniciam em até 30 minutos (e não começaram há mais de 10 min)
      const upcoming = interventions
        .filter((i) => i.status !== "concluida" && i.status !== "cancelada" && !dismissedIds.has(i.id))
        .map((i) => {
          const startTime = new Date(i.start_at).getTime();
          const diffMinutes = Math.round((startTime - now) / 60000);
          return { item: i, minutesLeft: diffMinutes };
        })
        .filter(({ minutesLeft }) => minutesLeft >= -10 && minutesLeft <= 30)
        .sort((a, b) => a.minutesLeft - b.minutesLeft)[0];

      if (upcoming) {
        setActiveAlert(upcoming);
      } else {
        setActiveAlert(null);
      }
    }

    checkUpcoming();
    const interval = setInterval(checkUpcoming, 30_000);
    return () => clearInterval(interval);
  }, [interventions, dismissedIds]);

  // 2. Caption/título dinâmico e piscante enquanto houver alerta ativo
  useEffect(() => {
    if (!activeAlert) return;

    const baseTitle = document.title || DEFAULT_TITLE;
    let toggle = false;

    const timer = setInterval(() => {
      toggle = !toggle;
      if (toggle) {
        const tempo = activeAlert.minutesLeft <= 0 
          ? "AGORA" 
          : `${activeAlert.minutesLeft}m`;
        document.title = `⚠️ [${tempo}] INTERVENÇÃO!`;
      } else {
        document.title = `🔔 ${DEFAULT_TITLE}`;
      }
    }, 1000); // Alterna a cada 1 segundo

    return () => {
      clearInterval(timer);
      document.title = baseTitle; // Restaura o título padrão ao dispensar ou sumir o alerta
    };
  }, [activeAlert]);

  const handleDismiss = () => {
    if (!activeAlert) return;
    const newSet = new Set(dismissedIds);
    newSet.add(activeAlert.item.id);
    setDismissedIds(newSet);
    try {
      sessionStorage.setItem("dismissed_intervention_alerts", JSON.stringify(Array.from(newSet)));
    } catch {
      // Ignora erro de storage se indisponível
    }
    setActiveAlert(null);
  };

  if (!activeAlert) return null;

  const { item, minutesLeft } = activeAlert;
  const parts = spParts(item.start_at);

  return (
    <Dialog open={!!activeAlert} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <DialogContent className="border-warning bg-card sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-6 w-6 animate-pulse" />
            <DialogTitle className="text-lg font-bold text-foreground">
              Atenção: Intervenção Próxima!
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {minutesLeft <= 0
              ? "Esta intervenção está programada para iniciar agora!"
              : `Esta intervenção iniciará em aproximadamente ${minutesLeft} minuto${minutesLeft === 1 ? "" : "s"}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
          <div className="flex justify-between">
            <span className="font-semibold text-muted-foreground">Tipo:</span>
            <span className="font-medium text-foreground">{item.type || "Não especificado"}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-muted-foreground">Cliente:</span>
            <span className="font-medium text-foreground">{item.client || "—"}</span>
          </div>
          {item.ticket && (
            <div className="flex justify-between">
              <span className="font-semibold text-muted-foreground">Ticket / RFC:</span>
              <span className="font-mono text-foreground">{item.ticket}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1 border-t border-warning/20">
            <span className="flex items-center gap-1 font-semibold text-muted-foreground">
              <Clock className="h-4 w-4" /> Início Previsto:
            </span>
            <span className="font-mono font-bold text-warning-foreground bg-warning px-2 py-0.5 rounded text-xs">
              {parts.date} às {parts.time}
            </span>
          </div>
          {item.notes && (
            <div className="pt-2 text-xs text-muted-foreground border-t border-warning/20">
              <span className="font-semibold">Obs:</span> {item.notes}
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          {onGoToInterventions && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                handleDismiss();
                onGoToInterventions();
              }}
              className="gap-1"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Ir para Intervenções
            </Button>
          )}
          <Button type="button" variant="default" onClick={handleDismiss}>
            Entendido / Ciente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
