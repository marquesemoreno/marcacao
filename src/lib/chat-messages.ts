/** Textos automáticos reconhecidos tanto por quem os gera quanto pela UI que
 * precisa renderizá-los diferente de uma mensagem digitada por gente — fonte
 * única evita o texto de geração e o de detecção saírem de sincronia. */

/** Prefixo do aviso salvo quando o WhatsApp não deixa baixar uma mídia recebida. */
export const MEDIA_DOWNLOAD_FAILED_PREFIX = "⚠️ Não foi possível baixar";

export function isMediaDownloadFailedNotice(content: string): boolean {
  return content.startsWith(MEDIA_DOWNLOAD_FAILED_PREFIX);
}

/** Template da confirmação automática enviada ao paciente quando o agendamento é criado pelo CRM. */
export const APPOINTMENT_CONFIRMED_TEMPLATE =
  "✅ *Agendamento Realizado!* 👋 Olá, {{nome}}! Seu agendamento para *{{procedimento}}* na clínica *{{clinica}}* foi realizado com sucesso!";

const AUTO_SYSTEM_MESSAGE_MARKERS = ["✅ *Agendamento Realizado!*"];

export function isAutoSystemMessage(content: string): boolean {
  return AUTO_SYSTEM_MESSAGE_MARKERS.some((marker) => content.startsWith(marker));
}

/** Decide se vale mostrar o botão "Extrair dados" (nota fiscal) numa mensagem — sem IA
 * nenhuma, só texto. Usado tanto no client (gate do botão em message-bubble.tsx) quanto
 * no server (validação da action extractMessageInvoiceData) — por isso mora aqui, não em
 * invoice-extraction.ts (que tem `server-only` e não pode ser importado de componente client). */
export function mentionsInvoiceRequest(content: string): boolean {
  return content.toLowerCase().includes("nota fiscal");
}

/// Campos extraídos sob demanda de um pedido de nota fiscal (ver invoice-extraction.ts) —
/// tipo mora aqui (não em invoice-extraction.ts, que tem `server-only`) porque
/// types/chat-crm.ts e componentes client também precisam dele.
export type InvoiceData = {
  cpf?: string;
  endereco?: string;
  dependentes?: string;
  valor?: string;
};
