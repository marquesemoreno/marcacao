"use client";

import { useMemo, useState } from "react";
import type { ProcedureCategory } from "@prisma/client";
import { Search, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { updateClinicProcedure } from "@/actions/clinic";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { appointmentTypeLabels, categoryLabels } from "@/lib/format";
import { formatProcedureName } from "@/lib/procedure-name";
import { AddProcedureDialog } from "@/components/clinic/add-procedure-dialog";
import type { PlainClinicProcedureItem } from "@/lib/serialize";
import type { Procedure } from "@prisma/client";

const CATEGORY_FILTERS: { value: ProcedureCategory | "ALL"; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "CONSULTATION", label: "Consultas" },
  { value: "EXAM", label: "Exames" },
  { value: "SURGERY", label: "Cirurgias" },
];

const CATEGORY_BADGE_CLASSES: Record<ProcedureCategory, string> = {
  CONSULTATION: "bg-sky-50 text-sky-700 border-sky-200",
  EXAM: "bg-violet-50 text-violet-700 border-violet-200",
  SURGERY: "bg-rose-50 text-rose-700 border-rose-200",
};

function ProcedureRow({ item }: { item: PlainClinicProcedureItem }) {
  const { isPending, run } = useActionFeedback();
  const displayName = formatProcedureName(item.procedure.name);

  // <form> não pode envolver <td> (HTML de tabela inválido) — cada célula fica com seu
  // próprio estado controlado (não dá pra usar ref: o <Input> deste projeto não é
  // forwardRef, React 18 nem anexaria a ref) e o botão "Salvar" monta o FormData na
  // mão em vez de depender de submit nativo. updateClinicProcedure continua recebendo
  // o mesmo FormData de sempre, sem mudança de contrato com o backend.
  const [price, setPrice] = useState(item.price.toString());
  const [promotionalPrice, setPromotionalPrice] = useState(item.promotionalPrice?.toString() ?? "");
  const [appointmentType, setAppointmentType] = useState(item.appointmentType);
  const [requiresAppointment, setRequiresAppointment] = useState(item.requiresAppointment);

  function handleSave() {
    const formData = new FormData();
    formData.set("price", price);
    formData.set("promotionalPrice", promotionalPrice);
    formData.set("appointmentType", appointmentType);
    if (requiresAppointment) formData.set("requiresAppointment", "on");
    run(() => updateClinicProcedure(item.id, formData), {
      successMessage: `Preço de "${displayName}" atualizado.`,
      errorMessage: "Não foi possível salvar. Confira os valores e tente novamente.",
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium text-slate-800 max-w-[260px] truncate" title={displayName}>
        {displayName}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`rounded-md ${CATEGORY_BADGE_CLASSES[item.procedure.category]}`}>
          {categoryLabels[item.procedure.category]}
        </Badge>
      </TableCell>
      <TableCell>
        <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="h-8 w-28" />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={promotionalPrice}
          onChange={(e) => setPromotionalPrice(e.target.value)}
          className="h-8 w-28"
          placeholder="—"
        />
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <select
            value={appointmentType}
            onChange={(e) => setAppointmentType(e.target.value as typeof appointmentType)}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs"
          >
            {Object.entries(appointmentTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <input
              type="checkbox"
              checked={requiresAppointment}
              onChange={(e) => setRequiresAppointment(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Requer agendamento
          </label>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          title="Salvar alterações"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-2.5 py-1.5 text-xs font-medium text-white transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          {isPending ? "Salvando..." : "Salvar"}
        </button>
      </TableCell>
    </TableRow>
  );
}

export function ProceduresTable({
  clinicProcedures,
  availableProcedures,
}: {
  clinicProcedures: PlainClinicProcedureItem[];
  availableProcedures: Procedure[];
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ProcedureCategory | "ALL">("ALL");

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return clinicProcedures.filter((item) => {
      if (categoryFilter !== "ALL" && item.procedure.category !== categoryFilter) return false;
      if (!normalizedSearch) return true;
      return formatProcedureName(item.procedure.name).toLowerCase().includes(normalizedSearch);
    });
  }, [clinicProcedures, search, categoryFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar procedimento..."
              className="h-9 pl-9"
            />
          </div>
          <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg text-xs font-medium">
            {CATEGORY_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setCategoryFilter(f.value)}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  categoryFilter === f.value ? "bg-white text-slate-900 font-semibold shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <AddProcedureDialog availableProcedures={availableProcedures} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/70">
              <TableHead>Procedimento</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Preço Base (R$)</TableHead>
              <TableHead>Preço Promo (R$)</TableHead>
              <TableHead>Tipo de Vaga</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-slate-400 whitespace-normal">
                  {search || categoryFilter !== "ALL" ? "Nenhum procedimento encontrado para esse filtro." : "Nenhum procedimento cadastrado ainda."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => <ProcedureRow key={item.id} item={item} />)
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
