"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERIOD_KEYS, parsePeriodKey, periodLabels } from "@/lib/report-period";

/** Seletor de período do relatório — janelas móveis e mês-calendário (`?periodo=`;
 * `?days=` antigo continua valendo). */
export function PeriodFilter({ basePath }: { basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = parsePeriodKey(searchParams.get("periodo") ?? undefined, searchParams.get("days") ?? undefined);

  function updatePeriod(value: string | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("days");
    params.set("periodo", value);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <Select defaultValue={current} onValueChange={updatePeriod}>
      <SelectTrigger className="w-full sm:w-44" aria-label="Período do relatório">
        <SelectValue placeholder="Período">{() => periodLabels(current).short}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PERIOD_KEYS.map((key) => (
          <SelectItem key={key} value={key}>
            {periodLabels(key).short}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
