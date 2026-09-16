export type BridgeReminderInput = {
  patientName: string;
  clinicName: string;
  procedureName: string | null;
  doctorName: string | null;
  time: string | null;
  dateFormatted: string;
};

/** Nomes vindos do Firebird chegam em CAIXA ALTA (ex: "ALAN PASCOAL SILVA SANTOS") — deixa
 * mais legível no WhatsApp sem gritar. Preposições continuam minúsculas quando não são a
 * primeira palavra (ex: "Vivaldo José de Oliveira"), como convenção de nome próprio em
 * português. */
const NAME_LOWERCASE_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);
function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word, index) => (index > 0 && NAME_LOWERCASE_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

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
export const LARA_CONFIRMATION_MARKER = "responda *SIM* para confirmar sua presença";

/** Variante do lembrete D-1 usada só pela Urolaser (pedido do cliente: recriar a
 * persona "Lara", atendente virtual deles, que já existia num sistema anterior —
 * ver imagem de referência com a mascote/logo da Urolaser). Pede SIM/NÃO em vez
 * de texto livre (pedido da clínica, 15/09/2026): resolveStatusFromReply já
 * reconhece as duas palavras com match exato, então isso é mais confiável que
 * depender da IA (classifyAppointmentReply) pra interpretar uma resposta livre — a
 * mensagem antiga direcionava pra um link/telefone externo, decisão consciente
 * de não repetir isso aqui pra manter a confirmação dentro do nosso webhook. */
export function buildUrolaserLaraReminderMessage(input: BridgeReminderInput): string {
  const isConsulta = input.procedureName?.toUpperCase().includes("CONSULTA") ?? false;
  const doctorTitleCase = input.doctorName ? toTitleCase(input.doctorName) : null;
  const doctorText = doctorTitleCase ? ` com Dr. *${doctorTitleCase}*` : "";

  // Pedido da clínica: "Consulta com Dr. X" em vez do nome cru do procedimento
  // (ex: "CONSULTA UROLOGIA"); pra exame, mostra o nome do exame no lugar de "Consulta".
  const appointmentLabel = isConsulta
    ? `uma Consulta${doctorText}`
    : input.procedureName
    ? `${toTitleCase(input.procedureName)}${doctorText}`
    : `um atendimento agendado${doctorText}`;

  const timeText = input.time ? ` a partir de *${input.time}* (atendimento por ordem de chegada)` : "";

  return `Olá *${toTitleCase(input.patientName)}*! Eu sou a Lara, atendente virtual da Urolaser 😊

Estou passando para te lembrar que você tem ${appointmentLabel} para o dia *${input.dateFormatted}*${timeText}.

Por favor, ${LARA_CONFIRMATION_MARKER}. Se não puder comparecer ou precisar remarcar, responda *NÃO*!

Obrigada! 💙`;
}
