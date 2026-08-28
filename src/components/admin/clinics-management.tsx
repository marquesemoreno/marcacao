"use client";

import { useState } from "react";
import { Search, MapPin, Phone, MessageSquare, Percent, Save, Store, MessagesSquare } from "lucide-react";
import { updateClinicCommission, toggleClinicActive, toggleClinicMarketplaceListing } from "@/actions/admin";
import { CreateClinicModal } from "./create-clinic-modal";
import { ViewProceduresModal } from "./view-procedures-modal";
import { WhatsappInstanceModal } from "./whatsapp-instance-modal";
import { HospitalIntegrationModal } from "./hospital-integration-modal";
import { ClinicAttendantsModal } from "./clinic-attendants-modal";
import { WelcomeMessageModal } from "./welcome-message-modal";
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
  listedInMarketplace: boolean;
  welcomeMessageEnabled: boolean;
  welcomeMessageText: string | null;
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

  async function handleToggleMarketplaceListing(clinicId: string, currentlyListed: boolean) {
    const nextState = !currentlyListed;
    setClinics((prev) => prev.map((c) => (c.id === clinicId ? { ...c, listedInMarketplace: nextState } : c)));
    try {
      await toggleClinicMarketplaceListing(clinicId, nextState);
      toast.success(
        nextState
          ? "Clínica volta a aparecer no site (busca, home, /clinicas)."
          : "Clínica escondida do site — continua usando o chat/CRM normalmente."
      );
    } catch {
      setClinics((prev) => prev.map((c) => (c.id === clinicId ? { ...c, listedInMarketplace: currentlyListed } : c)));
      toast.error("Erro ao alterar a visibilidade da clínica no marketplace.");
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
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 p-4 sm:p-6 flex-1 overflow-y-auto">
      {/* =========================================================================
          CABEÇALHO & BARRA DE FERRAMENTAS
         ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Gestão de Clínicas e Centros Credenciados
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            Controle de unidades parceiras, taxas de comissão da plataforma e status operacional da rede.
          </p>
        </div>

        <CreateClinicModal />
      </div>

      {/* =========================================================================
          BARRA DE NAVEGAÇÃO / FILTROS E BUSCA
         ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        {/* Pílulas de Filtro de Status */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === "all"
                ? "bg-slate-900 dark:bg-emerald-600 text-white shadow-2xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
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
                : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800"
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
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Pausadas ({pausedCount})
          </button>
        </div>

        {/* Campo de Busca Rápida */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Buscar clínica, CNPJ ou bairro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* =========================================================================
          GRID DE CARDS DE CLÍNICAS (STRIPE DASHBOARD STYLE)
         ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredClinics.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhuma clínica encontrada</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Tente ajustar o termo de busca ou o filtro de status selecionado.</p>
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
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xs border border-slate-200/80 dark:border-slate-800 hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4 group"
              >
                {/* TOPO DO CARD: AVATAR, NOME E STATUS */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-sm shadow-2xs ${avatarColor}`}>
                      {initials}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {clinic.tradeName}
                      </h3>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium line-clamp-1">
                        {clinic.name}
                      </p>
                    </div>
                  </div>

                  {/* TOGGLE / BADGE STATUS */}
                  <div className="flex flex-col items-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(clinic.id, clinic.active)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 border ${
                        clinic.active
                          ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
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

                    <button
                      type="button"
                      onClick={() => handleToggleMarketplaceListing(clinic.id, clinic.listedInMarketplace)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 border ${
                        clinic.listedInMarketplace
                          ? "bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800 hover:bg-sky-100"
                          : "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100"
                      }`}
                      title="Clique para alternar se a clínica aparece no site (busca, home, /clinicas) — o chat/CRM continua funcionando dos dois jeitos"
                    >
                      {clinic.listedInMarketplace ? (
                        <>
                          <Store className="w-3 h-3" />
                          <span>No Site</span>
                        </>
                      ) : (
                        <>
                          <MessagesSquare className="w-3 h-3" />
                          <span>Só CRM</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* DETALHES DE LOCALIZAÇÃO E CONTATO */}
                <div className="space-y-2 text-xs font-medium text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">CNPJ: {clinic.cnpj}</span>
                    <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
                      <MapPin className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      {clinic.neighborhood}, {clinic.city}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-1 text-slate-500 dark:text-slate-400 text-[11px]">
                    {clinic.phone && (
                      <a href={`tel:${clinic.phone}`} className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{clinic.phone}</span>
                      </a>
                    )}
                    {clinic.whatsapp && (
                      <a href={whatsappUrl || "#"} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-semibold transition-colors">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{clinic.whatsapp}</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* CONTROLE DE COMISSÃO DA CONECTA SAÚDE */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                      Taxa da Plataforma
                    </span>
                    <div className="relative mt-0.5 flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 absolute left-2" />
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={currentRate}
                        onChange={(e) =>
                          setEditingRates((prev) => ({ ...prev, [clinic.id]: parseFloat(e.target.value) || 0 }))
                        }
                        className="w-20 pl-7 pr-2 py-1 text-xs font-mono font-bold bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-purple-900 dark:text-purple-300"
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
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <ViewProceduresModal
                      clinicId={clinic.id}
                      clinicName={clinic.tradeName}
                      totalProceduresCount={clinic._count?.clinicProcedures || 0}
                    />
                    <WhatsappInstanceModal clinicId={clinic.id} clinicName={clinic.tradeName} />
                    <HospitalIntegrationModal clinicId={clinic.id} clinicName={clinic.tradeName} />
                    <ClinicAttendantsModal clinicId={clinic.id} clinicName={clinic.tradeName} />
                    <WelcomeMessageModal
                      clinicId={clinic.id}
                      clinicName={clinic.tradeName}
                      initialEnabled={clinic.welcomeMessageEnabled}
                      initialText={clinic.welcomeMessageText ?? ""}
                      onSaved={(enabled, text) =>
                        setClinics((prev) =>
                          prev.map((c) =>
                            c.id === clinic.id ? { ...c, welcomeMessageEnabled: enabled, welcomeMessageText: text } : c
                          )
                        )
                      }
                    />
                  </div>

                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-all"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
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
