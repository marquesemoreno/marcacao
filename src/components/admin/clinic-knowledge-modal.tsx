"use client";

import { useState } from "react";
import type { ClinicKnowledgeCategory } from "@prisma/client";
import { BookOpen, Loader2, Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listClinicKnowledge,
  createClinicKnowledgeEntry,
  updateClinicKnowledgeEntry,
  toggleClinicKnowledgeEntry,
  deleteClinicKnowledgeEntry,
} from "@/actions/admin-clinic-knowledge";

type Entry = Awaited<ReturnType<typeof listClinicKnowledge>>[number];

const CATEGORY_OPTIONS: { value: ClinicKnowledgeCategory; label: string }[] = [
  { value: "CORPO_CLINICO", label: "Corpo clínico" },
  { value: "HORARIO_ATENDIMENTO", label: "Horário de atendimento" },
  { value: "CONVENIOS", label: "Convênios aceitos" },
  { value: "VALORES", label: "Valores particulares" },
  { value: "REGRAS_RETORNO", label: "Regras de retorno" },
  { value: "PREPARO_EXAME", label: "Preparo de exames" },
  { value: "OUTRO", label: "Outras informações" },
];
const CATEGORY_LABEL: Record<ClinicKnowledgeCategory, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label])
) as Record<ClinicKnowledgeCategory, string>;

const EMPTY_FORM = { category: "OUTRO" as ClinicKnowledgeCategory, title: "", content: "" };

export function ClinicKnowledgeModal({ clinicId, clinicName }: { clinicId: string; clinicName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isFormOpen, setIsFormOpen] = useState(false);

  async function loadEntries() {
    setLoading(true);
    try {
      setEntries(await listClinicKnowledge(clinicId));
    } catch {
      toast.error("Erro ao carregar a base de conhecimento.");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      loadEntries();
    } else {
      setIsFormOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
  }

  function startNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  }

  function startEdit(entry: Entry) {
    setEditingId(entry.id);
    setForm({ category: entry.category, title: entry.title, content: entry.content });
    setIsFormOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId) {
        const current = entries.find((e) => e.id === editingId);
        await updateClinicKnowledgeEntry(editingId, { ...form, active: current?.active ?? true });
        toast.success("Entrada atualizada.");
      } else {
        await createClinicKnowledgeEntry(clinicId, form);
        toast.success("Entrada criada.");
      }
      setIsFormOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadEntries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(entry: Entry) {
    try {
      await toggleClinicKnowledgeEntry(entry.id, !entry.active);
      await loadEntries();
    } catch {
      toast.error("Erro ao atualizar.");
    }
  }

  async function handleDelete(entry: Entry) {
    if (!confirm(`Apagar "${entry.title}"?`)) return;
    try {
      await deleteClinicKnowledgeEntry(entry.id);
      toast.success("Entrada removida.");
      await loadEntries();
    } catch {
      toast.error("Erro ao remover.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className="inline-flex items-center justify-center w-9 h-9 text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 rounded-xl transition-all cursor-pointer"
        title="Base de Conhecimento"
        aria-label="Base de Conhecimento"
      >
        <BookOpen className="w-4 h-4" />
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            Base de Conhecimento — {clinicName}
          </DialogTitle>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Corpo clínico, horários, convênios, valores, regras de retorno e preparo de exames.
            O atendente de IA e o Copilot de sugestões usam ESTRITAMENTE o que estiver aqui pra
            responder sobre isso — nunca inventam. Sem nenhuma entrada, seguem só as instruções
            gerais da clínica.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="p-8 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {!isFormOpen && (
              <button
                type="button"
                onClick={startNew}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-dashed border-sky-300 dark:border-sky-800 rounded-xl transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Nova entrada
              </button>
            )}

            {isFormOpen && (
              <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {editingId ? "Editar entrada" : "Nova entrada"}
                  </span>
                  <button type="button" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <Select value={form.category} onValueChange={(v) => v && setForm((f) => ({ ...f, category: v as ClinicKnowledgeCategory }))}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Categoria">{() => CATEGORY_LABEL[form.category]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <input
                  type="text"
                  placeholder="Título (ex: Preparo para Urodinâmica)"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />

                <textarea
                  rows={4}
                  placeholder="Conteúdo (ex: Jejum de 8h, chegar 15min antes, trazer pedido médico...)"
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none"
                />

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-xl transition-all"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar entrada"}
                </button>
              </div>
            )}

            {entries.length === 0 && !isFormOpen ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
                Nenhuma entrada cadastrada ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`p-3 rounded-xl border ${
                      entry.active
                        ? "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                        : "border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/40 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                            {CATEGORY_LABEL[entry.category]}
                          </span>
                          {!entry.active && (
                            <span className="text-[10px] font-bold text-slate-400">Desativada</span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1">{entry.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 whitespace-pre-wrap">{entry.content}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggle(entry)}
                          className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 px-1.5 py-1"
                          title={entry.active ? "Desativar" : "Ativar"}
                        >
                          {entry.active ? "Desativar" : "Ativar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          className="p-1.5 text-slate-400 hover:text-sky-700 dark:hover:text-sky-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
