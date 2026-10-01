/** Tags de Conversation com significado especial na UI (badge visual na fila) —
 * ficam num arquivo sem "server-only" de propósito, porque tanto o webhook
 * (servidor, quem adiciona a tag) quanto o InboxLayout (cliente, quem decide o
 * destaque visual) precisam do mesmo valor exato. */
export const URGENCY_TAG = "🚨 Urgência Clínica";

/** Marca a conversa aberta por um lead de prospecção MSP (ver msp-lead-outreach.ts)
 * respondendo pelo mesmo número da TIVDC usado no suporte técnico — ajuda o atendente
 * a distinguir na fila que é uma conversa comercial, não um chamado de suporte. */
export const MSP_LEAD_TAG = "🎯 Lead MSP";

/** Marca a conversa aberta por um lead de parceria do marketplace (ver
 * ai-lead-outreach.ts) respondendo pelo mesmo número da TIVDC usado no suporte
 * técnico — mesmo motivo de MSP_LEAD_TAG acima. */
export const PARTNER_LEAD_TAG = "🤝 Lead Parceria";

/** Paciente não responde há mais de 24h desde a última mensagem NOSSA (ver cron
 * em src/app/api/cron/no-response-tagging) — some sozinha assim que ele responde
 * de novo (ver webhook route.ts). */
export const NO_RESPONSE_TAG = "⏳ Sem retorno do paciente";

/** Aplicada automaticamente ao mover a conversa pra etapa "Orçamento" do funil
 * (ver updateConversationFunnelStage/Admin) — nunca removida sozinha. */
export const BUDGET_SENT_TAG = "💰 Orçamento enviado";

/** Aplicada automaticamente ao mover a conversa pra etapa "Agendado" do funil. */
export const SCHEDULED_TAG = "✅ Agendado";

/** Origem do primeiro contato — melhor esforço, só detecta quando o paciente manda
 * o texto pré-preenchido do link de WhatsApp de /clinicas (ver detectSourceTag em
 * auto-tags.ts) sem editar. Não cobre anúncio/indicação/outros canais, que ainda não
 * têm nenhum link rastreável — fica de fora até existir esse dado. */
export const MARKETPLACE_SOURCE_TAG = "📢 Origem: Marketplace";

/** Prefixo da tag dinâmica de interesse em procedimento (ver detectProcedureInterestTag
 * em auto-tags.ts) — o resto do texto é a palavra-chave detectada, ex: "🩺 Interesse: Ultrassom". */
export const PROCEDURE_INTEREST_TAG_PREFIX = "🩺 Interesse: ";

/** Aplicada pelo dispatcher de disparo em massa (src/lib/broadcast.ts) quando a
 * campanha tem `tagOnSend` setado — usada pelo aviso de remarcação em massa (médico
 * desmarcou a agenda do dia). Reabre a conversa e prioriza na fila (ver
 * computeQueueState em chat-crm-adapters.ts); some quando a recepção remove a tag
 * manualmente depois de confirmar a remarcação — nada remove ela sozinha. */
export const RESCHEDULE_PENDING_TAG = "⚠️ Remarcação Pendente";

/** Resposta do paciente ao lembrete D-1 (ou a qualquer confirmação de agendamento,
 * ver webhook route.ts) — aplicada em todos os 3 fluxos onde isso é detectado
 * (agendamento nosso, agendamento só do bridge/recepção, e pedido de remarcação).
 * Mutuamente exclusivas entre si (ver outcomeTags/nextTagsForOutcome abaixo): se o
 * paciente responder de novo com um resultado diferente, a tag antiga é trocada,
 * não acumulada — pra filtro por tag não misturar "Confirmado" com "Cancelado" na
 * mesma conversa. Usadas pelo filtro "Filtrar por Tag" da fila, nenhum significado
 * especial na UI além disso (ao contrário de URGENCY_TAG etc acima). */
export const CONFIRMED_TAG = "✅ Confirmado";
export const CANCELLED_TAG = "❌ Cancelado";
export const RESCHEDULED_TAG = "🔁 Remarcado";

const OUTCOME_TAGS = [CONFIRMED_TAG, CANCELLED_TAG, RESCHEDULED_TAG];

/** Troca a tag de resultado (Confirmado/Cancelado/Remarcado) sem acumular as
 * outras duas nem duplicar a mesma — preserva qualquer outra tag (urgência, lead,
 * interesse em procedimento etc) intacta. */
export function nextTagsForOutcome(currentTags: string[], outcomeTag: string): string[] {
  const withoutOtherOutcomes = currentTags.filter((t) => !OUTCOME_TAGS.includes(t) || t === outcomeTag);
  return withoutOtherOutcomes.includes(outcomeTag) ? withoutOtherOutcomes : [...withoutOtherOutcomes, outcomeTag];
}
