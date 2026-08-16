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
