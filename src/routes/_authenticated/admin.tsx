import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, KeyRound, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { amIAdmin, createAccount, listAccounts, updateAccount, type TeamAccount } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Contas da equipe · Plano de Carga ITOM" },
      { name: "description", content: "Gestão das contas de acesso da equipe de operações ITOM." },
      { property: "og:title", content: "Contas da equipe · Plano de Carga ITOM" },
      { property: "og:description", content: "Criar, editar e desativar contas da equipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Form = { id?: string; username: string; name: string; email: string; password: string; admin: boolean };

function AdminPage() {
  const qc = useQueryClient();
  const isAdminFn = useServerFn(amIAdmin);
  const listFn = useServerFn(listAccounts);
  const createFn = useServerFn(createAccount);
  const updateFn = useServerFn(updateAccount);
  const { data: isAdmin, isLoading } = useQuery({ queryKey: ["am-admin"], queryFn: () => isAdminFn() });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => listFn(), enabled: !!isAdmin });
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["accounts"] });
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await refresh();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  async function save() {
    if (!form) return;
    const done = form.id
      ? await run(() => updateFn({ data: { id: form.id!, name: form.name, admin: form.admin, ...(form.email ? { email: form.email } : {}), ...(form.password ? { password: form.password } : {}) } }), "Conta atualizada.")
      : await run(() => createFn({ data: { username: form.username, name: form.name, email: form.email, admin: form.admin, redirectTo: `${window.location.origin}/reset-password` } }), "Convite enviado por e-mail.");
    if (done) setForm(null);
  }

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!isAdmin)
    return (
      <div className="p-6 text-sm">
        Apenas administradores podem aceder a esta área. <Link to="/" className="text-primary underline">Voltar</Link>
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b bg-sidebar px-4 py-3">
        <Link to="/" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Voltar</Link>
        <span className="font-mono text-lg font-bold tracking-tight text-primary">▌CONTAS DA EQUIPE</span>
        <Button size="sm" className="ml-auto" onClick={() => setForm({ username: "", name: "", email: "", password: "", admin: false })}><Plus className="mr-1 h-4 w-4" /> Nova conta</Button>
      </header>
      <div className="overflow-x-auto p-4">
        <table className="w-full border text-sm">
          <thead className="bg-muted text-left text-xs">
            <tr>{["Login", "Nome", "E-mail", "Administrador", "Ativa", "Último acesso", ""].map((h) => <th key={h} className="border px-2 py-1">{h}</th>)}</tr>
          </thead>
          <tbody>
            {accounts.map((a: TeamAccount) => (
              <tr key={a.id} className={a.active ? "" : "text-muted-foreground"}>
                <td className="border px-2 py-1 font-mono">{a.username}</td>
                <td className="border px-2 py-1">{a.name}</td>
                <td className="border px-2 py-1 text-xs">{a.email || "—"}</td>
                <td className="border px-2 py-1">{a.admin ? "Sim" : "Não"}</td>
                <td className="border px-2 py-1">
                  <Switch checked={a.active} disabled={busy} aria-label={`Ativa ${a.username}`}
                    onCheckedChange={(v) => run(() => updateFn({ data: { id: a.id, active: v } }), v ? "Conta reativada." : "Conta desativada.")} />
                </td>
                <td className="border px-2 py-1 text-xs">{a.lastSignIn ? new Date(a.lastSignIn).toLocaleString("pt-BR", { timeZone: "Europe/Lisbon" }) : "—"}</td>
                <td className="border px-2 py-1">
                  <Button size="sm" variant="ghost" aria-label={`Editar ${a.username}`} onClick={() => setForm({ id: a.id, username: a.username, name: a.name, email: a.email, password: "", admin: a.admin })}><Pencil className="h-3 w-3" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">Não existe cadastro público: só administradores criam contas. Contas desativadas não conseguem entrar.</p>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? `Editar ${form.username}` : "Nova conta"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              {!form.id && (
                <label className="block space-y-1 text-xs font-medium">Login
                  <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="ex.: joao.silva" />
                </label>
              )}
              <label className="block space-y-1 text-xs font-medium">Nome
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="block space-y-1 text-xs font-medium">E-mail da empresa
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nome@empresa.com" />
              </label>
              {form.id ? (
                <label className="block space-y-1 text-xs font-medium"><span className="flex items-center gap-1"><KeyRound className="h-3 w-3" />Nova senha (deixe vazio para manter)</span>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </label>
              ) : (
                <p className="text-xs text-muted-foreground">A pessoa recebe um e-mail com um link para criar a própria senha.</p>
              )}
              <label className="flex items-center gap-2 text-xs font-medium">
                <Switch checked={form.admin} onCheckedChange={(v) => setForm({ ...form, admin: v })} /> Administrador
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
