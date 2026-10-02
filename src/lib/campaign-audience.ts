/** Regras de público das campanhas tiradas direto do sistema da clínica (Firebird, via
 * bridge GET /api/pacientes-campanha) — o bridge só devolve dados brutos, a decisão de
 * quem recebe fica aqui pra dar pra testar e mudar sem reinstalar nada na clínica. */
import { formatToWhatsAppNumber, isValidWhatsAppNumber, toggleNinthDigit } from "./whatsapp";
import { toTitleCaseName } from "./format";

export type BridgeCampaignPatient = {
  id: number;
  nome: string;
  telefone: string;
  /** AAAA-MM-DD ou null quando o cadastro não tem. */
  nascimento: string | null;
  ultimaMarcacao: string | null;
};

export type AudienceOptions = {
  minAge?: number;
  maxAge?: number;
  /** Contact.phone de quem já respondeu "9"/"sair" (formato 55+DDD+número). */
  optedOutPhones: Set<string>;
  /** Códigos de paciente (PACIENTE.CODIGOPAC) que a clínica tirou de campanhas — ex:
   * homem cadastrado como sexo feminino no sistema da clínica (Clinic.campaignExcludedPatientIds). */
  excludedPatientIds?: Set<number>;
  today?: Date;
};

export type AudienceRecipient = { phone: string; variables: { nome: string; saudacao: string } };

function ageOn(birth: string, today: Date): number | null {
  const d = new Date(`${birth}T12:00:00Z`);
  if (isNaN(d.getTime())) return null;
  let age = today.getUTCFullYear() - d.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < d.getUTCMonth() || (today.getUTCMonth() === d.getUTCMonth() && today.getUTCDate() < d.getUTCDate());
  if (beforeBirthday) age--;
  return age;
}

const firstName = (full: string) => toTitleCaseName(full.trim().split(/\s+/)[0] ?? "");

export function buildCampaignAudience(patients: BridgeCampaignPatient[], options: AudienceOptions) {
  const today = options.today ?? new Date();
  const stats = { total: patients.length, excludedManual: 0, excludedAge: 0, excludedNoBirthDate: 0, invalidPhone: 0, optedOut: 0, sharedPhones: 0 };

  // Filtra idade ANTES de agrupar por telefone: a filha menor com o celular da mãe não
  // pode transformar a mensagem da mãe em "sem nome".
  const byPhone = new Map<string, BridgeCampaignPatient[]>();
  for (const patient of patients) {
    if (options.excludedPatientIds?.has(Number(patient.id))) {
      stats.excludedManual++;
      continue;
    }
    const needsAge = options.minAge != null || options.maxAge != null;
    if (needsAge) {
      const age = patient.nascimento ? ageOn(patient.nascimento, today) : null;
      if (age === null) {
        // Sem idade mínima, quem não tem nascimento entra (não dá pra ser menor "provado").
        if (options.minAge != null) {
          stats.excludedNoBirthDate++;
          continue;
        }
      } else if ((options.minAge != null && age < options.minAge) || (options.maxAge != null && age > options.maxAge)) {
        stats.excludedAge++;
        continue;
      }
    }

    const phone = formatToWhatsAppNumber(patient.telefone);
    if (!isValidWhatsAppNumber(phone)) {
      stats.invalidPhone++;
      continue;
    }
    const alt = toggleNinthDigit(phone);
    if (options.optedOutPhones.has(phone) || (alt && options.optedOutPhones.has(alt))) {
      stats.optedOut++;
      continue;
    }
    byPhone.set(phone, [...(byPhone.get(phone) ?? []), patient]);
  }

  const recipients: AudienceRecipient[] = [];
  for (const [phone, group] of byPhone) {
    const names = new Set(group.map((g) => firstName(g.nome)));
    if (group.length > 1 && names.size > 1) {
      stats.sharedPhones++;
      recipients.push({ phone, variables: { nome: "", saudacao: "Oi" } });
    } else {
      const nome = firstName(group[0].nome);
      recipients.push({ phone, variables: { nome, saudacao: nome ? `Oi, ${nome}` : "Oi" } });
    }
  }
  return { recipients, stats };
}
