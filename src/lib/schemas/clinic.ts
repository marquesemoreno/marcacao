import { z } from "zod";
import { AppointmentType, AppointmentStatus } from "@prisma/client";

export const updateClinicProcedureSchema = z.object({
  price: z.coerce.number().positive("Preço deve ser maior que zero"),
  promotionalPrice: z
    .union([z.coerce.number().positive(), z.literal("")])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  requiresAppointment: z.coerce.boolean(),
  appointmentType: z.nativeEnum(AppointmentType),
});

export const addClinicProcedureSchema = updateClinicProcedureSchema.extend({
  procedureId: z.string().min(1, "Escolha um procedimento"),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus),
});

const businessHoursDaySchema = z.object({
  closed: z.boolean().optional(),
  open: z.string().optional(),
  close: z.string().optional(),
});

export const businessHoursSchema = z.object({
  seg: businessHoursDaySchema,
  ter: businessHoursDaySchema,
  qua: businessHoursDaySchema,
  qui: businessHoursDaySchema,
  sex: businessHoursDaySchema,
  sab: businessHoursDaySchema,
  dom: businessHoursDaySchema,
});

export type BusinessHours = z.infer<typeof businessHoursSchema>;
