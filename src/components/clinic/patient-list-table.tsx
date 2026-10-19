"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CalendarCheck, Clock, Loader2, Megaphone, MessageCircle, RefreshCw, User, UserCheck, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { displayName, isUsableContactName } from "@/lib/contact-display";
import { formatPhone } from "@/lib/format";
import { initialsOf } from "@/lib/agenda-ui";
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

      {/* Mesmo layout das marcações da Agenda: cartão com iniciais, nome em Nome Próprio, subtítulo,
          selos de situação/etapa e um botão de ação. */}
      {loadError ? (
        <div role="alert" className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-10 px-4 text-center">
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
        </div>
      ) : isLoading ? (
        <div role="status" className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-10 text-center text-sm text-slate-500">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando pacientes…
          </span>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-10 px-4 text-center text-sm text-slate-500">{emptyMessage}</div>
      ) : (
        <>
          <label className="flex w-fit items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" aria-label="Selecionar todos desta página" checked={pageAllSelected} onChange={togglePage} className="size-4 accent-emerald-600" />
            Selecionar todos desta página
          </label>
          <ul className="grid gap-2 xl:grid-cols-2" aria-label="Pacientes">
            {rows.map((r) => {
              const hasName = isUsableContactName(r.name);
              const name = displayName(r);
              const interest = r.tags?.find((t) => t.startsWith(PROCEDURE_INTEREST_TAG_PREFIX))?.slice(PROCEDURE_INTEREST_TAG_PREFIX.length);
              const waitingMin = r.waitingSince ? (Date.now() - new Date(r.waitingSince).getTime()) / 60000 : null;
              const stage = r.status === "RESOLVED" ? "Finalizado" : STAGE_LABEL[r.funnelStage ?? ""] ?? null;
              const contact = r.phone ? formatPhone(r.phone) : r.instagramUsername ? `@${r.instagramUsername}` : "Sem telefone";
              // Subtítulo como o "procedimento · médico" da Agenda: telefone · atendente · origem.
              const subtitle = [hasName ? contact : "Sem nome salvo", r.attendant ?? "Sem dono", r.acquisitionChannel].filter(Boolean).join(" · ");
              const isSelected = selected.has(r.conversationId);
              const tone =
                r.status === "RESOLVED"
                  ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60"
                  : waitingMin !== null
                    ? "border-dashed border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900"
                    : "border-slate-200 dark:border-slate-700 bg-emerald-50/70 dark:bg-emerald-950/25";
              const badge = "inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-xs font-semibold";
              return (
                <li
                  key={r.conversationId}
                  data-state={isSelected ? "selected" : undefined}
                  className={`relative rounded-lg border ${tone} shadow-xs transition-colors hover:border-slate-300 dark:hover:border-slate-600 ${isSelected ? "ring-2 ring-emerald-500/40" : ""}`}
                >
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${name}`}
                      checked={isSelected}
                      onChange={() => toggle(r)}
                      className="ml-2 mt-3 size-4 shrink-0 accent-emerald-600"
                    />
                    <Link
                      href={`/clinic/pacientes/${r.conversationId}`}
                      aria-label={`Abrir ficha de ${name}`}
                      className="min-w-0 flex-1 rounded-lg px-2 pt-1.5 pb-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          {hasName ? initialsOf(name) : <User className="w-3.5 h-3.5" aria-hidden />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            <span className="truncate" title={name}>
                              {name}
                            </span>
                            {r.phone && <MessageCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
                        </div>
                      </div>
                    </Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 px-2 pb-1.5 pl-9">
                    {waitingMin !== null ? (
                      <span
                        className={`${badge} bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800`}
                        title={`Mensagem do paciente sem resposta desde ${new Date(r.waitingSince!).toLocaleString("pt-BR")}`}
                      >
                        <Clock className="w-3 h-3" aria-hidden /> esperando há {formatDurationHuman(Math.max(1, waitingMin))}
                      </span>
                    ) : (
                      <span
                        className={`${badge} bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700`}
                        title={r.lastInteractionAt ? new Date(r.lastInteractionAt).toLocaleString("pt-BR") : undefined}
                      >
                        última conversa {relative(r.lastInteractionAt)}
                      </span>
                    )}
                    {stage && (
                      <span className={`${badge} bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700`}>{stage}</span>
                    )}
                    {interest && (
                      <span className={`${badge} bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700`}>{interest}</span>
                    )}
                    {r.inClinicSystem && (
                      <span
                        className={`${badge} bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700`}
                        title="Está na agenda do sistema da clínica (já recebeu lembrete de consulta)"
                      >
                        <CalendarCheck className="w-3 h-3" aria-hidden /> agenda da clínica
                      </span>
                    )}
                    <Link
                      href={`/clinic/inbox?c=${r.conversationId}`}
                      aria-label={`Abrir conversa com ${name}`}
                      className="inline-flex h-6 items-center gap-1 rounded-md border border-sky-300 dark:border-sky-800 bg-white dark:bg-slate-900 px-1.5 text-xs font-semibold text-sky-800 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                    >
                      <MessageCircle className="w-3 h-3" aria-hidden /> Abrir conversa
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

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
