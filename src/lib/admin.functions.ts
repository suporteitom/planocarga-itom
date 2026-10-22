import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TeamAccount = {
  id: string;
  username: string;
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
      .map<TeamAccount>((u) => ({
        id: u.id,
        username: toUser(u.email),
        name: (u.user_metadata?.name as string) ?? "",
        active: !u.banned_until || new Date(u.banned_until) < new Date(),
        admin: admins.has(u.id),
        lastSignIn: u.last_sign_in_at ?? null,
      }))
      .sort((a, b) => a.username.localeCompare(b.username));
  });

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { username: string; name: string; password: string; admin: boolean }) => {
    if (!/^[a-z0-9._-]{2,40}$/i.test(d.username.trim())) throw new Error("Usuário inválido (use letras, números, . _ -).");
    if (d.password.length < 6) throw new Error("A senha precisa de pelo menos 6 caracteres.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { data: res, error } = await admin.auth.admin.createUser({
      email: toEmail(data.username),
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name.trim() },
    });
    if (error) throw new Error(error.message.includes("already") ? "Esse usuário já existe." : error.message);
    if (data.admin) await admin.from("user_roles").insert({ user_id: res.user.id, role: "admin" });
    return { ok: true };
  });

export const updateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; name?: string; password?: string; admin?: boolean; active?: boolean }) => {
    if (d.password !== undefined && d.password.length < 6) throw new Error("A senha precisa de pelo menos 6 caracteres.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const self = data.id === context.userId;
    if (self && (data.active === false || data.admin === false))
      throw new Error("Você não pode desativar nem tirar o acesso de administrador da sua própria conta.");
    const attrs: Record<string, unknown> = {};
    if (data.name !== undefined) attrs.user_metadata = { name: data.name.trim() };
    if (data.password) attrs.password = data.password;
    if (data.active !== undefined) attrs.ban_duration = data.active ? "none" : "876000h";
    if (Object.keys(attrs).length) {
      const { error } = await admin.auth.admin.updateUserById(data.id, attrs);
      if (error) throw new Error(error.message);
    }
    if (data.admin === true) await admin.from("user_roles").upsert({ user_id: data.id, role: "admin" }, { onConflict: "user_id,role" });
    if (data.admin === false) await admin.from("user_roles").delete().eq("user_id", data.id).eq("role", "admin");
    return { ok: true };
  });
