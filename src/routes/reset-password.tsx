import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Definir senha · Plano de Carga ITOM" },
      { name: "description", content: "Crie a sua senha de acesso ao Plano de Carga ITOM." },
      { property: "og:title", content: "Definir senha · Plano de Carga ITOM" },
      { property: "og:description", content: "Crie a sua senha de acesso ao Plano de Carga ITOM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => s && setReady(true));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (p1.length < 6) return setErr("A senha precisa de pelo menos 6 caracteres.");
    if (p1 !== p2) return setErr("As senhas não coincidem.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) return setErr("Não foi possível salvar a senha. Peça um novo convite.");
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-md border bg-card p-6 shadow-sm">
        <div className="font-mono text-lg font-bold tracking-tight text-primary">▌PLANO DE CARGA - ITOM</div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground"><KeyRound className="h-3 w-3" /> Crie a sua senha de acesso</p>
        {!ready ? (
          <p className="text-sm text-muted-foreground">Abra esta página pelo link recebido no seu e-mail.</p>
        ) : (
          <>
            <Input type="password" placeholder="Nova senha" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} />
            <Input type="password" placeholder="Repita a senha" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} />
            {err && <p className="text-xs text-destructive">{err}</p>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Salvando…" : "Salvar senha"}</Button>
          </>
        )}
      </form>
    </div>
  );
}
