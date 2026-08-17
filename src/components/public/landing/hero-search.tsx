"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Stethoscope, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Category = "CONSULTATION" | "EXAM";

const appointmentTypeOptions = [
  { value: "any", label: "Hora marcada ou ordem de chegada" },
  { value: "SCHEDULED", label: "Hora marcada" },
  { value: "ARRIVAL_ORDER", label: "Ordem de chegada" },
];

const cityOptions = [
  { value: "any", label: "Qualquer cidade" },
  { value: "Vitória da Conquista", label: "Vitória da Conquista" },
  { value: "Planalto", label: "Planalto" },
];

const selectClassName =
  "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none transition-colors focus-visible:border-sky-500 focus-visible:ring-3 focus-visible:ring-sky-500/20 sm:w-56";

export function HeroSearch() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("CONSULTATION");
  const [query, setQuery] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("any");
  const [appointmentType, setAppointmentType] = useState("any");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    params.set("category", category);
    if (query.trim()) params.set("q", query.trim());
    if (neighborhood.trim()) params.set("bairro", neighborhood.trim());
    if (city !== "any") params.set("cidade", city);
    if (appointmentType !== "any") params.set("appointmentType", appointmentType);
    router.push(`/buscar?${params.toString()}`);
  }

  return (
    <div className="w-full rounded-3xl border border-slate-200 bg-white/95 p-3 shadow-lg shadow-sky-900/5 backdrop-blur sm:p-4">
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setCategory("CONSULTATION")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors sm:flex-none",
            category === "CONSULTATION"
              ? "bg-sky-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          )}
        >
          <Stethoscope className="h-4 w-4" />
          Consultas Médicas
        </button>
        <button
          type="button"
          onClick={() => setCategory("EXAM")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors sm:flex-none",
            category === "EXAM"
              ? "bg-teal-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          )}
        >
          <FlaskConical className="h-4 w-4" />
          Exames Laboratoriais/Imagem
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 lg:flex-row">
        <div className="relative flex-[1.3]">
          <Stethoscope className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={category === "CONSULTATION" ? "Especialidade ou médico" : "Exame ou procedimento"}
            className="h-12 rounded-xl border-slate-200 pl-10 text-base"
            aria-label="Procedimento ou especialidade"
          />
        </div>
        <div className="relative flex-1">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <Input
            value={neighborhood}
            onChange={(event) => setNeighborhood(event.target.value)}
            placeholder="Bairro ou região"
            className="h-12 rounded-xl border-slate-200 pl-10 text-base"
            aria-label="Bairro ou região"
          />
        </div>
        <select
          value={city}
          onChange={(event) => setCity(event.target.value)}
          className={cn(selectClassName, "sm:w-48")}
          aria-label="Cidade"
        >
          {cityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={appointmentType}
          onChange={(event) => setAppointmentType(event.target.value)}
          className={selectClassName}
          aria-label="Tipo de atendimento"
        >
          {appointmentTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          size="lg"
          className="h-12 gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 px-6 text-base text-white hover:from-sky-700 hover:to-emerald-700"
        >
          <Search className="h-5 w-5" />
          Buscar
        </Button>
      </form>
    </div>
  );
}
