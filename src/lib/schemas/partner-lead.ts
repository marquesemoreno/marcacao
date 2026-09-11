import { z } from "zod";

export const submitPartnerLeadSchema = z.object({
  clinicName: z.string().trim().min(2, "Informe o nome da clínica ou consultório"),
  contactName: z.string().trim().min(2, "Informe seu nome"),
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length >= 10 && value.length <= 11, "Telefone/WhatsApp inválido"),
  email: z.string().trim().email("E-mail inválido"),
  neighborhood: z.string().trim().min(2, "Informe o bairro"),
  specialties: z.string().trim().min(2, "Conte quais especialidades ou exames vocês realizam"),
  notes: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
});

export type SubmitPartnerLeadInput = z.input<typeof submitPartnerLeadSchema>;

// "" (campo vazio de formulário/CSV) deve valer como "não informado", não como
// valor inválido — usado só nos campos que o admin pode deixar em branco.
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/** Cadastro/importação feitos pelo admin (ApproveClinicDialog não usa isso — é só
 * pra criar o PartnerLead: AddLeadDialog e ImportLeadsCsvDialog). Mais permissivo
 * que submitPartnerLeadSchema porque a fonte pode ser uma extensão de scraping
 * (Google Maps etc.) que só traz dados do negócio, sem e-mail nem nome de uma
 * pessoa de contato — o formulário público continua exigindo os dois. */
export const adminPartnerLeadSchema = z.object({
  clinicName: z.string().trim().min(2, "Informe o nome da clínica ou consultório"),
  contactName: z.preprocess(emptyToUndefined, z.string().trim().min(2, "Nome do contato muito curto").optional()),
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length >= 10 && value.length <= 11, "Telefone/WhatsApp inválido"),
  email: z.preprocess(emptyToUndefined, z.string().trim().email("E-mail inválido").optional()),
  neighborhood: z.string().trim().min(2, "Informe o bairro"),
  specialties: z.string().trim().min(2, "Conte quais especialidades ou exames vocês realizam"),
  notes: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
});

export type AdminPartnerLeadInput = z.input<typeof adminPartnerLeadSchema>;
