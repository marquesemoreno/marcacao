/** Limite de conversas simultâneas por atendente (User.maxConcurrentChats). Desligado em
 * 09/10/2026 a pedido do usuário: a Urolaser vinha do WhatsApp Web, sem limite nenhum, e
 * o bloqueio atrapalhava mais que ajudava. Vamos redesenhar com base no histórico real
 * antes de religar — com false, ninguém é bloqueado ao assumir/transferir e o contador
 * "x de y" some do Chat. */
export const CHAT_LIMIT_ENABLED = false;
