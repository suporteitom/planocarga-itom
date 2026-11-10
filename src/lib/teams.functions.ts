import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Apenas administradores.");
}

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" }) : "—";

function card(title: string, facts: { title: string; value: string }[], notes: string, link?: string) {
  return {
    type: "message",
    attachments: [{
      contentType: "application/vnd.microsoft.card.adaptive",
      content: {
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard", version: "1.4",
        body: [
          { type: "TextBlock", text: title, weight: "Bolder", size: "Large", color: "Attention", wrap: true },
          { type: "FactSet", facts },
          ...(notes ? [{ type: "TextBlock", text: notes, wrap: true }] : []),
        ],
        ...(link ? { actions: [{ type: "Action.OpenUrl", title: "Abrir no Plano de Trabalho", url: link }] } : {}),
      },
    }],
  };
}

async function post(url: string, payload: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!r.ok) {
    const t = await r.text();
    console.error(`Teams webhook failed [${r.status}]: ${t}`);
    throw new Error(`O Teams recusou o envio (${r.status}).`);
  }
}

export const getTeamsSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase.from("notification_settings").select("teams_webhook_url, teams_enabled").eq("id", 1).maybeSingle();
    return { url: data?.teams_webhook_url ?? "", enabled: !!data?.teams_enabled };
  });

export const saveTeamsSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string; enabled: boolean }) => {
    const url = String(d.url ?? "").trim();
    if (url && !/^https:\/\//.test(url)) throw new Error("A ligação tem de começar por https://");
    return { url, enabled: !!d.enabled };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("notification_settings")
      .upsert({ id: 1, teams_webhook_url: data.url || null, teams_enabled: data.enabled, updated_at: new Date().toISOString() });
    if (error) throw new Error("Não foi possível guardar.");
    return { ok: true };
  });

export const testTeams = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string }) => ({ url: String(d.url ?? "").trim() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!/^https:\/\//.test(data.url)) throw new Error("Ligação inválida.");
    await post(data.url, card("✅ Teste — Plano de Trabalho ITOM", [{ title: "Estado", value: "Ligação ao Teams a funcionar" }], ""));
    return { ok: true };
  });

/** Chamado por qualquer membro da equipa quando uma intervenção fica com prioridade 1. */
export const notifyCritical = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; origin?: string }) => ({ id: String(d.id), origin: d.origin ? String(d.origin) : undefined }))
  .handler(async ({ data, context }) => {
    const { data: i } = await context.supabase.from("interventions").select("*").eq("id", data.id).maybeSingle();
    if (!i || i.priority !== "1") return { sent: false };
    const admin = await adminClient();
    const { data: s } = await admin.from("notification_settings").select("teams_webhook_url, teams_enabled").eq("id", 1).maybeSingle();
    if (!s?.teams_enabled || !s.teams_webhook_url) return { sent: false };
    const by = (context.claims as any)?.user_metadata?.name ?? (context.claims as any)?.email ?? "—";
    await post(s.teams_webhook_url, card("🚨 ALERTA: Intervenção Crítica (Prioridade 1)", [
      { title: "Cliente", value: i.client ?? "—" },
      { title: "Ticket", value: i.ticket ?? "—" },
      { title: "Tipo", value: i.type ?? "—" },
      { title: "Início", value: fmt(i.start_at) },
      { title: "Fim previsto", value: fmt(i.end_at) },
      { title: "Registado por", value: String(by) },
    ], i.notes ?? "", data.origin && /^https?:\/\//.test(data.origin) ? data.origin : undefined));
    return { sent: true };
  });
