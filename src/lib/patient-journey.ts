import type { FormTemplateBody } from "@/lib/patient-form";

/** Jornada do paciente (fase 2): padrões e regras puras da ficha prévia e do check-in. */

/** Decisão do dono (02/11/2026): ficha prévia é triagem — a clínica copia o que importa pro
 * prontuário; o Conecta apaga as respostas depois de 1 ano (cron data-retention). */
export const FORM_RETENTION_DAYS = 365;

export const DEFAULT_ANAMNESE_TEMPLATE: FormTemplateBody = {
  questions: [
    { id: "motivo", label: "Qual o motivo da consulta?", type: "text", required: true },
    { id: "primeira_vez", label: "É sua primeira consulta com este médico?", type: "yesno", required: true },
    { id: "alergia", label: "Tem alergia a algum medicamento?", type: "yesno", required: true },
    { id: "alergia_quais", label: "Quais medicamentos?", type: "text", required: true, showIf: { id: "alergia", equals: "sim" } },
    { id: "medicamentos", label: "Usa algum medicamento contínuo? Quais?", type: "text", required: false },
    { id: "doencas", label: "Tem alguma doença crônica (pressão alta, diabetes…)?", type: "text", required: false },
    { id: "cirurgias", label: "Já fez alguma cirurgia? Qual?", type: "text", required: false },
  ],
};

/** Rascunho v1 (02/11/2026) — PRECISA de revisão jurídica antes de ir pros pacientes.
 * "{{clinica}}" é trocado pelo nome da clínica na tela. */
export const DEFAULT_CONSENT_TERM = {
  kind: "ANAMNESE",
  version: 1,
  title: "Uso dos seus dados nesta ficha",
  body: [
    "Ao enviar esta ficha, você autoriza a {{clinica}} a usar as respostas para preparar o seu atendimento.",
    "Estas informações são dados de saúde, protegidos pela Lei Geral de Proteção de Dados (LGPD). Elas ficam guardadas com criptografia e só a equipe da clínica pode ver; cada acesso fica registrado.",
    "As respostas não são usadas para propaganda e não são compartilhadas com outras empresas. O Conecta Saúde é a plataforma que guarda os dados em nome da clínica.",
    "A clínica pode copiar o que for importante para o seu prontuário. Nesta plataforma, as respostas são apagadas depois de 1 ano.",
    "Você pode pedir a qualquer momento para ver, corrigir ou excluir seus dados, ou retirar esta autorização, falando com a clínica pelo WhatsApp.",
  ].join("\n\n"),
};

const BR_OFFSET_MS = 3 * 3_600_000; // America/Bahia, sem horário de verão

/** Quando o "Cheguei" pelo celular vale: no dia da consulta, a partir de 2 h antes do
 * horário (sem horário = o dia todo), até o fim do dia. */
export function checkinWindow(date: string, time: string | null, now: Date = new Date()): "EARLY" | "OPEN" | "CLOSED" {
  const local = new Date(now.getTime() - BR_OFFSET_MS);
  const today = local.toISOString().slice(0, 10);
  if (today < date) return "EARLY";
  if (today > date) return "CLOSED";
  if (!time) return "OPEN";
  const nowMin = local.getUTCHours() * 60 + local.getUTCMinutes();
  const [h, m] = time.split(":").map(Number);
  return nowMin >= h * 60 + m - 120 ? "OPEN" : "EARLY";
}

/** Linha acrescentada ao lembrete da véspera (sem mensagem extra — risco de bloqueio). */
export function formLinkLine(url: string): string {
  return `📝 Para agilizar sua chegada, preencha a ficha antes da consulta: ${url}`;
}
