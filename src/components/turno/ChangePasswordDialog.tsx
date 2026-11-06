import { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput, passwordErrorPt } from "@/components/turno/PasswordInput";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Troca de senha do próprio utilizador. `forced` = senha provisória: não pode fechar sem trocar. */
export function ChangePasswordDialog({ open, forced, onClose }: { open: boolean; forced: boolean; onClose: () => void }) {
  const [cur, setCur] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setCur(""); setP1(""); setP2(""); setErr(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!cur) return setErr("Informe a senha atual.");
    if (p1.length < 6) return setErr("A nova senha precisa de pelo menos 6 caracteres.");
    if (p1 !== p2) return setErr("As senhas não coincidem.");
    if (p1 === cur) return setErr("A nova senha tem de ser diferente da atual.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      password: p1,
      current_password: cur,
      data: { must_change_password: false },
    } as Parameters<typeof supabase.auth.updateUser>[0]);
    setBusy(false);
    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("current") || m.includes("invalid")) return setErr("Senha atual incorreta.");
      if (m.includes("pwned") || m.includes("leak") || m.includes("weak")) return setErr("Senha fraca ou já exposta em fugas de dados. Escolha outra.");
      return setErr(passwordErrorPt(error.message));
    }
    toast.success("Senha alterada.");
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !forced) { reset(); onClose(); } }}>
      <DialogContent
        onInteractOutside={(e) => forced && e.preventDefault()}
        onEscapeKeyDown={(e) => forced && e.preventDefault()}
        className={forced ? "[&>button]:hidden" : undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> {forced ? "Troca de senha obrigatória" : "Alterar senha"}</DialogTitle>
          <DialogDescription>
            {forced ? "Por segurança, altere a sua senha provisória para continuar." : "Defina uma nova senha para a sua conta."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <PasswordInput placeholder={forced ? "Senha provisória" : "Senha atual"} autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
          <PasswordInput placeholder="Nova senha" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} />
          <PasswordInput placeholder="Repita a nova senha" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} />
          {err && <p className="text-xs text-destructive">{err}</p>}
          <DialogFooter>
            {!forced && <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>}
            <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar senha"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
