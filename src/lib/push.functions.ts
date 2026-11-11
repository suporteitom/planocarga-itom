import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Sub = { endpoint: string; p256dh: string; auth: string };

export const getVapidPublicKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ key: process.env.VAPID_PUBLIC_KEY ?? "" }));

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Sub & { label?: string }) => {
    if (!/^https:\/\//.test(String(d.endpoint))) throw new Error("Inscrição inválida.");
    return { endpoint: String(d.endpoint), p256dh: String(d.p256dh), auth: String(d.auth), label: d.label ? String(d.label).slice(0, 200) : null };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("push_subscriptions" as any).delete().eq("endpoint", data.endpoint);
    const { error } = await context.supabase.from("push_subscriptions" as any).insert({ ...data, user_id: context.userId });
    if (error) throw new Error("Não foi possível ativar.");
    return { ok: true };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpoint: string }) => ({ endpoint: String(d.endpoint) }))
  .handler(async ({ data, context }) => {
    await context.supabase.from("push_subscriptions" as any).delete().eq("endpoint", data.endpoint);
    return { ok: true };
  });

/** Envia para todos os navegadores inscritos. Usar apenas no servidor. */
export async function sendPushToAll(msg: { title: string; body: string; url?: string; tag?: string }) {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return 0;
  const { buildPushPayload } = await import("@block65/webcrypto-web-push");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: subs } = await supabaseAdmin.from("push_subscriptions" as any).select("id, endpoint, p256dh, auth");
  let sent = 0;
  for (const s of (subs ?? []) as any[]) {
    try {
      const payload = await buildPushPayload(
        { data: JSON.stringify(msg), options: { ttl: 3600, urgency: "high" } as any },
        { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } },
        { subject: "mailto:alertas@itom.local", publicKey: pub, privateKey: priv },
      );
      const r = await fetch(s.endpoint, payload as any);
      if (r.status === 404 || r.status === 410) await supabaseAdmin.from("push_subscriptions" as any).delete().eq("id", s.id);
      else if (r.ok) sent++;
      else console.error(`push failed [${r.status}]: ${await r.text()}`);
    } catch (e) { console.error("push error", e); }
  }
  return sent;
}

export const testPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { origin?: string }) => ({ origin: d.origin ? String(d.origin) : undefined }))
  .handler(async ({ data }) => {
    const n = await sendPushToAll({ title: "✅ Teste — Plano de Trabalho ITOM", body: "As notificações no Windows estão a funcionar.", url: data.origin, tag: "teste" });
    return { sent: n };
  });
