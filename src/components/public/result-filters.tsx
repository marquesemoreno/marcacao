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

const cityOptions = [
  { value: "any", label: "Qualquer cidade" },
  { value: "Vitória da Conquista", label: "Vitória da Conquista" },
  { value: "Planalto", label: "Planalto" },
  { value: "Barra do Choça", label: "Barra do Choça" },
  { value: "Poções", label: "Poções" },
  { value: "Itambé", label: "Itambé" },
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
  const cityValue = searchParams.get("cidade") ?? "any";

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Select
        defaultValue={cityValue}
        onValueChange={(value: string | null) => updateParam("cidade", value)}
      >
        <SelectTrigger className="text-xs">
          <SelectValue placeholder="Cidade">
            {() => labelFor(cityOptions, cityValue)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {cityOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
