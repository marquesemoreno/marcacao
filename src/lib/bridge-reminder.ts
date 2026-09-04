export type BridgeReminderInput = {
  patientName: string;
  clinicName: string;
  procedureName: string | null;
  doctorName: string | null;
  time: string | null;
  dateFormatted: string;
};

/** Texto do lembrete D-1 pra agendamentos vindos da agenda do bridge (Firebird)
 * — mesmas opções de resposta (1/2) já reconhecidas pelo webhook. Campos vindos
 * do Firebird nem sempre vêm preenchidos (médico/procedimento/horário), então
 * cada um só entra na frase se existir. */
export function buildBridgeReminderMessage(input: BridgeReminderInput): string {
  const procedureText = input.procedureName ? ` (${input.procedureName})` : "";
  const doctorText = input.doctorName ? ` com Dr(a). ${input.doctorName}` : "";
  const timeText = input.time ? ` às ${input.time}` : "";

  return `Olá ${input.patientName}! 👋 Lembrando da sua consulta/exame${procedureText}${doctorText} em ${input.dateFormatted}${timeText} na ${input.clinicName}.

Por favor, responda com uma das opções abaixo:
1️⃣ Digite 1 para Confirmar presença
2️⃣ Digite 2 para Cancelar
3️⃣ Digite 3 para Remarcar`;
}
