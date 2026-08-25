"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, MessageCircle, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { listAllContacts, createContact } from "@/actions/inbox";
import { listAllContactsAdmin, createContactAdmin, listClinicsForReassignment } from "@/actions/admin-inbox";
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
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white transition-all shadow-2xs"
        >
          <UserPlus className="size-4" /> Novo Contato
        </button>
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
    </div>
  );
}
