/** Checklist de clínica nova no /admin/clinicas (Etapa 6.2, 07/11/2026): o que falta para
 * a clínica usar o sistema. Obrigatórios contam para "pronta"; os outros destravam
 * recursos (campanhas de marketing, IA, lembrete automático, avaliação no Google). Puro. */

export type ClinicSetupInput = {
  users: number;
  procedures: number;
  whatsappConnected: boolean;
  cloudActive: boolean;
  hasBusinessHours: boolean;
  hasDefaultTicket: boolean;
  hasTechnicalDirector: boolean;
  knowledgeEntries: number;
  hasBridge: boolean;
  hasGoogleReview: boolean;
};

export type SetupItem = { key: string; label: string; hint: string; done: boolean; required: boolean };

export function clinicSetupChecklist(s: ClinicSetupInput) {
  const items: SetupItem[] = [
    { key: "equipe", label: "Equipe cadastrada", hint: "Atendentes (botão Equipe)", done: s.users > 0, required: true },
    { key: "whatsapp", label: "WhatsApp conectado", hint: "Evolution ou API oficial", done: s.whatsappConnected || s.cloudActive, required: true },
    { key: "procedimentos", label: "Procedimentos e preços", hint: "Usados pela IA e no agendamento", done: s.procedures > 0, required: true },
    { key: "horario", label: "Horário de funcionamento", hint: "Fora do horário, auto-encerramento, régua", done: s.hasBusinessHours, required: true },
    { key: "ticket", label: "Ticket médio", hint: "Receita estimada no Relatório", done: s.hasDefaultTicket, required: true },
    { key: "responsavel", label: "Responsável técnico (CRM)", hint: "Sem ele campanhas de marketing não iniciam", done: s.hasTechnicalDirector, required: false },
    { key: "conhecimento", label: "Base de conhecimento da IA", hint: "Convênios, preparo, endereço", done: s.knowledgeEntries > 0, required: false },
    { key: "ponte", label: "Ponte com o sistema da clínica", hint: "Agenda e lembrete D-1 automático", done: s.hasBridge, required: false },
    { key: "google", label: "Link de avaliação no Google", hint: "NPS 9–10 recebe o botão", done: s.hasGoogleReview, required: false },
  ];
  const req = items.filter((i) => i.required);
  const done = req.filter((i) => i.done).length;
  return { items, done, required: req.length, ready: done === req.length };
}
