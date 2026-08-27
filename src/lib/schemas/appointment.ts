import { z } from "zod";
import { isValidCpf } from "@/lib/cpf";

export const createAppointmentSchema = z.object({
  patientName: z
    .string()
    .trim()
    .min(3, "Informe o nome completo")
    .refine((value) => value.split(/\s+/).filter(Boolean).length >= 2, "Informe nome e sobrenome"),
  patientCpf: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine(isValidCpf, "CPF inválido — confira os números"),
  patientPhone: z
    .string()
    .transform((value) => {
      // O telefone do Contact é sempre salvo com DDI 55 (ex: 5577999990000) —
      // remove antes de validar, senão nenhum contato real passa na checagem.
      const digits = value.replace(/\D/g, "");
      return digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
    })
    .refine((value) => value.length >= 10 && value.length <= 11, "WhatsApp inválido"),
  clinicProcedureId: z.string().min(1),
  date: z.string().min(1, "Escolha uma data"),
  timeSlot: z.string().optional(),
  notes: z.string().optional(),
  /** Só usado no fluxo de integração hospitalar (Santa Clara/bridge) — clínicas do
   * marketplace não têm conceito de médico específico no agendamento rápido. */
  medicoId: z.string().optional(),
});

export type CreateAppointmentInput = z.input<typeof createAppointmentSchema>;
