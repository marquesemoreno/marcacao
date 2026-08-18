"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Stethoscope, FlaskConical, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Category = "CONSULTATION" | "EXAM";

const cityOptions = [
  { value: "any", label: "📍 Selecione a Cidade" },
  { value: "Vitória da Conquista", label: "Vitória da Conquista" },
  { value: "Planalto", label: "Planalto" },
  { value: "Barra do Choça", label: "Barra do Choça" },
  { value: "Poções", label: "Poções" },
  { value: "Itambé", label: "Itambé" },
];

const quickFilters = [
  { label: "⚡ Atendimento Hoje", query: "Clínico Geral", category: "CONSULTATION" as Category },
  { label: "🔬 Ultrassom com Jejum", query: "Ultrassom Abdominal", category: "EXAM" as Category },
  { label: "🩺 Clínico Centro", query: "Clínico Geral", category: "CONSULTATION" as Category, neighborhood: "Centro" },
  { label: "👁️ Oftalmo", query: "Oftalmologia", category: "CONSULTATION" as Category },
];

export function HeroSearch() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("CONSULTATION");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("any");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    params.set("category", category);
    if (query.trim()) params.set("q", query.trim());
    if (city !== "any") params.set("cidade", city);
    router.push(`/procedimentos?${params.toString()}`);
  }

  function handleQuickFilter(filter: (typeof quickFilters)[number]) {
    setCategory(filter.category);
    setQuery(filter.query);
    const params = new URLSearchParams();
    params.set("category", filter.category);
    params.set("q", filter.query);
    if (filter.neighborhood) params.set("bairro", filter.neighborhood);
    if (city !== "any") params.set("cidade", city);
    router.push(`/procedimentos?${params.toString()}`);
  }

  return (
    <div className="w-full text-left">
      {/* Floating Card (App / Glassmorphism Style - Oscar Health / Stripe aesthetic) */}
      <div className="w-full rounded-3xl border border-slate-200/80 bg-white/95 p-3.5 sm:p-5 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.06)] backdrop-blur-md transition-all hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)]">
        
        {/* Upper Sliding Pill Tabs */}
        <div className="mb-4 flex items-center justify-between">
          <div className="inline-flex rounded-2xl bg-slate-100/90 p-1 border border-slate-200/60 shadow-inner">
            <button
              type="button"
              onClick={() => setCategory("CONSULTATION")}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold tracking-tight transition-all duration-200",
                category === "CONSULTATION"
                  ? "bg-white text-sky-700 shadow-sm shadow-slate-300/40 font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <span>🩺</span>
              <span>Consultas</span>
            </button>
            <button
              type="button"
              onClick={() => setCategory("EXAM")}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold tracking-tight transition-all duration-200",
                category === "EXAM"
                  ? "bg-white text-teal-700 shadow-sm shadow-slate-300/40 font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <span>🧪</span>
              <span>Exames</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200/80 shadow-2xs font-mono">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            <span>💬 Valores sob consulta</span>
          </div>
        </div>

        {/* 3 Integrated Search Fields */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          {/* Field 1: Seletor de Cidade */}
          <div className="relative flex-1 rounded-2xl border border-slate-200 bg-slate-50/70 p-1.5 transition-all focus-within:border-sky-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-500/20">
            <div className="flex items-center px-2.5 py-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100/70 text-sky-600 mr-2.5 shrink-0">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Cidade / Região
                </label>
                <select
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none cursor-pointer"
                  aria-label="Cidade ou região"
                >
                  {cityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Field 2: Campo de Especialidade ou Exame */}
          <div className="relative flex-[1.6] rounded-2xl border border-slate-200 bg-slate-50/70 p-1.5 transition-all focus-within:border-sky-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-500/20">
            <div className="flex items-center px-2.5 py-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100/70 text-emerald-600 mr-2.5 shrink-0">
                {category === "CONSULTATION" ? (
                  <Stethoscope className="h-4 w-4" />
                ) : (
                  <FlaskConical className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Especialidade, Exame ou Médico
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    category === "CONSULTATION"
                      ? "Ex: Clínico Geral, Cardiologista, Oftalmo..."
                      : "Ex: Ultrassom, Hemograma, Ressonância..."
                  }
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none"
                  aria-label="Especialidade ou exame"
                />
              </div>
            </div>
          </div>

          {/* Field 3: Botão de Busca Imponente */}
          <div className="lg:w-auto">
            <Button
              type="submit"
              size="lg"
              className="group h-[56px] w-full gap-2 rounded-2xl bg-gradient-to-r from-sky-600 via-teal-600 to-emerald-600 px-8 text-base font-bold text-white shadow-lg shadow-sky-600/25 transition-all duration-300 hover:opacity-95 hover:shadow-xl hover:shadow-teal-600/30 active:scale-[0.98] lg:w-auto"
            >
              <Search className="h-5 w-5 transition-transform group-hover:scale-110" />
              <span>Buscar</span>
            </Button>
          </div>
        </form>

        {/* Quick Filter Pills */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1 font-mono">
            Mais buscados:
          </span>
          {quickFilters.map((filter) => (
            <button
              key={filter.label}
              type="button"
              onClick={() => handleQuickFilter(filter)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50/80 px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-all hover:border-sky-300 hover:bg-sky-50/60 hover:text-sky-800"
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
