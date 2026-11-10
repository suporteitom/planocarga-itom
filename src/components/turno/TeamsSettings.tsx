import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getTeamsSettings, saveTeamsSettings, testTeams } from "@/lib/teams.functions";

export function TeamsSettings() {
  const getFn = useServerFn(getTeamsSettings);
  const saveFn = useServerFn(saveTeamsSettings);
  const testFn = useServerFn(testTeams);
  const { data, refetch } = useQuery({ queryKey: ["teams-settings"], queryFn: () => getFn() });
  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) { setUrl(data.url); setEnabled(data.enabled); } }, [data]);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return (
    <div className="mt-6 rounded border bg-card p-4">
      <h2 className="mb-1 text-sm font-bold">Notificações Microsoft Teams</h2>
      <p className="mb-3 text-xs text-muted-foreground">Quando uma intervenção fica com prioridade 1 - Crítico, é enviado um cartão para este canal do Teams. Cole aqui a ligação do Webhook (Workflows ou Incoming Webhook) do canal.</p>
      <div className="space-y-3">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
        <label className="flex items-center gap-2 text-xs font-medium"><Switch checked={enabled} onCheckedChange={setEnabled} /> Envio ativo</label>
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => run(() => saveFn({ data: { url, enabled } }), "Configuração guardada.")}>Guardar</Button>
          <Button size="sm" variant="outline" disabled={busy || !url} onClick={() => run(() => testFn({ data: { url } }), "Cartão de teste enviado ao Teams.")}>Testar notificação</Button>
        </div>
      </div>
    </div>
  );
}
