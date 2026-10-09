import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShiftHeader } from "@/components/turno/ShiftHeader";
import { MessagesSection } from "@/components/turno/MessagesSection";
import { InterventionsSection } from "@/components/turno/InterventionsSection";
import { HistoryPanel } from "@/components/turno/HistoryPanel";
import { NamePicker } from "@/components/turno/NamePicker";
import { useCurrentUser } from "@/lib/identity";
import { useInterventions, useMessages, useRealtimeSync } from "@/lib/data";
import { exportXlsx } from "@/lib/export";
import { shiftLabel, shiftOf, type ShiftKey, type ShiftRef } from "@/lib/shifts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Passagem de Turno · Operações SAP" },
      { name: "description", content: "Recados, intervenções planejadas e passagem de turno da equipe de operações SAP." },
      { property: "og:title", content: "Passagem de Turno · Operações SAP" },
      { property: "og:description", content: "Registro operacional compartilhado entre os turnos Manhã, Tarde e Noite." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const FUTURE_TABS = [
  { key: "outros", label: "Outros Recados" },
  { key: "tarefas", label: "Tarefas do Dia" },
  { key: "jobs", label: "Monitoramento de Jobs" },
];

function Index() {
  useRealtimeSync();
  const { name, setName } = useCurrentUser();
  const [shiftRef, setShiftRef] = useState<ShiftRef>(() => shiftOf());
  const [tab, setTab] = useState("recados");
  const { data: msgs } = useMessages(shiftRef);
  const { data: ints = [] } = useInterventions(shiftRef);

  const counts = { messages: msgs?.own.length ?? 0, carried: msgs?.carried.length ?? 0, interventions: ints.length };

  return (
    <div className="min-h-screen bg-background">
      <Tabs value={tab} onValueChange={setTab}>
        <header className="sticky top-0 z-20 border-b border-border bg-sidebar">
          <div className="flex flex-wrap items-center gap-3 px-3 pt-2 md:px-4">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm font-bold tracking-tight text-primary">▌PASSAGEM DE TURNO</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">Operações SAP</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Você:</span>
              <NamePicker value={name} onSelect={setName} placeholder="Escolha seu nome" className={"h-7 w-40 " + (!name ? "border-destructive" : "")} />
            </div>
          </div>
          <div className="overflow-x-auto px-3 md:px-4">
            <TabsList className="mt-2 h-auto rounded-none bg-transparent p-0">
              <TabsTrigger value="recados" className="rounded-b-none border border-b-0 border-transparent data-[state=active]:border-border data-[state=active]:bg-background">Recados e Intervenções</TabsTrigger>
              {FUTURE_TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key} disabled className="rounded-b-none">{t.label} <span className="ml-1 text-[10px]">(em breve)</span></TabsTrigger>
              ))}
              <TabsTrigger value="historico" className="rounded-b-none border border-b-0 border-transparent data-[state=active]:border-border data-[state=active]:bg-background">Histórico</TabsTrigger>
            </TabsList>
          </div>
        </header>

        {!name && (
          <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
            Escolha seu nome no canto superior direito — ele fica registrado em tudo que você criar ou alterar.
          </div>
        )}

        <TabsContent value="recados" className="mt-0">
          <ShiftHeader
            shiftRef={shiftRef}
            setShiftRef={setShiftRef}
            user={name}
            counts={counts}
            onExport={() => exportXlsx(`turno_${shiftRef.date}_${shiftLabel(shiftRef.shift)}.xlsx`, [...(msgs?.carried ?? []), ...(msgs?.own ?? [])], ints)}
          />
          <div className="grid gap-4 p-3 md:p-4">
            <MessagesSection shiftRef={shiftRef} user={name} />
            <InterventionsSection shiftRef={shiftRef} user={name} />
          </div>
        </TabsContent>
        <TabsContent value="historico" className="mt-0">
          <HistoryPanel onOpenShift={(date, shift) => { setShiftRef({ date, shift: shift as ShiftKey }); setTab("recados"); }} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
