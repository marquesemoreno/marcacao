import { z } from "zod";

export const updateClinicSchema = z.object({
  commissionRate: z.coerce.number().min(0).max(100),
  active: z.coerce.boolean(),
});

export const createClinicSchema = z.object({
  name: z.string().trim().min(3, "Informe a razão social"),
  tradeName: z.string().trim().min(2, "Informe o nome fantasia"),
  cnpj: z.string().trim().min(14, "CNPJ inválido"),
  phone: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  whatsapp: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  address: z.string().trim().min(3, "Informe o endereço"),
  neighborhood: z.string().trim().min(2, "Informe o bairro"),
  city: z.string().trim().min(2, "Informe a cidade"),
  commissionRate: z.coerce.number().min(0).max(100),
});
