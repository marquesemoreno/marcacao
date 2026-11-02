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
  /** Bridge novo (01/11/2026): última marcação até hoje, próxima futura e última com STATUS
   * de atendido (só quando a clínica preenche status). AAAA-MM-DD ou null. */
  ultimaPassada?: string | null;
  proximaMarcacao?: string | null;
  ultimaAtendida?: string | null;
  /** Código (MEDICOS.A_MEDICOS) do médico da última marcação passada. */
  medicoUltima?: string | null;
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
  /** Público "Retorno": só quem não vem há entre minMonths e maxMonths meses e não tem
   * consulta futura. futurePhones = telefones das marcações futuras (muitas entram sem
   * código de paciente, então o código sozinho não basta). */
  retorno?: { minMonths: number; maxMonths: number; futurePhones: Set<string> };
  /** Só pacientes cuja última consulta foi com um destes médicos (código do sistema). */
  doctorIds?: Set<string>;
  /** Régua automática: só quem teve a última consulta exatamente em `date` (AAAA-MM-DD).
   * Com futurePhones, quem já tem consulta futura fica de fora (retorno/reativação). */
  lastVisitOn?: { date: string; futurePhones?: Set<string> };
  /** Aniversário: só quem nasceu num destes dias ("MM-DD"). */
  birthdayOn?: string | string[];
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

/** Meses completos entre a data (AAAA-MM-DD) e hoje. */
function monthsBetween(date: string, today: Date): number | null {
  const d = new Date(`${date}T12:00:00Z`);
  if (isNaN(d.getTime())) return null;
  let months = (today.getUTCFullYear() - d.getUTCFullYear()) * 12 + (today.getUTCMonth() - d.getUTCMonth());
  if (today.getUTCDate() < d.getUTCDate()) months--;
  return months;
}

const firstName = (full: string) => toTitleCaseName(full.trim().split(/\s+/)[0] ?? "");

export function buildCampaignAudience(patients: BridgeCampaignPatient[], options: AudienceOptions) {
  const today = options.today ?? new Date();
  const stats = {
    total: patients.length,
    excludedManual: 0,
    excludedAge: 0,
    excludedNoBirthDate: 0,
    invalidPhone: 0,
    optedOut: 0,
    sharedPhones: 0,
    excludedRetornoRange: 0,
    excludedHasFuture: 0,
    excludedDoctor: 0,
    excludedNotBirthday: 0,
  };
  const birthdayKeys = options.birthdayOn ? new Set([options.birthdayOn].flat()) : null;
  // Código do médico vem como número (Santa Clara: 4) ou texto com zero ("04") conforme a tabela.
  const doctorKey = (d: string | number | null | undefined) => String(d ?? "").trim().replace(/^0+(?=\d)/, "");
  const doctorIds = options.doctorIds?.size ? new Set([...options.doctorIds].map(doctorKey)) : null;
  const futurePhones = new Set<string>();
  for (const raw of [...(options.retorno?.futurePhones ?? []), ...(options.lastVisitOn?.futurePhones ?? [])]) {
    const f = formatToWhatsAppNumber(raw);
    futurePhones.add(f);
    const alt = toggleNinthDigit(f);
    if (alt) futurePhones.add(alt);
  }

  // Filtra idade ANTES de agrupar por telefone: a filha menor com o celular da mãe não
  // pode transformar a mensagem da mãe em "sem nome".
  const byPhone = new Map<string, BridgeCampaignPatient[]>();
  for (const patient of patients) {
    if (options.excludedPatientIds?.has(Number(patient.id))) {
      stats.excludedManual++;
      continue;
    }
    if (doctorIds && !doctorIds.has(doctorKey(patient.medicoUltima))) {
      stats.excludedDoctor++;
      continue;
    }
    if (options.retorno) {
      if (patient.proximaMarcacao || futurePhones.has(formatToWhatsAppNumber(patient.telefone))) {
        stats.excludedHasFuture++;
        continue;
      }
      const last = patient.ultimaAtendida ?? patient.ultimaPassada ?? null;
      const months = last ? monthsBetween(last, today) : null;
      if (months === null || months < options.retorno.minMonths || months >= options.retorno.maxMonths) {
        stats.excludedRetornoRange++;
        continue;
      }
    }
    if (birthdayKeys && !(patient.nascimento && birthdayKeys.has(patient.nascimento.slice(5, 10)))) {
      stats.excludedNotBirthday++;
      continue;
    }
    if (options.lastVisitOn) {
      if (options.lastVisitOn.futurePhones && (patient.proximaMarcacao || futurePhones.has(formatToWhatsAppNumber(patient.telefone)))) {
        stats.excludedHasFuture++;
        continue;
      }
      if ((patient.ultimaAtendida ?? patient.ultimaPassada ?? null) !== options.lastVisitOn.date) {
        stats.excludedRetornoRange++;
        continue;
      }
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
