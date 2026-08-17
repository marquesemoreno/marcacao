import { z } from "zod";

export const pixKeyTypeValues = ["CPF", "EMAIL", "PHONE", "RANDOM"] as const;

export const registerAffiliateSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo"),
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length >= 10 && value.length <= 11, "WhatsApp inválido"),
  city: z.string().trim().min(2, "Informe sua cidade"),
  pixKey: z.string().trim().min(3, "Informe sua chave PIX"),
  pixType: z.enum(pixKeyTypeValues),
});

export type RegisterAffiliateInput = z.input<typeof registerAffiliateSchema>;

export const loginAffiliateSchema = z.object({
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length >= 10 && value.length <= 11, "WhatsApp inválido"),
  code: z
    .string()
    .trim()
    .min(3, "Informe seu código de marcador")
    .transform((value) => value.toUpperCase()),
});

export type LoginAffiliateInput = z.input<typeof loginAffiliateSchema>;
