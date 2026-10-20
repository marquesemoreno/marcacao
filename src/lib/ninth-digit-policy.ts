/** Quando vale tentar o número com o 9º dígito trocado depois de um 400 da Evolution.
 * Auditoria de saúde (19/10): o número trocado pode ser o WhatsApp de OUTRA pessoa — um
 * lembrete com nome, médico e procedimento chegaria a um estranho. Só a resposta da
 * atendente no chat (eventos "chat.*", com a conversa aberta na frente) pode tentar; envio
 * automático falha e aparece como "Falha ao enviar" no chat pra recepção conferir o número. */
export function allowsNinthDigitFallback(event: string): boolean {
  return event.startsWith("chat.");
}
