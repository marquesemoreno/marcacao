"use server";

import { prisma } from "@/lib/prisma";
import { AppointmentType, Prisma, ProcedureCategory } from "@prisma/client";

export type SearchFilters = {
  query?: string;
  neighborhood?: string;
  category?: ProcedureCategory;
  appointmentType?: AppointmentType;
  maxPrice?: number;
  minRating?: number;
  sort?: "price_asc" | "price_desc" | "rating_desc";
};

export async function searchClinicProcedures(filters: SearchFilters) {
  const { query, neighborhood, category, appointmentType, maxPrice, minRating, sort } = filters;

  const where: Prisma.ClinicProcedureWhereInput = {
    clinic: {
      active: true,
      ...(minRating ? { rating: { gte: minRating } } : {}),
      ...(neighborhood ? { neighborhood: { contains: neighborhood, mode: "insensitive" } } : {}),
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

export async function getFeaturedClinics(limit = 6) {
  return prisma.clinic.findMany({
    where: { active: true },
    orderBy: { rating: "desc" },
    take: limit,
    select: {
      id: true,
      tradeName: true,
      neighborhood: true,
      city: true,
      rating: true,
      reviewCount: true,
      clinicProcedures: {
        take: 4,
        orderBy: { procedure: { name: "asc" } },
        select: { procedure: { select: { name: true } } },
      },
    },
  });
}
