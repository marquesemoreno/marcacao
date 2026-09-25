"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Dropdown genérico de filtro do relatório — lê/escreve um único query param,
 * mesmo padrão de PeriodFilter/StatusFilter (URL é a fonte de verdade, sem estado
 * local). `options` já vem com o rótulo "Todos/Todas" incluso como primeiro item
 * (value=""), pra cada instância poder customizar o texto do "sem filtro". */
export function ReportSelectFilter({
  basePath,
  paramKey,
  placeholder,
  options,
}: {
  basePath: string;
  paramKey: string;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentValue = searchParams.get(paramKey) ?? "_all";
  const currentLabel = options.find((o) => o.value === currentValue)?.label ?? options[0]?.label ?? placeholder;

  function update(value: string | null) {
    if (value === null) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === "_all") {
      params.delete(paramKey);
    } else {
      params.set(paramKey, value);
    }
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <Select defaultValue={currentValue} onValueChange={update}>
      <SelectTrigger className="w-full sm:w-48">
        <SelectValue placeholder={placeholder}>{() => currentLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
