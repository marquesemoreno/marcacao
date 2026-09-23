"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const periodOptions = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

export function PeriodFilter({ basePath }: { basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentValue = searchParams.get("days") ?? "30";
  const currentLabel = periodOptions.find((option) => option.value === currentValue)?.label ?? periodOptions[1].label;

  function updatePeriod(value: string | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("days", value);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <Select defaultValue={currentValue} onValueChange={updatePeriod}>
      <SelectTrigger className="w-full sm:w-56">
        <SelectValue placeholder="Período">{() => currentLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {periodOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
