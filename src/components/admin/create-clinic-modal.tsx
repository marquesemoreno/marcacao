"use client";

import { useState } from "react";
import { Plus, Building2, MapPin, Phone, Percent } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createClinic } from "@/actions/admin";
import { toast } from "sonner";

export function CreateClinicModal() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    try {
      await createClinic(formData);
      toast.success("Clínica cadastrada na rede com sucesso!");
      setOpen(false);
    } catch {
      toast.error("Erro ao cadastrar clínica. Verifique os dados inseridos.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 rounded-xl shadow-xs transition-all"
      >
        <Plus className="w-4 h-4" />
        <span>Cadastrar Nova Clínica</span>
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            Cadastrar Nova Clínica Parceira
          </DialogTitle>
          <p className="text-xs text-slate-500 font-medium">
            Preencha os dados cadastrais da nova unidade parceira para ingressar na rede Conecta Saúde.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Nome Fantasia *
              </label>
              <input
                name="tradeName"
                required
                placeholder="Ex: Clínica Santa Clara"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Razão Social *
              </label>
              <input
                name="name"
                required
                placeholder="Ex: Santa Clara Serviços Médicos LTDA"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                CNPJ *
              </label>
              <input
                name="cnpj"
                required
                placeholder="00.000.000/0001-00"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Telefone
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  name="phone"
                  placeholder="(77) 3421-0000"
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                WhatsApp Recepção
              </label>
              <input
                name="whatsapp"
                placeholder="(77) 99999-8888"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-3 pt-1 border-t border-slate-100">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                Endereço Completo *
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  name="address"
                  required
                  placeholder="Ex: Av. Otávio Santos, 142"
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Bairro *
                </label>
                <input
                  name="neighborhood"
                  required
                  placeholder="Ex: Recreio"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Cidade *
                </label>
                <input
                  name="city"
                  required
                  defaultValue="Vitória da Conquista"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Comissão (%) *
                </label>
                <div className="relative">
                  <Percent className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    name="commissionRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    defaultValue="15"
                    required
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-xs disabled:opacity-60"
            >
              {isSubmitting ? "Cadastrando..." : "Confirmar Cadastro"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
