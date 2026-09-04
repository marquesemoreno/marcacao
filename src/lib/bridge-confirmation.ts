export type BridgeConfirmationInput = {
  patientName: string;
  clinicName: string;
  doctorName: string | null;
  dateFormatted: string;
  time: string | null;
};

/** Confirmação enviada quando um agendamento é feito pelo bridge (Firebird) —
 * antes disso, nenhuma mensagem automática existia nesse fluxo, e as
 * atendentes digitavam esse texto na mão a cada agendamento. Endereço e
 * políticas de prazo/pagamento não entram aqui — só depois que o paciente
 * confirma (ver buildBridgeConfirmationFollowUp). */
export function buildBridgeConfirmationMessage(input: BridgeConfirmationInput): string {
  const lines = [
    `Olá, ${input.patientName}! Como vai?`,
    `Passando para lembrar do seu agendamento na ${input.clinicName}:`,
    `📅 Data: ${input.dateFormatted}`,
    `⏰ Horário: ${input.time ?? "A definir"}`,
  ];
  if (input.doctorName) {
    lines.push(`👨‍⚕️ Profissional: Dr(a). ${input.doctorName}`);
  }
  lines.push("");
  lines.push("Por favor, responda com o número da opção desejada:");
  lines.push("1 - Confirmar presença");
  lines.push("2 - Preciso remarcar");
  lines.push("3 - Cancelar agendamento");
  return lines.join("\n");
}

export type BridgeConfirmationFollowUpInput = {
  address: string | null;
  neighborhood: string | null;
  city: string | null;
};

/** Mandada automaticamente quando o paciente responde "1" (confirmar) — só
 * pra agendamento de origem bridge, no lugar da confirmação com Guia/QR Code
 * do marketplace, que não existe pra esses agendamentos. */
export function buildBridgeConfirmationFollowUp(input: BridgeConfirmationFollowUpInput): string {
  const addressParts = [input.address, input.neighborhood, input.city].filter(Boolean).join(", ");
  const addressLine = addressParts ? `📍 Endereço: ${addressParts}\n` : "";
  return `${addressLine}📌 As consultas têm prazo de até 30 dias para retorno — entre em contato antes do prazo para reagendar. Passado esse prazo, será cobrada uma nova consulta.
💳 Formas de pagamento: Dinheiro, Pix, Cartão de Crédito e Débito.`;
}
