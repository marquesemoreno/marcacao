"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const priceOptions = [
  { value: "any", label: "Qualquer preço" },
  { value: "100", label: "Até R$ 100" },
  { value: "200", label: "Até R$ 200" },
  { value: "500", label: "Até R$ 500" },
];

const appointmentTypeOptions = [
  { value: "any", label: "Qualquer tipo" },
  { value: "SCHEDULED", label: "Horário marcado" },
  { value: "ARRIVAL_ORDER", label: "Ordem de chegada" },
];

const ratingOptions = [
  { value: "any", label: "Qualquer avaliação" },
  { value: "4", label: "4+ estrelas" },
  { value: "4.5", label: "4.5+ estrelas" },
];

function labelFor(options: { value: string; label: string }[], value: string | null) {
  return options.find((option) => option.value === value)?.label ?? options[0].label;
}

export function ResultFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string | null) {
    if (value === null) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === "any") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/buscar?${params.toString()}`);
  }

  const priceValue = searchParams.get("maxPrice") ?? "any";
  const appointmentTypeValue = searchParams.get("appointmentType") ?? "any";
  const ratingValue = searchParams.get("minRating") ?? "any";

  return (
    <div className="grid grid-cols-3 gap-2">
      <Select
        defaultValue={priceValue}
        onValueChange={(value: string | null) => updateParam("maxPrice", value)}
      >
        <SelectTrigger className="text-xs">
          <SelectValue placeholder="Preço">
            {() => labelFor(priceOptions, priceValue)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {priceOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        defaultValue={appointmentTypeValue}
        onValueChange={(value: string | null) => updateParam("appointmentType", value)}
      >
        <SelectTrigger className="text-xs">
          <SelectValue placeholder="Atendimento">
            {() => labelFor(appointmentTypeOptions, appointmentTypeValue)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {appointmentTypeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        defaultValue={ratingValue}
        onValueChange={(value: string | null) => updateParam("minRating", value)}
      >
        <SelectTrigger className="text-xs">
          <SelectValue placeholder="Avaliação">
            {() => labelFor(ratingOptions, ratingValue)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {ratingOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
