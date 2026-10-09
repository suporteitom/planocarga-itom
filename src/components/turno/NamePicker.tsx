import { useState } from "react";
import { Check, ChevronsUpDown, UserPlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ensureMember, useMembers } from "@/lib/data";
import { cn } from "@/lib/utils";

/** Escolher um nome da lista de membros, ou digitar um novo (que é cadastrado). */
export function NamePicker({
  value,
  onSelect,
  placeholder = "Escolher nome…",
  exclude = [],
  className,
  size = "sm",
}: {
  value?: string | null;
  onSelect: (name: string) => void;
  placeholder?: string;
  exclude?: string[];
  className?: string;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data: members = [] } = useMembers();
  const list = members.filter((m) => !exclude.includes(m.name));
  const exists = members.some((m) => m.name.toLowerCase() === q.trim().toLowerCase());

  const pick = async (name: string) => {
    await ensureMember(name);
    onSelect(name.trim());
    setOpen(false);
    setQ("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size={size} className={cn("justify-between font-normal", className)}>
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value || placeholder}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar ou digitar nome…" value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>
            <CommandGroup>
              {list.map((m) => (
                <CommandItem key={m.id} value={m.name} onSelect={() => pick(m.name)}>
                  <Check className={cn("mr-2 h-4 w-4", value === m.name ? "opacity-100" : "opacity-0")} />
                  {m.name}
                </CommandItem>
              ))}
            </CommandGroup>
            {q.trim() && !exists && (
              <CommandGroup>
                <CommandItem value={`__new_${q}`} onSelect={() => pick(q)}>
                  <UserPlus className="mr-2 h-4 w-4" /> Adicionar “{q.trim()}”
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
