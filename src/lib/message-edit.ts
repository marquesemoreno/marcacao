/** Mesmo limite que a Meta aplica no app oficial do WhatsApp — passado isso, a
 * própria plataforma rejeita/ignora silenciosamente a edição, então nem vale a
 * pena deixar tentar. */
export const EDIT_WINDOW_MINUTES = 15;

type EditableMessage = {
  type: string;
  direction: string;
  whatsappKeyId: string | null;
  createdAt: Date;
  deletedAt: Date | null;
};

/** Decide se uma mensagem pode ser editada — usado tanto pra autorizar a ação
 * no servidor (editMessage/editMessageAdmin) quanto pra decidir se mostra o
 * botão "Editar" na UI (toChatMessage). Só mensagem de TEXTO, nossa, já
 * confirmada como enviada de verdade (tem whatsappKeyId), não apagada, e
 * dentro da janela de edição do WhatsApp. */
export function canEditMessage(
  message: EditableMessage,
  now: Date = new Date()
): { ok: true } | { ok: false; reason: string } {
  if (message.direction !== "OUTBOUND") {
    return { ok: false, reason: "Só é possível editar mensagens enviadas por nós." };
  }
  if (message.type !== "TEXT") {
    return { ok: false, reason: "Só é possível editar mensagens de texto." };
  }
  if (message.deletedAt) {
    return { ok: false, reason: "Mensagem apagada não pode ser editada." };
  }
  if (!message.whatsappKeyId) {
    return { ok: false, reason: "Mensagem ainda não foi confirmada como enviada." };
  }
  // API oficial (id "wamid."): a Meta não tem como editar pela API — só pelo celular.
  if (message.whatsappKeyId.startsWith("wamid.")) {
    return { ok: false, reason: CLOUD_LOCKED_REASON };
  }
  const ageMinutes = (now.getTime() - message.createdAt.getTime()) / 60000;
  if (ageMinutes > EDIT_WINDOW_MINUTES) {
    return { ok: false, reason: `Só é possível editar até ${EDIT_WINDOW_MINUTES} minutos após o envio.` };
  }
  return { ok: true };
}

/** "Apagar para todos" do WhatsApp — o app aceita por cerca de 2 dias; usamos 48 h. */
export const DELETE_WINDOW_HOURS = 48;

const DELETABLE_TYPES = new Set(["TEXT", "ATTACHMENT", "AUDIO", "CONTACT"]);

/** Decide se dá para apagar para todos (mostra a lixeira e autoriza deleteMessage). Só
 * mensagem nossa, já confirmada (whatsappKeyId), pela Evolution — a API oficial não apaga. */
export function canDeleteMessage(
  message: EditableMessage,
  now: Date = new Date()
): { ok: true } | { ok: false; reason: string } {
  if (message.direction !== "OUTBOUND" || !DELETABLE_TYPES.has(message.type)) {
    return { ok: false, reason: "Só é possível apagar mensagens enviadas por nós." };
  }
  if (message.deletedAt) return { ok: false, reason: "Mensagem já apagada." };
  if (!message.whatsappKeyId) return { ok: false, reason: "Mensagem ainda não foi confirmada como enviada." };
  if (message.whatsappKeyId.startsWith("wamid.")) {
    return { ok: false, reason: CLOUD_LOCKED_REASON };
  }
  if ((now.getTime() - message.createdAt.getTime()) / 3600000 > DELETE_WINDOW_HOURS) {
    return { ok: false, reason: `Só é possível apagar até ${DELETE_WINDOW_HOURS} horas após o envio.` };
  }
  return { ok: true };
}

const CLOUD_LOCKED_REASON =
  "A API oficial do WhatsApp não deixa editar nem apagar daqui. Se precisar, faça pelo celular (WhatsApp Business) ou mande uma nova mensagem corrigindo.";

/** Motivo mostrado no lugar de editar/apagar em mensagem nossa da API oficial (wamid.). */
export function cloudLockedReason(message: EditableMessage): string | undefined {
  if (message.direction !== "OUTBOUND" || !DELETABLE_TYPES.has(message.type) || message.deletedAt) return undefined;
  return message.whatsappKeyId?.startsWith("wamid.") ? CLOUD_LOCKED_REASON : undefined;
}
