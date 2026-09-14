export type BridgeConfirmationInput = {
  patientName: string;
  doctorName: string | null;
  dateFormatted: string;
  time: string | null;
};

/** Confirmação enviada quando um agendamento é feito pelo bridge (Firebird) —
 * antes disso, nenhuma mensagem automática existia nesse fluxo, e as
 * atendentes digitavam esse texto na mão a cada agendamento.
 *
 * Bug real relatado: essa mensagem reaproveitava o mesmo texto do lembrete D-1
 * (ver bridge-reminder.ts), com "Passando para lembrar..." e o menu "Digite
 * 1/2/3" — sem sentido logo depois de criar o agendamento (o paciente acabou de
 * pedir isso, não faz sentido perguntar se ele quer confirmar/remarcar/cancelar
 * na mesma hora). O menu com opções fica só no lembrete D-1, que é quando faz
 * sentido pedir confirmação de presença.
 *
 * Sem horário marcado (`time` vazio — atendente escolheu o modo "Chegada" no
 * modal, ver schedule-modal.tsx) mostra "Por ordem de chegada" em vez de
 * inventar um horário. */
export function buildBridgeConfirmationMessage(input: BridgeConfirmationInput): string {
  const lines = [
    `Olá, ${input.patientName}! Seu agendamento foi realizado:`,
    `📅 Data: ${input.dateFormatted}`,
    `⏰ Horário: ${input.time || "Por ordem de chegada"}`,
  ];
  if (input.doctorName) {
    lines.push(`👨‍⚕️ Profissional: Dr(a). ${input.doctorName}`);
  }
  lines.push("");
  lines.push(
    "📌 *As consultas têm o prazo de no máximo 30 dias para retorno, gentileza entrar em contato antes do prazo para agendar. Caso passe do prazo será cobrado uma nova consulta! Formas de pagamento: Dinheiro, Pix, Cartão de Crédito e Débito.*"
  );
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
  if (!addressParts) return "Agradecemos a confirmação!";
  return `Agradecemos a confirmação!\n📍 Te aguardamos no endereço: ${addressParts}`;
}
