"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, MessageCircle } from "lucide-react";
import { listAllContacts } from "@/actions/inbox";
import { listAllContactsAdmin } from "@/actions/admin-inbox";
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

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const timeout = setTimeout(async () => {
      const result =
        scope === "admin" ? await listAllContactsAdmin(search || undefined) : await listAllContacts(search || undefined);
      if (!cancelled) {
        setContacts(result);
        setIsLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [scope, search]);

  return (
    <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6 font-sans text-slate-900 dark:text-slate-100">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Users className="size-6 text-slate-500" /> Contatos
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Busque por nome, telefone ou CPF para encontrar um contato já cadastrado e abrir a conversa dele.
        </p>
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
    </div>
  );
}
