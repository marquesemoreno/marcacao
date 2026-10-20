/** Dados cadastrais do paciente por clínica (ContactClinicProfile) — ver o comentário do
 * model no schema. Toda leitura de CPF/RG/nascimento/endereço/carteirinha/convênio/médico/
 * observações nas telas da clínica passa por aqui, sempre filtrada pela clínica da sessão
 * (ou da conversa, no admin). */
import type { Prisma } from "@prisma/client";

export type ProfileFields = {
  cpf: string | null;
  rg: string | null;
  birthDate: Date | null;
  address: string | null;
  insuranceCardNumber: string | null;
  convenio: string | null;
  preferredDoctor: string | null;
  notes: string | null;
  marketingConsentAt: Date | null;
  marketingConsentSource: string | null;
  guardianName: string | null;
  guardianRelationship: string | null;
  guardianPhone: string | null;
};

export const EMPTY_PROFILE: ProfileFields = {
  cpf: null,
  rg: null,
  birthDate: null,
  address: null,
  insuranceCardNumber: null,
  convenio: null,
  preferredDoctor: null,
  notes: null,
  marketingConsentAt: null,
  marketingConsentSource: null,
  guardianName: null,
  guardianRelationship: null,
  guardianPhone: null,
};

/** `include`/`select` do perfil da clínica dentro de um contact. */
export function profileInclude(clinicId: string) {
  return { clinicProfiles: { where: { clinicId }, take: 1 } } satisfies Prisma.ContactInclude;
}

/** `include` do contact com os perfis — o certo é escolher o da clínica com profileOf. */
export const CONTACT_WITH_PROFILES = { include: { clinicProfiles: true } } as const;

/** Perfil da clínica `clinicId` (ou o único carregado, com profileInclude). Nunca devolve o
 * perfil de outra clínica: sem correspondência, vazio. */
export function profileOf(
  contact: { clinicProfiles?: (Partial<ProfileFields> & { clinicId?: string })[] | null },
  clinicId?: string
): ProfileFields {
  const list = contact.clinicProfiles ?? [];
  const p = clinicId ? list.find((x) => x.clinicId === clinicId) : list[0];
  if (!p) return EMPTY_PROFILE;
  const merged = { ...EMPTY_PROFILE, ...p };
  return Object.fromEntries(Object.keys(EMPTY_PROFILE).map((k) => [k, merged[k as keyof ProfileFields] ?? null])) as ProfileFields;
}

/** Filtro de busca por CPF (dígitos) e/ou convênio no perfil da clínica. */
export function profileWhere(clinicId: string, where: Prisma.ContactClinicProfileWhereInput): Prisma.ContactWhereInput {
  return { clinicProfiles: { some: { clinicId, ...where } } };
}

/** Grava (cria ou atualiza) campos do perfil da clínica. `undefined` = não mexe. */
export function upsertProfile(
  tx: { contactClinicProfile: Prisma.TransactionClient["contactClinicProfile"] },
  contactId: string,
  clinicId: string,
  data: Partial<ProfileFields>
) {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as Partial<ProfileFields>;
  if (Object.keys(clean).length === 0) return Promise.resolve(null);
  return tx.contactClinicProfile.upsert({
    where: { contactId_clinicId: { contactId, clinicId } },
    create: { contactId, clinicId, ...clean },
    update: clean,
  });
}
