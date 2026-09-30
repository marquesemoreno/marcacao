"use client";

import { useState } from "react";
import { Plus, X, Phone, IdCard, Stethoscope, ShieldCheck, Calendar } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Contact } from "@/types/chat-crm";
import { tagClasses, renderConsultationRow } from "./patient-record-shared";

interface PatientRecordSheetProps {
  contact: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdatePatient: (data: {
    name: string;
    cpf?: string;
    phone?: string;
    convenio?: string;
    preferredDoctor?: string;
  }) => Promise<{ success: boolean; error?: string } | void> | { success: boolean; error?: string } | void;
  onAddTag: (tag: string) => Promise<void> | void;
  onRemoveTag: (tag: string) => Promise<void> | void;
}

/** Ficha completa do paciente — aditiva ao painel "Perfil & CRM" fixo (que continua
 * servindo de contexto rápido enquanto atende); este Sheet é a visão ampla, aberta ao
 * clicar no nome do paciente no cabeçalho da conversa (ver inbox-layout.tsx). Reaproveita
 * tagClasses/renderConsultationRow (exportados de inbox-layout.tsx) pra não duplicar a
 * renderização de tag/histórico entre os dois lugares. */
export function PatientRecordSheet({ contact, open, onOpenChange, onUpdatePatient, onAddTag, onRemoveTag }: PatientRecordSheetProps) {
  const [convenio, setConvenio] = useState(contact.convenio ?? "");
  const [preferredDoctor, setPreferredDoctor] = useState(contact.preferredDoctor ?? "");
  const [isSavingResumo, setIsSavingResumo] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");

  async function handleSaveResumo() {
    setIsSavingResumo(true);
    try {
      const result = await onUpdatePatient({
        name: contact.name,
        cpf: contact.cpf,
        convenio,
        preferredDoctor,
      });
      if (result && "success" in result && !result.success) {
        toast.error(result.error || "Não foi possível salvar.");
      } else {
        toast.success("Ficha atualizada.");
      }
    } finally {
      setIsSavingResumo(false);
    }
  }

  async function handleAddTag() {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;
    await onAddTag(trimmed);
    setNewTagInput("");
    setIsAddingTag(false);
  }

  const upcoming = contact.consultationHistory.filter((c) => c.isUpcoming);
  const past = contact.consultationHistory.filter((c) => !c.isUpcoming);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl w-full p-0">
        <SheetHeader className="border-b border-slate-200 dark:border-slate-800 p-4">
          <SheetTitle className="text-base">{contact.name}</SheetTitle>
          <SheetDescription>Ficha completa do paciente</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="resumo" className="flex-1 overflow-y-auto p-4 gap-4">
          <TabsList className="w-full">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="historico">Histórico Clínico</TabsTrigger>
            <TabsTrigger value="tags">Tags e Observações</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="space-y-3">
            <div className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <IdCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-medium">CPF:</span>
                <span>{contact.cpf || "Não informado"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-medium">WhatsApp:</span>
                <span>{contact.phone || "Não informado"}</span>
              </div>

              <div className="space-y-1 pt-1">
                <Label className="text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> Convênio
                </Label>
                <Input
                  value={convenio}
                  onChange={(e) => setConvenio(e.target.value)}
                  placeholder="Ex: Unimed, Particular..."
                  className="h-9"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-slate-400" /> Médico de preferência
                </Label>
                <Input
                  value={preferredDoctor}
                  onChange={(e) => setPreferredDoctor(e.target.value)}
                  placeholder="Ex: Dr. Fulano"
                  className="h-9"
                />
              </div>

              <Button type="button" size="sm" onClick={handleSaveResumo} disabled={isSavingResumo}>
                {isSavingResumo ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="historico" className="space-y-3">
            {contact.consultationHistory.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Nenhum agendamento encontrado pra esse paciente.</p>
            ) : (
              <div className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 shadow-sm space-y-3">
                {upcoming.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Próximos Agendamentos
                    </Label>
                    <div className="space-y-1.5">{upcoming.map(renderConsultationRow)}</div>
                  </div>
                )}
                {past.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" /> Histórico
                    </Label>
                    <div className="space-y-1.5">{past.map(renderConsultationRow)}</div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tags" className="space-y-3">
            <div className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Tags do Paciente
                </Label>
                {!isAddingTag && (
                  <button
                    type="button"
                    onClick={() => setIsAddingTag(true)}
                    className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 text-[11px] font-semibold flex items-center gap-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {contact.tags.length === 0 && !isAddingTag && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Nenhuma tag ainda.</span>
                )}
                {contact.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${tagClasses(tag)}`}
                  >
                    {tag}
                    <button type="button" onClick={() => onRemoveTag(tag)} aria-label={`Remover tag ${tag}`} className="p-1 -m-1 hover:text-slate-900 dark:hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              {isAddingTag && (
                <div className="flex items-center gap-1.5 pt-1">
                  <Input
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    placeholder="Nova tag..."
                    className="h-9 flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                  />
                  <Button type="button" size="sm" onClick={handleAddTag}>
                    Adicionar
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
