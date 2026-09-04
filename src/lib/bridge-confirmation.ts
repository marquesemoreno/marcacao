export type BridgeConfirmationInput = {
  procedureName: string;
  doctorName: string | null;
  dateFormatted: string;
  time: string | null;
};

/** Confirmação enviada quando um agendamento é feito pelo bridge (Firebird) —
 * antes disso, nenhuma mensagem automática existia nesse fluxo, e as
 * atendentes digitavam esse texto na mão a cada agendamento. Mesmo modelo que
 * elas já usam ("por ordem de chegada", sem horário fixo de fila) — só sem o
 * valor (R$) por enquanto, e com os asteriscos de negrito balanceados (o
 * template original tinha um número ímpar, quebrando a formatação no WhatsApp). */
export function buildBridgeConfirmationMessage(input: BridgeConfirmationInput): string {
  const doctorText = input.doctorName ? ` com Dr(a). *${input.doctorName}*` : "";
  const timeText = input.time ? ` às *${input.time}*` : "";

  return `Agendado(a) *${input.procedureName}*${doctorText} para o dia *${input.dateFormatted}*${timeText}, por ordem de chegada!

📌 *As consultas têm prazo de até 30 dias para retorno — entre em contato antes do prazo para reagendar. Passado esse prazo, será cobrada uma nova consulta.*
💳 *Formas de pagamento: Dinheiro, Pix, Cartão de Crédito e Débito.*

Por favor, responda com uma das opções abaixo:
1️⃣ Digite 1 para Confirmar presença
2️⃣ Digite 2 para Cancelar
3️⃣ Digite 3 para Remarcar`;
}
