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
