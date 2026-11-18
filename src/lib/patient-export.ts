/** Arquivo dos dados do titular (LGPD art. 18, II e V: acesso e portabilidade) — montagem pura.
 * Leva o que a clínica guarda SOBRE o paciente e o que foi conversado com ele. Nunca leva nota
 * interna da equipe (é anotação de trabalho, não dado fornecido pelo titular). */
import { formatCnpj } from "./lgpd-certificate";

export type PatientExportInput = {
  generatedAt: Date;
  clinic: { name: string; cnpj: string };
  contact: { name: string | null; phone: string | null; instagramUsername: string | null };
  profile: {
    cpf: string | null;
    rg: string | null;
    birthDate: Date | null;
    address: string | null;
    convenio: string | null;
    insuranceCardNumber: string | null;
    preferredDoctor: string | null;
    notes: string | null;
    marketingConsentAt: Date | null;
    marketingConsentSource: string | null;
    guardianName: string | null;
    guardianRelationship: string | null;
    guardianPhone: string | null;
  } | null;
  channelConsents: { channel: string; address: string; consentAt: Date; revokedAt: Date | null; source: string | null }[];
  termAcceptances: { termTitle: string; acceptedAt: Date }[];
  appointments: { date: Date; timeSlot: string | null; status: string; procedure: string | null }[];
  messages: { createdAt: Date; direction: string; type: string; content: string | null }[];
};

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const MEDIA_LABEL: Record<string, string> = {
  AUDIO: "[áudio]",
  ATTACHMENT: "[arquivo]",
  CONTACT: "[contato]",
};

export function buildPatientExport(input: PatientExportInput) {
  const p = input.profile;
  return {
    sobre:
      "Dados pessoais que a clínica guarda sobre você no sistema de atendimento (Lei 13.709/2018, art. 18). Prontuário médico não faz parte deste arquivo: peça diretamente à clínica.",
    geradoEm: input.generatedAt.toISOString(),
    clinica: { nome: input.clinic.name, cnpj: formatCnpj(input.clinic.cnpj) },
    titular: {
      nome: input.contact.name,
      telefone: input.contact.phone,
      instagram: input.contact.instagramUsername,
      cpf: p?.cpf ?? null,
      rg: p?.rg ?? null,
      dataDeNascimento: day(p?.birthDate ?? null),
      endereco: p?.address ?? null,
      convenio: p?.convenio ?? null,
      carteirinha: p?.insuranceCardNumber ?? null,
      medicoDePreferencia: p?.preferredDoctor ?? null,
      observacoes: p?.notes ?? null,
      responsavel: p?.guardianName ? { nome: p.guardianName, parentesco: p.guardianRelationship, telefone: p.guardianPhone } : null,
    },
    consentimentos: {
      marketing: p?.marketingConsentAt ? { aceitoEm: p.marketingConsentAt.toISOString(), origem: p.marketingConsentSource } : null,
      canais: input.channelConsents.map((c) => ({
        canal: c.channel,
        endereco: c.address,
        aceitoEm: c.consentAt.toISOString(),
        revogadoEm: c.revokedAt?.toISOString() ?? null,
        origem: c.source,
      })),
      termos: input.termAcceptances.map((t) => ({ termo: t.termTitle, aceitoEm: t.acceptedAt.toISOString() })),
    },
    agendamentos: input.appointments.map((a) => ({ data: day(a.date), horario: a.timeSlot, situacao: a.status, servico: a.procedure })),
    mensagens: input.messages
      .filter((m) => m.type !== "INTERNAL_NOTE")
      .map((m) => ({
        em: m.createdAt.toISOString(),
        de: m.direction === "INBOUND" ? "paciente" : "clínica",
        texto: m.content?.trim() || MEDIA_LABEL[m.type] || `[${m.type.toLowerCase()}]`,
      })),
  };
}

/** Nome do arquivo sem o nome do paciente (vai parar em pasta de Downloads). Dia de Brasília. */
export function exportFileName(now: Date): string {
  return `dados-do-titular-${new Date(now.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)}.json`;
}
