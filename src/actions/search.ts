"use server";

import { prisma } from "@/lib/prisma";
import { AppointmentType, Prisma, ProcedureCategory } from "@prisma/client";

export type SearchFilters = {
  query?: string;
  category?: ProcedureCategory;
  appointmentType?: AppointmentType;
  maxPrice?: number;
  minRating?: number;
  sort?: "price_asc" | "price_desc" | "rating_desc";
};

export async function searchClinicProcedures(filters: SearchFilters) {
  const { query, category, appointmentType, maxPrice, minRating, sort } = filters;

  const where: Prisma.ClinicProcedureWhereInput = {
    clinic: {
      active: true,
      ...(minRating ? { rating: { gte: minRating } } : {}),
    },
    ...(category ? { procedure: { category } } : {}),
    ...(appointmentType ? { appointmentType } : {}),
    ...(maxPrice ? { price: { lte: maxPrice } } : {}),
    ...(query
      ? {
          OR: [
            { procedure: { name: { contains: query, mode: "insensitive" } } },
            { procedure: { specialty: { name: { contains: query, mode: "insensitive" } } } },
            { clinic: { tradeName: { contains: query, mode: "insensitive" } } },
            { clinic: { neighborhood: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  return prisma.clinicProcedure.findMany({
    where,
    include: { clinic: true, procedure: { include: { specialty: true } } },
    orderBy:
      sort === "price_asc"
        ? { price: "asc" }
        : sort === "price_desc"
          ? { price: "desc" }
          : { clinic: { rating: "desc" } },
  });
}

export async function getClinicProcedureDetail(id: string) {
  return prisma.clinicProcedure.findUnique({
    where: { id },
    include: { clinic: true, procedure: { include: { specialty: true } } },
  });
}
