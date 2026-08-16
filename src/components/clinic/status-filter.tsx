"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { appointmentStatusLabels } from "@/lib/format";

const statusOptions = [
  { value: "any", label: "Todos os status" },
  ...Object.entries(appointmentStatusLabels).map(([value, label]) => ({ value, label })),
];

export function StatusFilter({ basePath }: { basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentValue = searchParams.get("status") ?? "any";
  const currentLabel =
    statusOptions.find((option) => option.value === currentValue)?.label ?? statusOptions[0].label;

  function updateStatus(value: string | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === "any") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <Select defaultValue={currentValue} onValueChange={updateStatus}>
      <SelectTrigger className="w-full sm:w-56">
        <SelectValue placeholder="Status">{() => currentLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
