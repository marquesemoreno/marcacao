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
        className="relative inline-flex items-center justify-center w-9 h-9 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
        title={`Ver Procedimentos (${totalProceduresCount})`}
        aria-label={`Ver Procedimentos (${totalProceduresCount})`}
      >
        <ClipboardList className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        {totalProceduresCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-bold flex items-center justify-center">
            {totalProceduresCount}
          </span>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl rounded-3xl p-6 sm:p-8">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Procedimentos e Tabela de Preços — {clinicName}
          </DialogTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Procedimentos ativos vinculados a esta unidade credenciada no Conecta Saúde.
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="relative">
            <label htmlFor="view-procedures-search" className="sr-only">
              Buscar procedimento ou especialidade
            </label>
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400 dark:text-slate-500" />
            <input
              id="view-procedures-search"
              type="text"
              placeholder="Buscar procedimento ou especialidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
            {loading ? (
              <div className="p-8 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
                Carregando catálogo de procedimentos...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
                Nenhum procedimento encontrado nesta unidade.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                  <tr>
                    <th className="p-3 font-bold text-slate-700 dark:text-slate-300">Procedimento / Exame</th>
                    <th className="p-3 font-bold text-slate-700 dark:text-slate-300">Especialidade</th>
                    <th className="p-3 font-bold text-slate-700 dark:text-slate-300">Preço Regular</th>
                    <th className="p-3 font-bold text-emerald-700 dark:text-emerald-400">Preço Conecta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60">
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{item.procedure.name}</td>
                      <td className="p-3 text-slate-500 dark:text-slate-400">{item.procedure.specialty?.name || "Geral"}</td>
                      <td className="p-3 font-mono text-slate-500 dark:text-slate-400">{formatCurrency(item.price)}</td>
                      <td className="p-3 font-mono font-extrabold text-emerald-700 dark:text-emerald-400">
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
