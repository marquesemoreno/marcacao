"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
  { value: "CONSULTATION", label: "🩺 Consultas" },
  { value: "EXAM", label: "🔬 Exames de Imagem" },
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

const clinicOptions = [
  { value: "any", label: "🏥 Clínica: Todas" },
  { value: "Clinica Cirurgica Santa Clara", label: "Clínica Cirúrgica Santa Clara" },
  { value: "Imad Diagnóstico Por Imagem", label: "IMAD Diagnóstico Por Imagem" },
  { value: "Urolaser - Clínica de Urologia e Diagnóstico", label: "Urolaser Urologia" },
  { value: "Clinique Medical", label: "Clinique Medical" },
  { value: "Acurae", label: "Acurae Saúde" },
  { value: "Clinica Essencial", label: "Clínica Essencial" },
  { value: "Policlínica Mais Médico", label: "Policlínica Mais Médico" },
  { value: "Hospital São Vicente", label: "Hospital São Vicente" },
  { value: "Sonnar", label: "Sonnar Diagnósticos" },
  { value: "Clínica Àgape", label: "Clínica Àgape" },
];

function labelFor(options: { value: string; label: string }[], value: string | null) {
  return options.find((option) => option.value === value)?.label ?? options[0].label;
}

export function ResultFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  function updateParam(key: string, value: string | null) {
    if (value === null) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === "any") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const targetPath = pathname.startsWith("/procedimentos") ? "/procedimentos" : "/procedimentos";
    router.push(`${targetPath}?${params.toString()}`);
  }

  const activeCategory = searchParams.get("category") ?? "any";
  const cityValue = searchParams.get("cidade") ?? "any";
  const neighborhoodValue = searchParams.get("bairro") ?? "any";
  const clinicValue = searchParams.get("clinica") ?? "any";

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
          defaultValue={clinicValue}
          onValueChange={(value: string | null) => updateParam("clinica", value)}
        >
          <SelectTrigger className="!h-10 w-full text-xs font-bold rounded-xl border-slate-200">
            <SelectValue placeholder="Clínica Parceira">
              {() => labelFor(clinicOptions, clinicValue)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {clinicOptions.map((option) => (
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
