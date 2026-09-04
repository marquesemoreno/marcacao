"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, MessageCircle, UserPlus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { listAllContacts, createContact } from "@/actions/inbox";
import {
  listAllContactsAdmin,
  createContactAdmin,
  listClinicsForReassignment,
  importContactsAdmin,
  type ImportContactsResult,
} from "@/actions/admin-inbox";
import { parseContactsCsv, type ParsedContactRow } from "@/lib/contacts-csv";
import { formatPhone } from "@/lib/format";

type Scope = "clinic" | "admin";

type ContactRow = {
  conversationId: string;
  name: string;
  phone: string;
  cpf: string | null;
  status: "OPEN" | "PENDING" | "RESOLVED";
  clinicName?: string;
};

const statusLabels: Record<ContactRow["status"], string> = {
  OPEN: "Em atendimento",
  PENDING: "Pendente",
  RESOLVED: "Finalizado",
};

const statusClasses: Record<ContactRow["status"], string> = {
  OPEN: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  PENDING: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  RESOLVED: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700",
};

/** Remove o DDI 55 (armazenado junto no telefone do Contact) antes de formatar
 * como (DD) 9XXXX-XXXX — sem isso o formatPhone padrão desalinha os dígitos. */
function formatContactPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const local = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  return formatPhone(local);
}

export function ContactsApp({ scope, basePath }: { scope: Scope; basePath: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newClinicId, setNewClinicId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [availableClinics, setAvailableClinics] = useState<{ id: string; tradeName: string }[]>([]);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importClinicId, setImportClinicId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [csvRows, setCsvRows] = useState<ParsedContactRow[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportContactsResult | null>(null);

  const fetchContacts = useCallback(async () => {
    const result =
      scope === "admin" ? await listAllContactsAdmin(search || undefined) : await listAllContacts(search || undefined);
    setContacts(result);
  }, [scope, search]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const timeout = setTimeout(async () => {
      await fetchContacts();
      if (!cancelled) setIsLoading(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [fetchContacts]);

  useEffect(() => {
    if (scope === "admin") {
      listClinicsForReassignment().then(setAvailableClinics).catch(() => {});
    }
  }, [scope]);

  async function handleSaveNewContact(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;
    if (scope === "admin" && availableClinics.length > 0 && !newClinicId) return;

    setIsSaving(true);
    try {
      const conversationId =
        scope === "admin" ? await createContactAdmin(newName, newPhone, newClinicId) : await createContact(newName, newPhone);
      toast.success("Contato cadastrado com sucesso!");
      setNewName("");
      setNewPhone("");
      setNewClinicId("");
      setIsModalOpen(false);
      router.push(`${basePath}/inbox?c=${conversationId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível cadastrar o contato.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCsvChange(value: string) {
    setCsvText(value);
    setCsvError(null);
    setImportResult(null);
    if (!value.trim()) {
      setCsvRows([]);
      return;
    }
    try {
      setCsvRows(parseContactsCsv(value));
    } catch (error) {
      setCsvRows([]);
      setCsvError(error instanceof Error ? error.message : "CSV inválido.");
    }
  }

  function handleCsvFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => handleCsvChange(String(reader.result ?? ""));
    reader.readAsText(file, "utf-8");
  }

  function closeImportModal() {
    setIsImportModalOpen(false);
    setImportClinicId("");
    setCsvText("");
    setCsvRows([]);
    setCsvError(null);
    setImportResult(null);
  }

  async function handleImportContacts() {
    if (!importClinicId || csvRows.length === 0) return;
    setIsImporting(true);
    try {
      const result = await importContactsAdmin(importClinicId, csvRows);
      setImportResult(result);
      if (result.imported > 0) {
        toast.success(`${result.imported} contato(s) importado(s) com sucesso!`);
        await fetchContacts();
      }
      if (result.skipped.length > 0) {
        toast.error(`${result.skipped.length} linha(s) pulada(s) — confira o resumo.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível importar os contatos.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6 font-sans text-slate-900 dark:text-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Users className="size-6 text-slate-500" /> Contatos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Busque por nome, telefone ou CPF para encontrar um contato já cadastrado e abrir a conversa dele.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {scope === "admin" && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all shadow-2xs"
            >
              <Upload className="size-4" /> Importar Contatos
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white transition-all shadow-2xs"
          >
            <UserPlus className="size-4" /> Novo Contato
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome, telefone ou CPF..."
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 pl-9 pr-3 text-sm outline-none transition-all focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <th className="px-4 py-2.5 text-left font-bold text-slate-700 dark:text-slate-300">Nome</th>
              <th className="px-4 py-2.5 text-left font-bold text-slate-700 dark:text-slate-300">Telefone</th>
              <th className="px-4 py-2.5 text-left font-bold text-slate-700 dark:text-slate-300">CPF</th>
              {scope === "admin" && (
                <th className="px-4 py-2.5 text-left font-bold text-slate-700 dark:text-slate-300">Clínica</th>
              )}
              <th className="px-4 py-2.5 text-left font-bold text-slate-700 dark:text-slate-300">Status</th>
              <th className="px-4 py-2.5 text-right font-bold text-slate-700 dark:text-slate-300">Ação</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={scope === "admin" ? 6 : 5} className="px-4 py-8 text-center text-sm text-slate-400">
                  Carregando contatos...
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={scope === "admin" ? 6 : 5} className="px-4 py-8 text-center text-sm text-slate-400 italic">
                  {search ? "Nenhum contato encontrado para essa busca." : "Nenhum contato cadastrado ainda."}
                </td>
              </tr>
            ) : (
              contacts.map((contact) => (
                <tr
                  key={contact.conversationId}
                  className="border-b border-slate-100 dark:border-slate-800/60 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                >
                  <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100">{contact.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {formatContactPhone(contact.phone)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {contact.cpf || "—"}
                  </td>
                  {scope === "admin" && (
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{contact.clinicName}</td>
                  )}
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClasses[contact.status]}`}
                    >
                      {statusLabels[contact.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => router.push(`${basePath}/inbox?c=${contact.conversationId}`)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white transition-all hover:bg-slate-800 dark:hover:bg-emerald-500"
                    >
                      <MessageCircle className="size-3.5" /> Abrir Conversa
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveNewContact}
            className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl space-y-4 border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                Novo Contato
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome:</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do paciente"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">WhatsApp (com DDD):</label>
                <input
                  type="tel"
                  required
                  placeholder="77999998888"
                  value={newPhone}
                  onChange={(event) => setNewPhone(event.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 mt-1 font-mono"
                />
              </div>

              {scope === "admin" && availableClinics.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Clínica:</label>
                  <select
                    required
                    value={newClinicId}
                    onChange={(event) => setNewClinicId(event.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 mt-1"
                  >
                    <option value="" disabled>Escolha a clínica...</option>
                    {availableClinics.map((clinic) => (
                      <option key={clinic.id} value={clinic.id}>{clinic.tradeName}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-xs rounded-lg shadow-sm"
              >
                {isSaving ? "Salvando..." : "Cadastrar Contato"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl space-y-4 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-600" />
                Importar Contatos
              </h3>
              <button type="button" onClick={closeImportModal}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Clínica:</label>
                <select
                  required
                  value={importClinicId}
                  onChange={(event) => setImportClinicId(event.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 mt-1"
                >
                  <option value="" disabled>Escolha a clínica...</option>
                  {availableClinics.map((clinic) => (
                    <option key={clinic.id} value={clinic.id}>{clinic.tradeName}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="contacts-csv" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Lista de contatos (CSV — vírgula ou ponto-e-vírgula, cabeçalho opcional)
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" /> Enviar arquivo
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(event) => event.target.files?.[0] && handleCsvFileUpload(event.target.files[0])}
                    />
                  </label>
                </div>
                <textarea
                  id="contacts-csv"
                  rows={6}
                  value={csvText}
                  onChange={(event) => handleCsvChange(event.target.value)}
                  placeholder={"nome,telefone\nMaria Silva,77999998888"}
                  className="w-full mt-1 px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Sem cabeçalho, assume a ordem nome, telefone, cpf. Com cabeçalho, as colunas podem vir em
                  qualquer ordem — precisa ter uma coluna de nome e uma de telefone (CPF é opcional).
                </p>
                {csvError && <p className="mt-1 text-[11px] font-semibold text-red-600 dark:text-red-400">{csvError}</p>}
                {csvRows.length > 0 && (
                  <p className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {csvRows.length} contato(s) reconhecido(s).
                  </p>
                )}
              </div>

              {csvRows.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {csvRows.map((row, index) => (
                    <div key={index} className="px-3 py-1.5 text-xs flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{row.name}</span>
                      <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0">{row.phone}</span>
                    </div>
                  ))}
                </div>
              )}

              {importResult && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-1.5">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {importResult.imported} contato(s) importado(s).
                  </p>
                  {importResult.skipped.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-red-600 dark:text-red-400">
                        {importResult.skipped.length} pulado(s):
                      </p>
                      {importResult.skipped.map((item, index) => (
                        <p key={index} className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.name || "(sem nome)"} — {item.phone || "(sem telefone)"}: {item.reason}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isImporting || !importClinicId || csvRows.length === 0}
                onClick={handleImportContacts}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-xs rounded-lg shadow-sm"
              >
                {isImporting ? "Importando..." : "Importar Contatos"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
