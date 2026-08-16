"use client";

import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import type { CannedResponse } from "@prisma/client";

export function CannedResponseMenu({
  responses,
  query,
  onSelect,
}: {
  responses: CannedResponse[];
  query: string;
  onSelect: (response: CannedResponse) => void;
}) {
  const filtered = responses.filter((response) =>
    response.shortcut.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="absolute bottom-full left-0 z-20 mb-2 w-full max-w-sm rounded-lg border bg-popover shadow-md">
      <Command shouldFilter={false}>
        <CommandList>
          <CommandEmpty className="py-3 text-sm">Nenhuma resposta rápida encontrada.</CommandEmpty>
          <CommandGroup heading="Respostas rápidas">
            {filtered.map((response) => (
              <CommandItem key={response.id} onSelect={() => onSelect(response)}>
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-primary">{response.shortcut}</span>
                  <span className="truncate text-xs text-muted-foreground">{response.content}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
