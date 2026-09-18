import { z } from "zod";

// "" (campo vazio de formulário/CSV) deve valer como "não informado".
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/** Cadastro/importação de lead de MSP pelo admin (AddMspLeadDialog e
 * ImportMspLeadsCsvDialog) — só nome e telefone são obrigatórios, o resto é
 * contexto opcional que ajuda a priorizar/segmentar, não bloqueia o cadastro. */
export const mspLeadSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do negócio"),
  segment: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  city: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  channel: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length >= 10 && value.length <= 11, "Telefone/WhatsApp inválido"),
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type MspLeadInput = z.input<typeof mspLeadSchema>;
