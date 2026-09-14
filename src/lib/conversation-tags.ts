/** Tags de Conversation com significado especial na UI (badge visual na fila) —
 * ficam num arquivo sem "server-only" de propósito, porque tanto o webhook
 * (servidor, quem adiciona a tag) quanto o InboxLayout (cliente, quem decide o
 * destaque visual) precisam do mesmo valor exato. */
export const URGENCY_TAG = "🚨 Urgência Clínica";
