"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const categoryTabs = [
  { value: "any", label: "🩺 Todas" },
  { value: "CONSULTATION", label: "🩺 Consultas Médicas" },
  { value: "EXAM", label: "🔬 Exames de Imagem & Diagnóstico" },
  { value: "SURGERY", label: "🏥 Cirurgias & Procedimentos" },
];

const cityOptions = [
  { value: "any", label: "📍 Cidade: Todas" },
  { value: "Vitória da Conquista", label: "Vitória da Conquista" },
  { value: "Planalto", label: "Planalto" },
  { value: "Barra do Choça", label: "Barra do Choça" },
  { value: "Poções", label: "Poções" },
  { value: "Itambé", label: "Itambé" },
];

const neighborhoodOptions = [
  { value: "any", label: "📍 Bairro: Todos" },
  { value: "Centro", label: "Centro" },
  { value: "Recreio", label: "Recreio" },
  { value: "Candeias", label: "Candeias" },
  { value: "Alto Maron", label: "Alto Maron" },
];

const appointmentTypeOptions = [
  { value: "any", label: "Atendimento: Todos" },
  { value: "SCHEDULED", label: "Horário marcado" },
  { value: "ARRIVAL_ORDER", label: "Ordem de chegada" },
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

  const activeCategory = searchParams.get("category") ?? "any";
  const cityValue = searchParams.get("cidade") ?? "any";
  const neighborhoodValue = searchParams.get("bairro") ?? "any";
  const appointmentTypeValue = searchParams.get("appointmentType") ?? "any";

  return (
    <div className="space-y-3.5">
      {/* Category Tabs Header */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {categoryTabs.map((tab) => {
          const isActive = activeCategory === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => updateParam("category", tab.value)}
              className={cn(
                "inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-all border shrink-0",
                isActive
                  ? "bg-teal-600 text-white border-teal-600 shadow-2xs"
                  : "bg-white text-slate-700 border-slate-200 hover:border-teal-300 hover:bg-slate-50"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Select Filters Row */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select
          defaultValue={cityValue}
          onValueChange={(value: string | null) => updateParam("cidade", value)}
        >
          <SelectTrigger className="!h-10 w-full text-xs font-bold rounded-xl border-slate-200">
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
          defaultValue={neighborhoodValue}
          onValueChange={(value: string | null) => updateParam("bairro", value)}
        >
          <SelectTrigger className="!h-10 w-full text-xs font-bold rounded-xl border-slate-200">
            <SelectValue placeholder="Bairro">
              {() => labelFor(neighborhoodOptions, neighborhoodValue)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {neighborhoodOptions.map((option) => (
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
          <SelectTrigger className="!h-10 w-full text-xs font-bold rounded-xl border-slate-200">
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
      </div>
    </div>
  );
}
