import { z } from "zod";

export const createAppointmentSchema = z.object({
  patientName: z.string().trim().min(3, "Informe o nome completo"),
  patientCpf: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 11, "CPF deve ter 11 dígitos"),
  patientPhone: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length >= 10 && value.length <= 11, "WhatsApp inválido"),
  clinicProcedureId: z.string().min(1),
  date: z.string().min(1, "Escolha uma data"),
  timeSlot: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateAppointmentInput = z.input<typeof createAppointmentSchema>;
