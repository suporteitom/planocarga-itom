import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

export function PasswordInput(props: Omit<ComponentProps<typeof Input>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className={`pr-9 ${props.className ?? ""}`} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/** Traduz erros de senha do servidor para português. */
export function passwordErrorPt(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("weak") || m.includes("pwned") || m.includes("leak") || m.includes("easy to guess"))
    return "Senha fraca ou muito comum. Escolha uma senha mais difícil de adivinhar.";
  if (m.includes("at least") || m.includes("characters")) return "A senha é demasiado curta.";
  if (m.includes("same") && m.includes("password")) return "A nova senha tem de ser diferente da atual.";
  return msg;
}
