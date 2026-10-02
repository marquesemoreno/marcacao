"use client";

import { useState } from "react";
import { Plus, X, Phone, IdCard, Stethoscope, ShieldCheck, Calendar, MapPin, CreditCard, FileText, Download, File as FileIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { PatientRecordData, UpdatePatientData } from "@/types/chat-crm";
import { tagClasses, renderConsultationRow } from "./patient-record-shared";
import { displayName } from "@/lib/contact-display";

export interface MediaItem {
  id: string;
  mimeType: string | null;
  url: string | null;
  attachmentName: string | null;
  attachmentSize: string | null;
  createdAt: string;
}

interface PatientRecordSheetProps {
  contact: PatientRecordData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdatePatient: (
    data: UpdatePatientData
  ) => Promise<{ success: boolean; error?: string } | void> | { success: boolean; error?: string } | void;
  onAddTag: (tag: string) => Promise<void> | void;
  onRemoveTag: (tag: string) => Promise<void> | void;
  /** Busca sob demanda (só quando a aba "Documentos & Exames" é aberta pela 1ª vez) —
   * ver listContactMedia em actions/inbox.ts. Opcional: sem essa prop, a aba mostra
   * "indisponível" em vez de quebrar (ex: se algum consumidor futuro não quiser essa
   * aba). `contact.id` já É o conversationId (ver chat-crm-adapters.ts). */
  onLoadMedia?: (conversationId: string) => Promise<MediaItem[]>;
}

function calculateAge(birthDateIso: string): number | null {
  const birth = new Date(`${birthDateIso}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthdayThisYear =
    today.getUTCMonth() > birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

function formatFileSize(bytes: string | null): string {
  const n = bytes ? Number(bytes) : NaN;
  if (!n || Number.isNaN(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Ficha completa do paciente — aditiva ao painel "Perfil & CRM" fixo do Inbox (que
 * continua servindo de contexto rápido enquanto atende); este Sheet é a visão ampla,
 * reusado também em /clinic/contatos ("Ver Ficha"). Reaproveita tagClasses/
 * renderConsultationRow (patient-record-shared.tsx) pra não duplicar JSX entre os
 * lugares que mostram tag/histórico. */
export function PatientRecordSheet({ contact, open, onOpenChange, onUpdatePatient, onAddTag, onRemoveTag, onLoadMedia }: PatientRecordSheetProps) {
  const [convenio, setConvenio] = useState(contact.convenio ?? "");
  const [preferredDoctor, setPreferredDoctor] = useState(contact.preferredDoctor ?? "");
  const [rg, setRg] = useState(contact.rg ?? "");
  const [birthDate, setBirthDate] = useState(contact.birthDate ?? "");
  const [address, setAddress] = useState(contact.address ?? "");
  const [insuranceCardNumber, setInsuranceCardNumber] = useState(contact.insuranceCardNumber ?? "");
  const [isSavingResumo, setIsSavingResumo] = useState(false);

  const [notes, setNotes] = useState(contact.notes ?? "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");

  const [media, setMedia] = useState<MediaItem[] | null>(null);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);

  async function handleSaveResumo() {
    setIsSavingResumo(true);
    try {
      const result = await onUpdatePatient({
        name: contact.name,
        cpf: contact.cpf,
        convenio,
        preferredDoctor,
        rg,
        birthDate,
        address,
        insuranceCardNumber,
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

  async function handleSaveNotes() {
    setIsSavingNotes(true);
    try {
      const result = await onUpdatePatient({ name: contact.name, cpf: contact.cpf, notes });
      if (result && "success" in result && !result.success) {
        toast.error(result.error || "Não foi possível salvar a observação.");
      } else {
        toast.success("Observação salva.");
      }
    } finally {
      setIsSavingNotes(false);
    }
  }

  async function handleAddTag() {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;
    await onAddTag(trimmed);
    setNewTagInput("");
    setIsAddingTag(false);
  }

  async function handleOpenDocumentosTab() {
    if (media !== null || !onLoadMedia || isLoadingMedia) return;
    setIsLoadingMedia(true);
    try {
      setMedia(await onLoadMedia(contact.id));
    } finally {
      setIsLoadingMedia(false);
    }
  }

  const age = birthDate ? calculateAge(birthDate) : null;
  const upcoming = contact.consultationHistory.filter((c) => c.isUpcoming);
  const past = contact.consultationHistory.filter((c) => !c.isUpcoming);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* data-[side=right]: precisa do mesmo prefixo do SheetContent base, senão o
          sm:max-w-sm dele vence e a ficha abre com ~384px (F1). */}
      <SheetContent side="right" className="w-full p-0 gap-0 data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b border-slate-200 dark:border-slate-800 p-4">
          <SheetTitle className="text-base">{displayName(contact)}</SheetTitle>
          <SheetDescription>Ficha completa do paciente</SheetDescription>
        </SheetHeader>

        {/* Abas: barra com rolagem horizontal própria e altura automática; só o conteúdo
            rola na vertical (antes o TabsList esticava e cobria os campos). */}
        <Tabs defaultValue="resumo" className="flex-1 min-h-0 gap-0" onValueChange={(v) => v === "documentos" && handleOpenDocumentosTab()}>
          <div className="shrink-0 overflow-x-auto border-b border-slate-200 dark:border-slate-800 px-4 py-2">
          <TabsList className="h-auto w-max flex-none [&>*]:shrink-0 [&>*]:whitespace-nowrap">
            <TabsTrigger value="resumo">Resumo Cadastral</TabsTrigger>
            <TabsTrigger value="historico">Histórico de Agendamentos</TabsTrigger>
            <TabsTrigger value="documentos">Documentos & Exames</TabsTrigger>
            <TabsTrigger value="observacoes">Observações & Timeline</TabsTrigger>
          </TabsList>
          </div>

          <TabsContent value="resumo" className="min-h-0 flex-1 overflow-y-auto space-y-3 p-4">
            <div className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-medium">WhatsApp:</span>
                <span>{contact.phone || "Não informado"}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    <IdCard className="w-3.5 h-3.5 text-slate-400" /> CPF
                  </Label>
                  <Input value={contact.cpf || ""} disabled className="h-9" placeholder="Não informado" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    <IdCard className="w-3.5 h-3.5 text-slate-400" /> RG
                  </Label>
                  <Input value={rg} onChange={(e) => setRg(e.target.value)} className="h-9" placeholder="Não informado" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> Nascimento {age !== null && `(${age} anos)`}
                </Label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> Endereço
                </Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} className="h-9" placeholder="Não informado" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> Convênio
                  </Label>
                  <Input value={convenio} onChange={(e) => setConvenio(e.target.value)} className="h-9" placeholder="Ex: Unimed, Particular..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-400" /> Nº Carteirinha
                  </Label>
                  <Input value={insuranceCardNumber} onChange={(e) => setInsuranceCardNumber(e.target.value)} className="h-9" placeholder="Não informado" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-slate-400" /> Médico de referência
                </Label>
                <Input value={preferredDoctor} onChange={(e) => setPreferredDoctor(e.target.value)} className="h-9" placeholder="Ex: Dr. Fulano" />
              </div>

              <Button type="button" size="sm" onClick={handleSaveResumo} disabled={isSavingResumo}>
                {isSavingResumo ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="historico" className="min-h-0 flex-1 overflow-y-auto space-y-3 p-4">
            {contact.consultationHistory.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Nenhum agendamento encontrado pra esse paciente.</p>
            ) : (
              <div className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 shadow-sm space-y-3">
                {upcoming.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Próximos Agendamentos
                    </Label>
                    <div className="space-y-1.5">{upcoming.map(renderConsultationRow)}</div>
                  </div>
                )}
                {past.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" /> Histórico
                    </Label>
                    <div className="space-y-1.5">{past.map(renderConsultationRow)}</div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="documentos" className="min-h-0 flex-1 overflow-y-auto space-y-3 p-4">
            {!onLoadMedia ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Indisponível aqui.</p>
            ) : isLoadingMedia ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Carregando...</p>
            ) : !media || media.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Nenhum arquivo trocado com esse paciente ainda.</p>
            ) : (
              <div className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 shadow-sm">
                {media.map((item) => (
                  <div key={item.id} className="flex items-center gap-2.5 p-3 text-xs">
                    {item.mimeType?.startsWith("image/") ? (
                      <FileIcon className="w-4 h-4 text-sky-500 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800 dark:text-slate-200">{item.attachmentName || "Arquivo"}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.createdAt} {formatFileSize(item.attachmentSize) && `· ${formatFileSize(item.attachmentSize)}`}
                      </p>
                    </div>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 p-1.5 text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400"
                        title="Baixar"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="observacoes" className="min-h-0 flex-1 overflow-y-auto space-y-3 p-4">
            <div className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 shadow-sm space-y-2">
              <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Observação Interna Permanente
              </Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder='Ex: "Paciente idoso, necessita de auxílio para locomoção."'
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 resize-none"
              />
              <Button type="button" size="sm" onClick={handleSaveNotes} disabled={isSavingNotes}>
                {isSavingNotes ? "Salvando..." : "Salvar Observação"}
              </Button>
            </div>

            <div className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Tags do Paciente
                </Label>
                {!isAddingTag && (
                  <button
                    type="button"
                    onClick={() => setIsAddingTag(true)}
                    className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 text-xs font-semibold flex items-center gap-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {contact.tags.length === 0 && !isAddingTag && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">Nenhuma tag ainda.</span>
                )}
                {contact.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border ${tagClasses(tag)}`}
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
