"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Megaphone, MessageCircle, UserCheck, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AvatarBadge } from "@/components/chat/avatar-badge";
import { displayName } from "@/lib/contact-display";
import { formatPhone } from "@/lib/format";
import { PROCEDURE_INTEREST_TAG_PREFIX } from "@/lib/conversation-tags";
import { formatDurationHuman } from "@/lib/sla-calculator";
import { listChatAgents, transferConversation } from "@/actions/inbox";

export type PatientListRow = {
  conversationId: string;
  name: string;
  phone: string;
  instagramUsername?: string | null;
  tags?: string[];
  status: "OPEN" | "PENDING" | "RESOLVED";
  funnelStage?: string;
  acquisitionChannel?: string | null;
  lastInteractionAt?: string;
  attendant?: string | null;
};

/** Chave do sessionStorage que leva a seleção pra tela de Disparos (N4). */
export const SELECTION_BROADCAST_KEY = "disparo-selecao";

const STAGE_LABEL: Record<string, string> = { NOVOS: "Novo", TRIAGEM: "Em atendimento", ORCAMENTO: "Orçamento", AGENDADO: "Agendado" };

function relative(iso?: string) {
  if (!iso) return "—";
  const minutes = (Date.now() - new Date(iso).getTime()) / 60000;
  return minutes < 1 ? "agora" : `há ${formatDurationHuman(minutes)}`;
}

/** N4 — lista de pacientes da clínica: seleção (página atual), etapa, interesse/origem,
 * última interação relativa, atendente e atalho pro chat; ações em massa "Enviar disparo"
 * (leva a seleção pra tela de Disparos) e "Atribuir". */
export function PatientListTable({
  rows,
  isLoading,
  emptyMessage,
  onChanged,
}: {
  rows: PatientListRow[];
  isLoading: boolean;
  emptyMessage: string;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    listChatAgents().then((a) => setAgents(a.map((x) => ({ id: x.id, name: x.name })))).catch(() => {});
  }, []);
  // Troca de página/filtro limpa a seleção (a seleção vale pra lista que está na tela).
  useEffect(() => setSelected(new Set()), [rows]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.conversationId));
  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.conversationId)), [rows, selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBroadcast() {
    const withPhone = selectedRows.filter((r) => r.phone);
    if (withPhone.length === 0) {
      toast.error("Nenhum paciente selecionado tem telefone.");
      return;
    }
    const recipients = withPhone.map((r) => {
      const first = displayName(r).split(/\s+/)[0];
      const usable = displayName(r) === r.name.trim();
      return { phone: r.phone, variables: { nome: usable ? first : "", saudacao: usable ? `Oi, ${first}` : "Oi" } };
    });
    sessionStorage.setItem(SELECTION_BROADCAST_KEY, JSON.stringify(recipients));
    router.push("/clinic/disparos?selecao=1");
  }

  async function handleAssign(agentId: string) {
    if (!agentId) return;
    setAssigning(true);
    let ok = 0;
    for (const r of selectedRows) {
      const result = await transferConversation(r.conversationId, agentId).catch(() => ({ success: false }));
      if (result.success) ok++;
    }
    setAssigning(false);
    const agentName = agents.find((a) => a.id === agentId)?.name ?? "atendente";
    if (ok === selectedRows.length) toast.success(`${ok} conversa(s) atribuída(s) a ${agentName}.`);
    else toast.error(`${ok} de ${selectedRows.length} atribuídas — algumas falharam (ex: limite de conversas da atendente).`);
    setSelected(new Set());
    onChanged();
  }

  return (
    <div className="space-y-2">
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-2 text-sm">
          <span className="font-semibold text-emerald-900 dark:text-emerald-200">{selected.size} selecionado(s)</span>
          <button
            type="button"
            onClick={handleBroadcast}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 font-medium text-white"
          >
            <Megaphone className="w-4 h-4" /> Enviar disparo
          </button>
          <label className="inline-flex items-center gap-1.5 text-emerald-900 dark:text-emerald-200">
            <UserCheck className="w-4 h-4" />
            <span className="sr-only">Atribuir a</span>
            <select
              disabled={assigning}
              defaultValue=""
              onChange={(e) => handleAssign(e.target.value)}
              className="h-8 rounded-md border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 px-2 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="" disabled>{assigning ? "Atribuindo…" : "Atribuir a…"}</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setSelected(new Set())} aria-label="Limpar seleção" className="ml-auto inline-flex items-center gap-1 text-emerald-900 dark:text-emerald-200">
            <X className="w-4 h-4" /> Limpar
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/70 dark:bg-slate-800/40">
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos desta página"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.conversationId)))}
                  className="size-4"
                />
              </TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Interesse · origem</TableHead>
              <TableHead>Última interação</TableHead>
              <TableHead>Atendente</TableHead>
              <TableHead className="text-right"><span className="sr-only">Chat</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">Carregando…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">{emptyMessage}</TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const name = displayName(r);
                const interest = r.tags?.find((t) => t.startsWith(PROCEDURE_INTEREST_TAG_PREFIX))?.slice(PROCEDURE_INTEREST_TAG_PREFIX.length);
                return (
                  <TableRow key={r.conversationId} data-state={selected.has(r.conversationId) ? "selected" : undefined}>
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${name}`}
                        checked={selected.has(r.conversationId)}
                        onChange={() => toggle(r.conversationId)}
                        className="size-4"
                      />
                    </TableCell>
                    <TableCell>
                      <Link href={`/clinic/pacientes/${r.conversationId}`} className="flex items-center gap-2.5 hover:underline decoration-slate-400 underline-offset-2">
                        <AvatarBadge name={name} size={32} />
                        <span className="min-w-0">
                          <span className="block font-semibold text-sm text-slate-900 dark:text-slate-100 truncate max-w-[220px]">{name}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {r.phone ? formatPhone(r.phone) : r.instagramUsername ? `@${r.instagramUsername}` : "Sem telefone"}
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-slate-700 dark:text-slate-200">
                      {r.status === "RESOLVED" ? "Finalizado" : STAGE_LABEL[r.funnelStage ?? ""] ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="block text-slate-700 dark:text-slate-200">{interest ?? "—"}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{r.acquisitionChannel ?? "Origem não identificada"}</span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-300" title={r.lastInteractionAt ? new Date(r.lastInteractionAt).toLocaleString("pt-BR") : undefined}>
                      {relative(r.lastInteractionAt)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-300">{r.attendant ?? "Não atribuída"}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/clinic/inbox?c=${r.conversationId}`}
                        aria-label={`Abrir conversa com ${name}`}
                        title="Abrir conversa"
                        className="inline-flex size-8 items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
