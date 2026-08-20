"use client";

import { useState } from "react";
import { Search, MapPin, Phone, MessageSquare, Percent, Save, CheckCircle2, XCircle } from "lucide-react";
import { updateClinicCommission, toggleClinicActive } from "@/actions/admin";
import { CreateClinicModal } from "./create-clinic-modal";
import { ViewProceduresModal } from "./view-procedures-modal";
import { toast } from "sonner";

export type ClinicItem = {
  id: string;
  name: string;
  tradeName: string;
  cnpj: string;
  phone: string | null;
  whatsapp: string | null;
  address: string;
  neighborhood: string;
  city: string;
  active: boolean;
  commissionRate: number;
  _count?: {
    clinicProcedures: number;
    users: number;
  };
};

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(id: string): string {
  const colors = [
    "bg-emerald-600 text-white",
    "bg-indigo-600 text-white",
    "bg-purple-600 text-white",
    "bg-sky-600 text-white",
    "bg-teal-600 text-white",
    "bg-blue-600 text-white",
  ];
  let charCodeSum = 0;
  for (let i = 0; i < id.length; i++) {
    charCodeSum += id.charCodeAt(i);
  }
  return colors[charCodeSum % colors.length];
}

export function ClinicsManagement({ clinics: initialClinics }: { clinics: ClinicItem[] }) {
  const [clinics, setClinics] = useState<ClinicItem[]>(initialClinics);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");
  const [editingRates, setEditingRates] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const activeCount = clinics.filter((c) => c.active).length;
  const pausedCount = clinics.filter((c) => !c.active).length;

  const filteredClinics = clinics.filter((clinic) => {
    const matchesStatus =
      statusFilter === "all" ? true : statusFilter === "active" ? clinic.active : !clinic.active;

    const term = search.toLowerCase().trim();
    const matchesSearch =
      !term ||
      clinic.tradeName.toLowerCase().includes(term) ||
      clinic.name.toLowerCase().includes(term) ||
      clinic.cnpj.includes(term) ||
      clinic.neighborhood.toLowerCase().includes(term) ||
      clinic.city.toLowerCase().includes(term);

    return matchesStatus && matchesSearch;
  });

  async function handleToggleActive(clinicId: string, currentActive: boolean) {
    const nextState = !currentActive;
    setClinics((prev) => prev.map((c) => (c.id === clinicId ? { ...c, active: nextState } : c)));
    try {
      await toggleClinicActive(clinicId, nextState);
      toast.success(nextState ? "Clínica ativada na rede!" : "Clínica pausada temporariamente.");
    } catch {
      setClinics((prev) => prev.map((c) => (c.id === clinicId ? { ...c, active: currentActive } : c)));
      toast.error("Erro ao alterar status da clínica.");
    }
  }

  async function handleSaveCommission(clinicId: string) {
    const rateToSave = editingRates[clinicId];
    if (rateToSave === undefined) return;

    setSavingId(clinicId);
    try {
      const res = await updateClinicCommission(clinicId, rateToSave);
      setClinics((prev) => prev.map((c) => (c.id === clinicId ? { ...c, commissionRate: rateToSave } : c)));
      toast.success(res.message);
    } catch {
      toast.error("Erro ao atualizar taxa de comissão.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6 font-sans">
      {/* =========================================================================
          CABEÇALHO & BARRA DE FERRAMENTAS
         ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Gestão de Clínicas e Centros Credenciados
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Controle de unidades parceiras, taxas de comissão da plataforma e status operacional da rede.
          </p>
        </div>

        <CreateClinicModal />
      </div>

      {/* =========================================================================
          BARRA DE NAVEGAÇÃO / FILTROS E BUSCA
         ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Pílulas de Filtro de Status */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === "all"
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Todas ({clinics.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === "active"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Ativas ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("paused")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              statusFilter === "paused"
                ? "bg-slate-700 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Pausadas ({pausedCount})
          </button>
        </div>

        {/* Campo de Busca Rápida */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar clínica, CNPJ ou bairro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* =========================================================================
          GRID DE CARDS DE CLÍNICAS (STRIPE DASHBOARD STYLE)
         ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredClinics.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-2">
            <p className="text-sm font-bold text-slate-700">Nenhuma clínica encontrada</p>
            <p className="text-xs text-slate-400">Tente ajustar o termo de busca ou o filtro de status selecionado.</p>
          </div>
        ) : (
          filteredClinics.map((clinic) => {
            const avatarColor = getAvatarColor(clinic.id);
            const initials = getInitials(clinic.tradeName);
            const currentRate = editingRates[clinic.id] ?? clinic.commissionRate;
            const isChanged = editingRates[clinic.id] !== undefined && editingRates[clinic.id] !== clinic.commissionRate;
            const cleanPhone = clinic.whatsapp ? clinic.whatsapp.replace(/\D/g, "") : null;
            const whatsappUrl = cleanPhone ? `https://wa.me/55${cleanPhone}` : null;

            return (
              <div
                key={clinic.id}
                className="bg-white rounded-3xl p-6 shadow-2xs border border-slate-200/80 hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4 group"
              >
                {/* TOPO DO CARD: AVATAR, NOME E STATUS */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-sm shadow-2xs ${avatarColor}`}>
                      {initials}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                        {clinic.tradeName}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium line-clamp-1">
                        {clinic.name}
                      </p>
                    </div>
                  </div>

                  {/* TOGGLE / BADGE STATUS */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(clinic.id, clinic.active)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 border ${
                      clinic.active
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                    }`}
                    title="Clique para alternar o status operacional da clínica na rede"
                  >
                    {clinic.active ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Ativa</span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span>Pausada</span>
                      </>
                    )}
                  </button>
                </div>

                {/* DETALHES DE LOCALIZAÇÃO E CONTATO */}
                <div className="space-y-2 text-xs font-medium text-slate-600 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-mono">CNPJ: {clinic.cnpj}</span>
                    <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 text-[11px] font-semibold">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {clinic.neighborhood}, {clinic.city}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-1 text-slate-500 text-[11px]">
                    {clinic.phone && (
                      <a href={`tel:${clinic.phone}`} className="flex items-center gap-1 hover:text-slate-900 transition-colors">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{clinic.phone}</span>
                      </a>
                    )}
                    {clinic.whatsapp && (
                      <a href={whatsappUrl || "#"} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold transition-colors">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{clinic.whatsapp}</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* CONTROLE DE COMISSÃO DA CONECTA SAÚDE */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                      Taxa da Plataforma
                    </span>
                    <div className="relative mt-0.5 flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-purple-600 absolute left-2" />
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={currentRate}
                        onChange={(e) =>
                          setEditingRates((prev) => ({ ...prev, [clinic.id]: parseFloat(e.target.value) || 0 }))
                        }
                        className="w-20 pl-7 pr-2 py-1 text-xs font-mono font-bold bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-purple-900"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!isChanged || savingId === clinic.id}
                    onClick={() => handleSaveCommission(clinic.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:hover:bg-purple-600 rounded-xl transition-all shadow-2xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingId === clinic.id ? "Salvando..." : "Salvar Taxa"}</span>
                  </button>
                </div>

                {/* BOTÕES DE AÇÃO RÁPIDA */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <ViewProceduresModal
                    clinicId={clinic.id}
                    clinicName={clinic.tradeName}
                    totalProceduresCount={clinic._count?.clinicProcedures || 0}
                  />

                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
