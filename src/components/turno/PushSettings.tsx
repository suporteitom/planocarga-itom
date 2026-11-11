import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getVapidPublicKey, removePushSubscription, savePushSubscription, testPush } from "@/lib/push.functions";

function b64ToBytes(b64: string) {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export function PushSettings() {
  const keyFn = useServerFn(getVapidPublicKey);
  const saveFn = useServerFn(savePushSubscription);
  const removeFn = useServerFn(removePushSubscription);
  const testFn = useServerFn(testPush);
  const [supported, setSupported] = useState(true);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setSupported(false); return; }
    navigator.serviceWorker.getRegistration("/push-sw.js").then(async (r) => setActive(!!(await r?.pushManager.getSubscription())));
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Permissão de notificações recusada no navegador.");
      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;
      const { key } = await keyFn();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
      const j = sub.toJSON() as any;
      await saveFn({ data: { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, label: navigator.userAgent } });
      setActive(true);
      toast.success("Notificações ativadas neste computador.");
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await removeFn({ data: { endpoint: sub.endpoint } }); await sub.unsubscribe(); }
      setActive(false);
      toast.success("Notificações desativadas neste computador.");
    } finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true);
    try { const r = await testFn({ data: { origin: window.location.origin } }); toast.success(`Teste enviado para ${r.sent} computador(es).`); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  return (
    <div className="mt-6 rounded border bg-card p-4">
      <h2 className="mb-1 text-sm font-bold">Notificações no Windows (navegador)</h2>
      <p className="mb-3 text-xs text-muted-foreground">Ative neste computador para receber um aviso do Windows sempre que uma intervenção ficar com prioridade 1 - Crítico, mesmo com o Plano de Trabalho fechado (o Edge/Chrome precisa de estar a correr em segundo plano). Faça isto no computador do gestor, com a conta dele.</p>
      {!supported ? <p className="text-xs text-destructive">Este navegador não suporta notificações.</p> : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium">Estado: {active ? "Ativo neste computador" : "Desativado"}</span>
          {active
            ? <Button size="sm" variant="outline" disabled={busy} onClick={disable}>Desativar</Button>
            : <Button size="sm" disabled={busy} onClick={enable}>Ativar notificações</Button>}
          <Button size="sm" variant="outline" disabled={busy} onClick={test}>Testar notificação</Button>
        </div>
      )}
    </div>
  );
}
