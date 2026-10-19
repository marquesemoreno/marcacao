"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CalendarCheck, Clock, Loader2, Megaphone, MessageCircle, RefreshCw, UserCheck, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AvatarBadge } from "@/components/chat/avatar-badge";
import { displayName, isUsableContactName } from "@/lib/contact-display";
import { formatPhone } from "@/lib/format";
import { PROCEDURE_INTEREST_TAG_PREFIX } from "@/lib/conversation-tags";
import { formatDurationHuman } from "@/lib/sla-calculator";
import {
  getConversationOwners,
  listChatAgents,
  listContactsSelection,
  restoreConversationOwners,
  transferConversation,
  type ContactsListParams,
} from "@/actions/inbox";

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
  /** Paciente falou por último e ninguém respondeu ainda (conversa aberta). */
  waitingSince?: string | null;
  attendant?: string | null;
  /** Já recebeu lembrete da agenda do sistema da clínica (ponte). */
  inClinicSystem?: boolean;
};

/** O mínimo pra disparo/atribuição — vale pra linha da página e pro "selecionar todos". */
type Selected = { conversationId: string; name: string; phone: string; instagramUsername?: string | null };

/** Chave do sessionStorage que leva a seleção pra tela de Disparos (N4). */
export const SELECTION_BROADCAST_KEY = "disparo-selecao";

const STAGE_LABEL: Record<string, string> = { NOVOS: "Novo", TRIAGEM: "Em atendimento", ORCAMENTO: "Orçamento", AGENDADO: "Agendado" };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function relative(iso?: string | null) {
  if (!iso) return "—";
  const minutes = (Date.now() - new Date(iso).getTime()) / 60000;
  return minutes < 1 ? "agora" : `há ${formatDurationHuman(minutes)}`;
}

/** Lista de pacientes da clínica — lista de trabalho da recepção: quem espera resposta
 * aparece com o tempo de espera (e primeiro, na ordem padrão). Seleção vale entre
 * páginas e pode pegar todos os resultados do filtro; "Enviar disparo" leva a seleção
 * pra Disparos; "Atribuir" pede confirmação e tem Desfazer (crítica 15/10/2026). */
export function PatientListTable({
  rows,
  isLoading,
  loadError,
  onRetry,
  total,
  listParams,
  emptyMessage,
  onChanged,
}: {
  rows: PatientListRow[];
  isLoading: boolean;
  loadError: boolean;
  onRetry: () => void;
  total: number;
  listParams: ContactsListParams;
  emptyMessage: string;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Map<string, Selected>>(new Map());
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [assignTo, setAssignTo] = useState("");
  const [confirmAssign, setConfirmAssign] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);

  useEffect(() => {
    listChatAgents().then((a) => setAgents(a.map((x) => ({ id: x.id, name: x.name })))).catch(() => {});
  }, []);

  // Seleção sobrevive à troca de página; troca de filtro/busca/ordem limpa (outro recorte).
  const filterKey = JSON.stringify({ ...listParams, page: undefined });
  useEffect(() => setSelected(new Map()), [filterKey]);

  const pageAllSelected = rows.length > 0 && rows.every((r) => selected.has(r.conversationId));
  const selectedList = useMemo(() => [...selected.values()], [selected]);
  const withoutPhone = selectedList.filter((r) => !r.phone).length;

  function toggle(r: PatientListRow) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(r.conversationId)) next.delete(r.conversationId);
      else next.set(r.conversationId, { conversationId: r.conversationId, name: r.name, phone: r.phone, instagramUsername: r.instagramUsername });
      return next;
    });
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Map(prev);
      if (pageAllSelected) rows.forEach((r) => next.delete(r.conversationId));
      else rows.forEach((r) => next.set(r.conversationId, { conversationId: r.conversationId, name: r.name, phone: r.phone, instagramUsername: r.instagramUsername }));
      return next;
    });
  }

  async function selectAllResults() {
    setSelectingAll(true);
    try {
      const all = await listContactsSelection(listParams);
      setSelected(new Map(all.map((r) => [r.conversationId, r])));
    } catch {
      toast.error("Não foi possível selecionar todos. Tente de novo.");
    } finally {
      setSelectingAll(false);
    }
  }

  function handleBroadcast() {
    const withPhone = selectedList.filter((r) => r.phone);
    if (withPhone.length === 0) {
      toast.error("Nenhum paciente selecionado tem telefone.");
      return;
    }
    const recipients = withPhone.map((r) => {
      const first = displayName(r).split(/\s+/)[0];
      const usable = isUsableContactName(r.name);
      return { phone: r.phone, variables: { nome: usable ? first : "", saudacao: usable ? `Oi, ${first}` : "Oi" } };
    });
    sessionStorage.setItem(SELECTION_BROADCAST_KEY, JSON.stringify(recipients));
    router.push("/clinic/disparos?selecao=1");
  }

  async function runAssign() {
    if (!assignTo) return;
    setAssigning(true);
    const ids = selectedList.map((r) => r.conversationId);
    const before = await getConversationOwners(ids).catch(() => []);
    const failed: string[] = [];
    const failedIds = new Set<string>();
    // Em lotes de 5 (antes era um por vez).
    for (let i = 0; i < selectedList.length; i += 5) {
      const chunk = selectedList.slice(i, i + 5);
      const results = await Promise.all(chunk.map((r) => transferConversation(r.conversationId, assignTo).catch(() => ({ success: false }))));
      results.forEach((res, j) => {
        if (!res.success) {
          failed.push(displayName(chunk[j]));
          failedIds.add(chunk[j].conversationId);
        }
      });
    }
    setAssigning(false);
    setConfirmAssign(false);
    const agentName = agents.find((a) => a.id === assignTo)?.name ?? "atendente";
    const ok = selectedList.length - failed.length;
    const moved = before.filter((b) => !failedIds.has(b.id));
    const undo = {
      label: "Desfazer",
      onClick: async () => {
        const r = await restoreConversationOwners(moved).catch(() => ({ success: false }));
        if (r.success) toast.success("Atribuição desfeita.");
        else toast.error("Não foi possível desfazer.");
        onChanged();
      },
    };
    if (failed.length === 0) {
      toast.success(`${plural(ok, "conversa atribuída", "conversas atribuídas")} a ${agentName}.`, { action: undo });
    } else {
      toast.error(`${ok} de ${selectedList.length} atribuídas a ${agentName}. Não deu certo: ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? ` e mais ${failed.length - 5}` : ""}.`, {
        action: ok > 0 ? undo : undefined,
        duration: 10000,
      });
    }
    setSelected(new Map());
    setAssignTo("");
    onChanged();
  }

  const colSpan = 7;
  const agentName = agents.find((a) => a.id === assignTo)?.name;

  return (
    <div className="space-y-2">
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-2 text-sm">
          <span className="font-semibold text-emerald-900 dark:text-emerald-200">
            {plural(selected.size, "selecionado", "selecionados")}
            {withoutPhone > 0 && <span className="font-normal"> · {plural(withoutPhone, "sem telefone (fica fora do disparo)", "sem telefone (ficam fora do disparo)")}</span>}
          </span>
          {selected.size < total && (
            <button
              type="button"
              disabled={selectingAll}
              onClick={selectAllResults}
              className="font-medium text-emerald-800 dark:text-emerald-300 underline underline-offset-2 disabled:opacity-50"
            >
              {selectingAll ? "Selecionando…" : `Selecionar todos os ${total} do filtro`}
            </button>
          )}
          <button
            type="button"
            onClick={handleBroadcast}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 px-3 font-medium text-white"
          >
            <Megaphone className="w-4 h-4" aria-hidden /> Enviar disparo
          </button>
          <span className="inline-flex items-center gap-1.5 text-emerald-900 dark:text-emerald-200">
            <UserCheck className="w-4 h-4" aria-hidden />
            <label htmlFor="bulk-assign" className="sr-only">
              Atribuir a
            </label>
            <select
              id="bulk-assign"
              disabled={assigning}
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
              className="h-8 rounded-md border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 px-2 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="">Atribuir a…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {assignTo && (
              <button
                type="button"
                onClick={() => setConfirmAssign(true)}
                className="inline-flex h-8 items-center rounded-md border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 px-3 font-medium text-emerald-800 dark:text-emerald-300"
              >
                Atribuir
              </button>
            )}
          </span>
          <button
            type="button"
            onClick={() => setSelected(new Map())}
            aria-label="Limpar seleção"
            className="ml-auto inline-flex items-center gap-1 text-emerald-900 dark:text-emerald-200"
          >
            <X className="w-4 h-4" aria-hidden /> Limpar
          </button>
        </div>
      )}

      {/* Celular/tablet estreito: um card por paciente (a tabela de 7 colunas exigia rolar na horizontal). */}
      {!loadError && !isLoading && rows.length > 0 && (
        <ul className="lg:hidden space-y-2" aria-label="Pacientes">
          {rows.map((r) => {
            const hasName = isUsableContactName(r.name);
            const name = displayName(r);
            const waitingMin = r.waitingSince ? (Date.now() - new Date(r.waitingSince).getTime()) / 60000 : null;
            const stage = r.status === "RESOLVED" ? "Finalizado" : STAGE_LABEL[r.funnelStage ?? ""] ?? null;
            return (
              <li key={r.conversationId} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3" data-state={selected.has(r.conversationId) ? "selected" : undefined}>
                <div className="flex items-start gap-2.5">
                  <input type="checkbox" aria-label={`Selecionar ${name}`} checked={selected.has(r.conversationId)} onChange={() => toggle(r)} className="mt-2.5 size-4 shrink-0 accent-emerald-600" />
                  <Link href={`/clinic/pacientes/${r.conversationId}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
                    <AvatarBadge name={name} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {hasName ? (r.phone ? formatPhone(r.phone) : r.instagramUsername ? `@${r.instagramUsername}` : "Sem telefone") : <span className="italic">Sem nome salvo</span>}
                      </span>
                    </span>
                  </Link>
                  <Link
                    href={`/clinic/inbox?c=${r.conversationId}`}
                    aria-label={`Abrir conversa com ${name}`}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  >
                    <MessageCircle className="w-4 h-4" aria-hidden />
                  </Link>
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-[26px] text-xs text-slate-600 dark:text-slate-300">
                  {waitingMin !== null ? (
                    <span className={`inline-flex items-center gap-1 font-semibold ${waitingMin >= 60 ? "text-amber-800 dark:text-amber-300" : ""}`}>
                      <Clock className="w-3 h-3" aria-hidden /> esperando há {formatDurationHuman(Math.max(1, waitingMin))}
                    </span>
                  ) : (
                    <span>última conversa {relative(r.lastInteractionAt)}</span>
                  )}
                  {stage && <span>{stage}</span>}
                  <span>{r.attendant ?? "Sem dono"}</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <div className={`${!loadError && !isLoading && rows.length > 0 ? "hidden lg:block " : ""}overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs`}>
        <Table aria-busy={isLoading}>
          <TableHeader>
            <TableRow className="bg-slate-50/70 dark:bg-slate-800/40">
              <TableHead className="w-10">
                <input type="checkbox" aria-label="Selecionar todos desta página" checked={pageAllSelected} onChange={togglePage} className="size-4 accent-emerald-600" />
              </TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Interesse · origem</TableHead>
              <TableHead>Atendente</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Chat</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadError ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-10 text-center whitespace-normal" role="alert">
                  <p className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <AlertTriangle className="w-4 h-4 text-amber-600" aria-hidden /> Não foi possível carregar os pacientes.
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Pode ser a internet ou uma instabilidade no Conecta. Seus pacientes continuam salvos.</p>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <RefreshCw className="w-4 h-4" aria-hidden /> Tentar de novo
                  </button>
                </TableCell>
              </TableRow>
            ) : isLoading ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-slate-500" role="status">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando pacientes…
                  </span>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-slate-500 whitespace-normal">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                // Mesmo tratamento do nome na Agenda: "MARIA DA SILVA" → "Maria da Silva".
                const hasName = isUsableContactName(r.name);
                const name = displayName(r);
                const interest = r.tags?.find((t) => t.startsWith(PROCEDURE_INTEREST_TAG_PREFIX))?.slice(PROCEDURE_INTEREST_TAG_PREFIX.length);
                const waitingMin = r.waitingSince ? (Date.now() - new Date(r.waitingSince).getTime()) / 60000 : null;
                return (
                  <TableRow key={r.conversationId} data-state={selected.has(r.conversationId) ? "selected" : undefined}>
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${name}`}
                        checked={selected.has(r.conversationId)}
                        onChange={() => toggle(r)}
                        className="size-4 accent-emerald-600"
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/clinic/pacientes/${r.conversationId}`}
                        className="flex items-center gap-2.5 rounded-md hover:underline decoration-slate-400 underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                      >
                        <AvatarBadge name={name} size={32} />
                        <span className="min-w-0">
                          <span className="block font-semibold text-sm text-slate-900 dark:text-slate-100 truncate max-w-[220px]" title={name}>
                            {name}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            {/* Sem nome salvo o título já é o telefone: não repete aqui. */}
                            {hasName ? (r.phone ? formatPhone(r.phone) : r.instagramUsername ? `@${r.instagramUsername}` : "Sem telefone") : <span className="italic">Sem nome salvo</span>}
                            {r.inClinicSystem && (
                              <span className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 dark:border-slate-700 px-1 text-[11px] text-slate-600 dark:text-slate-300" title="Está na agenda do sistema da clínica (já recebeu lembrete de consulta)">
                                <CalendarCheck className="w-3 h-3" aria-hidden /> agenda da clínica
                              </span>
                            )}
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {waitingMin !== null ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-semibold ${
                            waitingMin >= 60
                              ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300"
                              : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                          }`}
                          title={`Mensagem do paciente sem resposta desde ${new Date(r.waitingSince!).toLocaleString("pt-BR")}`}
                        >
                          <Clock className="w-3 h-3" aria-hidden /> esperando há {formatDurationHuman(Math.max(1, waitingMin))}
                        </span>
                      ) : (
                        <span className="text-slate-600 dark:text-slate-300" title={r.lastInteractionAt ? new Date(r.lastInteractionAt).toLocaleString("pt-BR") : undefined}>
                          última conversa {relative(r.lastInteractionAt)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-700 dark:text-slate-200">
                      {r.status === "RESOLVED" ? "Finalizado" : STAGE_LABEL[r.funnelStage ?? ""] ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="block text-slate-700 dark:text-slate-200">{interest ?? "—"}</span>
                      {r.acquisitionChannel && <span className="block text-xs text-slate-500 dark:text-slate-400">{r.acquisitionChannel}</span>}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-300">{r.attendant ?? "Sem dono"}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/clinic/inbox?c=${r.conversationId}`}
                        aria-label={`Abrir conversa com ${name}`}
                        title="Abrir conversa"
                        className="inline-flex size-9 items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                      >
                        <MessageCircle className="w-4 h-4" aria-hidden />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={confirmAssign} onOpenChange={(o) => !assigning && setConfirmAssign(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Atribuir {plural(selected.size, "conversa", "conversas")} a {agentName}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {agentName} passa a ser a responsável{selected.size > 1 ? " por todas elas" : ""}. Dá para desfazer logo depois, no aviso que aparece.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={assigning}
              onClick={() => setConfirmAssign(false)}
              className="h-9 px-4 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={assigning}
              onClick={runAssign}
              className="inline-flex h-9 items-center gap-1.5 px-4 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg"
            >
              {assigning && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Atribuir
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
