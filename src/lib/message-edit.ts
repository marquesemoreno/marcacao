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
  const ageMinutes = (now.getTime() - message.createdAt.getTime()) / 60000;
  if (ageMinutes > EDIT_WINDOW_MINUTES) {
    return { ok: false, reason: `Só é possível editar até ${EDIT_WINDOW_MINUTES} minutos após o envio.` };
  }
  return { ok: true };
}
