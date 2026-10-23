import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { listTeam } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export function useTeam() {
  const fn = useServerFn(listTeam);
  return useQuery({ queryKey: ["team"], queryFn: () => fn(), staleTime: 60_000 });
}

/** Escolher um membro da equipe — apenas contas cadastradas e ativas. */
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
  const { data: team = [] } = useTeam();
  const list = team.filter((m) => !exclude.includes(m.name));

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
          <CommandInput placeholder="Buscar…" />
          <CommandList>
            <CommandEmpty>Nenhum usuário cadastrado.</CommandEmpty>
            <CommandGroup>
              {list.map((m) => (
                <CommandItem key={m.id} value={m.name} onSelect={() => { onSelect(m.name); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === m.name ? "opacity-100" : "opacity-0")} />
                  {m.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
