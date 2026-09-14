export type BridgeReminderInput = {
  patientName: string;
  clinicName: string;
  procedureName: string | null;
  doctorName: string | null;
  time: string | null;
  dateFormatted: string;
};

/** Texto do lembrete D-1 pra agendamentos vindos da agenda do bridge (Firebird)
 * — mesma ordem de opções de resposta (1 confirmar / 2 remarcar / 3 cancelar)
 * da confirmação (ver bridge-confirmation.ts), reconhecidas pelo webhook.
 * Campos vindos do Firebird nem sempre vêm preenchidos (médico/procedimento/
 * horário), então cada um só entra na frase se existir. */
export function buildBridgeReminderMessage(input: BridgeReminderInput): string {
  const procedureText = input.procedureName ? ` (${input.procedureName})` : "";
  const doctorText = input.doctorName ? ` com Dr(a). ${input.doctorName}` : "";
  const timeText = input.time ? ` às ${input.time}` : "";

  return `Olá ${input.patientName}! 👋 Lembrando da sua consulta/exame${procedureText}${doctorText} em ${input.dateFormatted}${timeText} na ${input.clinicName}.

Por favor, responda com o número da opção desejada:
1️⃣ Digite 1 para Confirmar presença
2️⃣ Digite 2 para Remarcar
3️⃣ Digite 3 para Cancelar`;
}

/** Frase fixa presente SÓ na versão "Lara" do lembrete (Urolaser) — reconhecida por
 * wasSentConfirmationPrompt (ver appointment-reply.ts) junto com o marcador
 * "Digite 1..." das outras clínicas, já que aqui não existe menu numerado nenhum
 * pro paciente responder. */
export const LARA_CONFIRMATION_MARKER = "responda esta mensagem para confirmar sua presença";

/** Variante do lembrete D-1 usada só pela Urolaser (pedido do cliente: recriar a
 * persona "Lara", atendente virtual deles, que já existia num sistema anterior —
 * ver imagem de referência com a mascote/logo da Urolaser). Ao contrário do
 * texto genérico acima, não usa menu numerado: o paciente responde livremente
 * na própria conversa, e a interpretação (confirmar/cancelar/remarcar) já é
 * feita pela IA quando a resposta não bate com uma frase conhecida (ver
 * classifyAppointmentReply em appointment-reply-ai.ts, item 6 do roadmap) — a
 * mensagem antiga direcionava pra um link/telefone externo, decisão consciente
 * de não repetir isso aqui pra manter a confirmação dentro do nosso webhook. */
export function buildUrolaserLaraReminderMessage(input: BridgeReminderInput): string {
  const procedureText = input.procedureName ? ` (${input.procedureName})` : "";
  const doctorText = input.doctorName ? ` com Dr(a). ${input.doctorName}` : "";
  const timeText = input.time ? ` a partir de ${input.time} (horário para fazer a ficha)` : "";

  return `Olá ${input.patientName}! Eu sou a Lara, atendente virtual da Urolaser 😊

Estou passando para te lembrar que você tem um atendimento agendado${procedureText}${doctorText} para o dia ${input.dateFormatted}${timeText}.

Por favor, ${LARA_CONFIRMATION_MARKER}. Se não puder comparecer ou precisar remarcar, é só nos avisar por aqui mesmo!

Obrigada! 💙`;
}
