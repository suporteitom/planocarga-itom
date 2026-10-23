import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerFn } from "@tanstack/react-start";
import { loginWithUsername } from "@/lib/admin.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · Plano de Carga ITOM" },
      { name: "description", content: "Acesso restrito à equipe de operações ITOM." },
      { property: "og:title", content: "Entrar · Plano de Carga ITOM" },
      { property: "og:description", content: "Acesso restrito à equipe de operações ITOM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

/** Usuários sem "@" entram como <usuario>@itom.local. */
export function toLoginEmail(user: string) {
  const u = user.trim().toLowerCase();
  return u.includes("@") ? u : `${u}@itom.local`;
}

function AuthPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const loginFn = useServerFn(loginWithUsername);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    let ok = false;
    if (user.includes("@")) {
      ok = !(await supabase.auth.signInWithPassword({ email: toLoginEmail(user), password: pass })).error;
    } else {
      const r = await loginFn({ data: { username: user, password: pass } }).catch(() => null);
      if (r?.ok) ok = !(await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token })).error;
    }
    setBusy(false);
    if (!ok) return setErr("Usuário ou senha inválidos.");
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-md border bg-card p-6 shadow-sm">
        <div className="space-y-1">
          <div className="font-mono text-lg font-bold tracking-tight text-primary">▌PLANO DE CARGA - ITOM</div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Acesso restrito à equipe</p>
        </div>
        <div className="space-y-1">
          <label htmlFor="u" className="text-xs font-medium">Login ou e-mail</label>
          <Input id="u" autoFocus autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label htmlFor="p" className="text-xs font-medium">Senha</label>
          <Input id="p" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} required />
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</Button>
      </form>
    </div>
  );
}
