import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TeamAccount = {
  id: string;
  username: string;
  email: string;
  name: string;
  active: boolean;
  admin: boolean;
  lastSignIn: string | null;
};

const toEmail = (u: string) => {
  const v = u.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@itom.local`;
};
const toUser = (email = "") => email.replace(/@itom\.local$/, "");
/** Superusuário interno: nunca aparece nas listas de contas nem da equipe. */
const SUPERUSER_EMAIL = "admin@itom.local";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Apenas administradores podem gerir contas.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return !!data;
  });

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new Error(error.message);
    const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
    const admins = new Set((roles ?? []).map((r) => r.user_id));
    return data.users
      .filter((u) => u.email !== SUPERUSER_EMAIL)
      .map<TeamAccount>((u) => ({
        id: u.id,
        username: (u.user_metadata?.["username"] as string) ?? toUser(u.email),
        email: u.email?.endsWith("@itom.local") ? "" : (u.email ?? ""),
        name: (u.user_metadata?.["name"] as string) ?? "",
        active: !u.banned_until || new Date(u.banned_until) < new Date(),
        admin: admins.has(u.id),
        lastSignIn: u.last_sign_in_at ?? null,
      }))
      .sort((a, b) => a.username.localeCompare(b.username));
  });

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { username: string; name: string; email: string; admin: boolean; redirectTo: string }) => {
    if (!/^[a-z0-9._-]{2,40}$/i.test(d.username.trim())) throw new Error("Login inválido (use letras, números, . _ -).");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) throw new Error("E-mail inválido.");
    if (!d.name.trim()) throw new Error("Informe o nome.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const username = data.username.trim().toLowerCase();
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (list?.users.some((u) => ((u.user_metadata?.["username"] as string) ?? toUser(u.email)).toLowerCase() === username))
      throw new Error("Esse login já existe.");
    const { data: res, error } = await admin.auth.admin.inviteUserByEmail(data.email.trim().toLowerCase(), {
      data: { name: data.name.trim(), username },
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message.includes("already") ? "Esse e-mail já está cadastrado." : error.message);
    await admin.from("user_roles").insert({ user_id: res.user.id, role: "user" });
    if (data.admin) await admin.from("user_roles").insert({ user_id: res.user.id, role: "admin" });
    return { ok: true };
  });

/** Membros da equipe = contas ativas (para escalar no turno). */
export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new Error(error.message);
    return data.users
      .filter((u) => u.email !== SUPERUSER_EMAIL && (!u.banned_until || new Date(u.banned_until) < new Date()))
      .map((u) => ({ id: u.id, name: ((u.user_metadata?.["name"] as string) || toUser(u.email)).trim() }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

/** Login por usuário: resolve o e-mail no servidor (não expõe e-mails) e devolve a sessão. */
export const loginWithUsername = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string; password: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const u = data.username.trim().toLowerCase();
    let email = `${u}@itom.local`;
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const found = list?.users.find((x) => ((x.user_metadata?.["username"] as string) ?? "").toLowerCase() === u);
    if (found?.email) email = found.email;
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const c = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => { const h = new Headers(init?.headers); if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization"); h.set("apikey", key); return fetch(input, { ...init, headers: h }); } },
    });
    const { data: s, error } = await c.auth.signInWithPassword({ email, password: data.password });
    if (error || !s.session) return { ok: false as const };
    return { ok: true as const, access_token: s.session.access_token, refresh_token: s.session.refresh_token };
  });

export const updateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; username?: string; name?: string; email?: string; password?: string; admin?: boolean; active?: boolean }) => {
    if (d.password !== undefined && d.password.length < 6) throw new Error("A senha precisa de pelo menos 6 caracteres.");
    if (d.username !== undefined && !/^[a-z0-9._-]{2,40}$/i.test(d.username.trim())) throw new Error("Login inválido (use letras, números, . _ -).");
    return d;
  })
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const self = data.id === context.userId;
    if (self && (data.active === false || data.admin === false))
      throw new Error("Você não pode desativar nem tirar o acesso de administrador da sua própria conta.");
    const { data: cur, error: gErr } = await admin.auth.admin.getUserById(data.id);
    if (gErr || !cur.user) throw new Error("Conta não encontrada.");
    if (cur.user.email === SUPERUSER_EMAIL) throw new Error("Esta conta não pode ser alterada.");
    const meta: Record<string, unknown> = { ...(cur.user.user_metadata ?? {}) };
    if (data.name !== undefined) meta["name"] = data.name.trim();
    if (data.username !== undefined) {
      const username = data.username.trim().toLowerCase();
      if (username === "admin") throw new Error("Esse login já existe.");
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (list?.users.some((u) => u.id !== data.id && ((u.user_metadata?.["username"] as string) ?? toUser(u.email)).toLowerCase() === username))
        throw new Error("Esse login já existe.");
      meta["username"] = username;
    }
    const attrs: Record<string, unknown> = {};
    if (data.name !== undefined || data.username !== undefined) attrs["user_metadata"] = meta;
    if (data.email) attrs["email"] = data.email.trim().toLowerCase();
    if (data.password) attrs["password"] = data.password;
    if (data.active !== undefined) attrs["ban_duration"] = data.active ? "none" : "876000h";
    if (Object.keys(attrs).length) {
      const { error } = await admin.auth.admin.updateUserById(data.id, attrs);
      if (error) throw new Error(error.message);
    }
    if (data.admin === true) await admin.from("user_roles").upsert({ user_id: data.id, role: "admin" }, { onConflict: "user_id,role" });
    if (data.admin === false) await admin.from("user_roles").delete().eq("user_id", data.id).eq("role", "admin");
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    if (data.id === context.userId) throw new Error("Você não pode excluir a sua própria conta.");
    const { data: cur } = await admin.auth.admin.getUserById(data.id);
    if (cur?.user?.email === SUPERUSER_EMAIL) throw new Error("Esta conta não pode ser excluída.");
    await admin.from("user_roles").delete().eq("user_id", data.id);
    const { error } = await admin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
