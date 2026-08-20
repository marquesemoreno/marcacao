"use client";

import { useState } from "react";
import { ClipboardList, Stethoscope, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getClinicProceduresAdmin } from "@/actions/admin";
import { formatCurrency } from "@/lib/format";

type ProcedureItem = {
  id: string;
  price: number;
  promotionalPrice: number | null;
  requiresAppointment: boolean;
  procedure: {
    name: string;
    category: string;
    specialty: { name: string } | null;
  };
};

export function ViewProceduresModal({
  clinicId,
  clinicName,
  totalProceduresCount,
}: {
  clinicId: string;
  clinicName: string;
  totalProceduresCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [procedures, setProcedures] = useState<ProcedureItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  async function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen);
    if (newOpen && procedures.length === 0) {
      setLoading(true);
      try {
        const res = await getClinicProceduresAdmin(clinicId);
        setProcedures(res as unknown as ProcedureItem[]);
      } catch {
        console.error("Erro ao buscar procedimentos");
      } finally {
        setLoading(false);
      }
    }
  }

  const filtered = procedures.filter((p) =>
    p.procedure.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.procedure.specialty?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
      >
        <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
        <span>Ver Procedimentos ({totalProceduresCount})</span>
      </DialogTrigger>

      <DialogContent className="max-w-2xl rounded-3xl p-6 sm:p-8">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-emerald-600" />
            Procedimentos e Tabela de Preços — {clinicName}
          </DialogTitle>
          <p className="text-xs text-slate-500 font-medium">
            Procedimentos ativos vinculados a esta unidade credenciada no Conecta Saúde.
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar procedimento ou especialidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
            {loading ? (
              <div className="p-8 text-center text-xs font-semibold text-slate-400">
                Carregando catálogo de procedimentos...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-xs font-semibold text-slate-400">
                Nenhum procedimento encontrado nesta unidade.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-3 font-bold text-slate-700">Procedimento / Exame</th>
                    <th className="p-3 font-bold text-slate-700">Especialidade</th>
                    <th className="p-3 font-bold text-slate-700">Preço Regular</th>
                    <th className="p-3 font-bold text-emerald-700">Preço Conecta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="p-3 font-bold text-slate-900">{item.procedure.name}</td>
                      <td className="p-3 text-slate-500">{item.procedure.specialty?.name || "Geral"}</td>
                      <td className="p-3 font-mono text-slate-500">{formatCurrency(item.price)}</td>
                      <td className="p-3 font-mono font-extrabold text-emerald-700">
                        {formatCurrency(item.promotionalPrice || item.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
