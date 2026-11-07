/** Processos por setor (07/11/2026): o passo a passo de cada setor fica salvo no sistema para
 * a equipe consultar, tirar dúvida (IA responde pelo texto do processo) e mandar opinião ou
 * reclamação para a gestão. Os modelos abaixo descrevem o que o sistema já faz hoje; a gestão
 * revisa e publica — rascunho só a gestão vê. Puro e testado. */

export const PROCESS_SECTORS = [
  "RECEPCAO",
  "CONFIRMACAO",
  "CHAT",
  "ORCAMENTO",
  "CHEGADA",
  "GESTAO",
] as const;
export type ProcessSector = (typeof PROCESS_SECTORS)[number];

export const SECTOR_LABELS: Record<ProcessSector, string> = {
  RECEPCAO: "Recepção — agendamento",
  CONFIRMACAO: "Confirmação e lembretes",
  CHAT: "Atendimento no Chat",
  ORCAMENTO: "Orçamentos",
  CHEGADA: "Chegada do paciente e chamada",
  GESTAO: "Gestão — relatórios e financeiro",
};

export const FEEDBACK_KINDS = ["DUVIDA", "OPINIAO", "RECLAMACAO"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const FEEDBACK_LABELS: Record<FeedbackKind, string> = {
  DUVIDA: "Dúvida",
  OPINIAO: "Opinião / sugestão",
  RECLAMACAO: "Reclamação",
};
export const FEEDBACK_STATUSES = ["NOVA", "VISTA", "RESOLVIDA"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const PROCESS_BODY_MAX = 12_000;
export const FEEDBACK_TEXT_MAX = 2_000;

export const DEFAULT_PROCESSES: { sector: ProcessSector; title: string; body: string }[] = [
  {
    sector: "RECEPCAO",
    title: "Agendar um paciente",
    body: `Objetivo: todo pedido de marcação vira agendamento confirmado no sistema da clínica e o paciente recebe a confirmação.

1. O pedido chega pelo Chat (WhatsApp/Instagram), pelo telefone ou no balcão.
2. Pelo Chat: abra a conversa, clique em Agendar e escolha procedimento, convênio, médico, data e hora (ou "por ordem de chegada").
3. Pela Agenda: clique no horário livre na grade ou em "Novo agendamento"; informe nome e telefone do paciente.
4. Deixe marcada a caixa "Enviar confirmação ao paciente" — ele recebe dia, hora, médico, endereço e valor (quando houver).
5. A conversa vai sozinha para "Agendado" no CRM.
6. Pedidos que a IA anotou fora do horário (ou quando ninguém respondeu em 5 minutos) ficam em Agenda › Pedidos de marcação: ligue ou responda o paciente e agende.
7. Se não houver vaga, ofereça a Lista de espera (Agenda › Lista de espera) com médico e período preferido.

Atenção: nunca prometa horário sem conferir a agenda do médico.`,
  },
  {
    sector: "CONFIRMACAO",
    title: "Confirmação da consulta e lembretes",
    body: `Objetivo: reduzir faltas confirmando todos os pacientes no dia anterior.

1. O sistema manda o lembrete sozinho no dia anterior (entre 8h e 18h), para quem está agendado no sistema da clínica.
2. Respostas do paciente: 1 = confirma (o sistema marca como confirmado), 2 = quer remarcar, 3 = cancelar. Respostas em texto livre são lidas pela IA; na dúvida, a conversa vai para a recepção.
3. "Quer remarcar" e "cancelar" aparecem no Chat com etiqueta — a recepção remarca e libera o horário.
4. Paciente menor de idade: o lembrete vai para o responsável cadastrado na ficha.
5. Na Agenda, quem não confirmou aparece como "Sem confirmação" — vale ligar nos casos importantes.
6. Horário cancelado ou falta: marque na Agenda; com a vaga automática ligada, o sistema oferece o horário para a lista de espera.`,
  },
  {
    sector: "CHAT",
    title: "Atender uma conversa no Chat",
    body: `Objetivo: responder rápido, com informação correta, e sempre finalizar o atendimento.

1. Pegue a conversa em "Não atribuídas" (ela fica com você) ou atenda as que já são suas.
2. Use as respostas rápidas (/atalho) para preços e orientações padrão.
3. Confira a ficha do paciente no painel lateral (convênio, histórico, etiquetas).
4. Valor enviado ao paciente leva a conversa para "Orçamento"; agendamento leva para "Agendado" — automático.
5. Terminou? Clique em Finalizar e escolha o motivo certo (Agendamento concluído, Dúvida esclarecida, Perda e o motivo…). Isso alimenta os relatórios.
6. Conversa parada há 4 horas úteis com a última mensagem nossa é finalizada sozinha; se o paciente voltar em até 48h, retorna para a mesma atendente.
7. Urgência médica: oriente procurar o pronto-atendimento e avise a gestão.`,
  },
  {
    sector: "ORCAMENTO",
    title: "Orçamento enviado e cobrança",
    body: `Objetivo: não deixar orçamento esquecido.

1. Ao mandar valor ao paciente, a conversa entra em "Orçamento" e ganha a etiqueta 💰.
2. A fila de cobrança (Chat › Orçamentos) mostra quem está há 3, 7 e 15 dias sem resposta.
3. Revise a mensagem sugerida e envie, ou clique em Pular se não fizer sentido.
4. Paciente agendou: a conversa vai para "Agendado". Desistiu: finalize como Perda com o motivo (preço, horário, convênio…).
5. A gestão acompanha a conversão de orçamentos no Relatório.`,
  },
  {
    sector: "CHEGADA",
    title: "Chegada do paciente, senha e chamada",
    body: `Objetivo: organizar a fila de chegada e a chamada na TV.

1. O paciente pode avisar que chegou pelo link do WhatsApp ou pelo QR da recepção (só funciona dentro da clínica).
2. No balcão, a recepção marca "Chegou" na Agenda ou emite a senha (C = consulta, E = exame, R = retorno).
3. A ordem de chegada aparece na Agenda (Fila de chegada).
4. Para chamar: Senhas › Chamar. A TV da sala de espera mostra o nome/senha e fala a chamada.
5. Atendido: marque "Atendida" — a Agenda atualiza sozinha.`,
  },
  {
    sector: "GESTAO",
    title: "Rotina da gestão",
    body: `Objetivo: acompanhar números e corrigir o processo cedo.

1. Toda semana: Relatórios (tempo de resposta, conversão, motivos de perda, horas poupadas pela automação).
2. Todo mês: Financeiro (faturamento, a receber/a pagar, estoque) — lido do sistema da clínica; confira se as baixas estão em dia.
3. Leia as dúvidas, opiniões e reclamações dos Processos e marque como vista/resolvida.
4. Revise os textos automáticos em Ações da IA (boas-vindas, despedida, endereço) e os preços em Configurações.
5. Mudou um processo? Edite aqui e publique — todos passam a ver a versão nova.`,
  },
];

export function isProcessSector(v: unknown): v is ProcessSector {
  return typeof v === "string" && (PROCESS_SECTORS as readonly string[]).includes(v);
}

export function parseFeedback(input: { kind: unknown; text: unknown; anonymous?: unknown }):
  | { ok: true; kind: FeedbackKind; text: string; anonymous: boolean }
  | { ok: false; error: string } {
  if (typeof input.kind !== "string" || !(FEEDBACK_KINDS as readonly string[]).includes(input.kind)) {
    return { ok: false, error: "Escolha: dúvida, opinião ou reclamação." };
  }
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (text.length < 5) return { ok: false, error: "Escreva um pouco mais." };
  return { ok: true, kind: input.kind as FeedbackKind, text: text.slice(0, FEEDBACK_TEXT_MAX), anonymous: input.anonymous === true };
}

/** Prompt da IA que tira dúvida só pelo texto do processo. Se não estiver no texto, responde
 * NAO_SEI — aí a dúvida vai para a gestão. */
export function processQuestionPrompt(title: string, body: string): string {
  return `Você ajuda a equipe de uma clínica a entender um processo interno. Responda em português, curto (até 5 linhas), usando SOMENTE o texto do processo abaixo. Se a resposta não estiver no texto, responda exatamente NAO_SEI.

Processo: ${title}
---
${body.slice(0, PROCESS_BODY_MAX)}
---`;
}

export function interpretProcessAnswer(raw: string | null | undefined): { answered: true; text: string } | { answered: false } {
  const t = (raw ?? "").trim();
  if (!t || /NAO_SEI|NÃO_SEI/i.test(t)) return { answered: false };
  return { answered: true, text: t };
}
