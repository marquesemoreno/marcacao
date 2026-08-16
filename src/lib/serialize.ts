import type { Prisma } from "@prisma/client";
import type { ClinicProcedureResult } from "@/components/public/procedure-result-card";

export function toPlainClinicProcedure(result: ClinicProcedureResult) {
  return {
    ...result,
    price: Number(result.price),
    promotionalPrice: result.promotionalPrice !== null ? Number(result.promotionalPrice) : null,
    clinic: {
      ...result.clinic,
      commissionRate: Number(result.clinic.commissionRate),
    },
  };
}

export type PlainClinicProcedure = ReturnType<typeof toPlainClinicProcedure>;

type ClinicProcedureWithProcedure = Prisma.ClinicProcedureGetPayload<{
  include: { procedure: true };
}>;

export function toPlainClinicProcedureItem(item: ClinicProcedureWithProcedure) {
  return {
    ...item,
    price: Number(item.price),
    promotionalPrice: item.promotionalPrice !== null ? Number(item.promotionalPrice) : null,
  };
}

export type PlainClinicProcedureItem = ReturnType<typeof toPlainClinicProcedureItem>;

export function toPlainClinic(clinic: Prisma.ClinicGetPayload<Record<string, never>>) {
  return { ...clinic, commissionRate: Number(clinic.commissionRate) };
}

export type PlainClinic = ReturnType<typeof toPlainClinic>;

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: { clinicProcedure: { include: { clinic: true; procedure: true } } };
}>;

/** Decimal (price/commissionRate) não pode cruzar a fronteira Server→Client como está — mesma razão de toPlainClinicProcedure. */
export function toPlainAppointment(appointment: AppointmentWithRelations) {
  const { clinicProcedure, ...rest } = appointment;
  const { clinic, procedure, price, promotionalPrice, ...clinicProcedureRest } = clinicProcedure;
  return {
    ...rest,
    clinicProcedure: {
      ...clinicProcedureRest,
      price: Number(price),
      promotionalPrice: promotionalPrice !== null ? Number(promotionalPrice) : null,
      clinic: { ...clinic, commissionRate: Number(clinic.commissionRate) },
      procedure,
    },
  };
}

export type PlainAppointment = ReturnType<typeof toPlainAppointment>;
