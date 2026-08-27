"use server";

import { prisma } from "@/lib/prisma";
import { AppointmentType, Prisma, ProcedureCategory } from "@prisma/client";

/** Remove acentos para casar "clinico"/"clínico", "cardiologista"/"Cardiologista" etc. */
function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Sinônimos médicos populares — o paciente digita como fala ("cardiologista"),
 * o catálogo guarda como especialidade ("Cardiologia"). Chave normalizada
 * (minúscula, sem acento); cada busca expande para o termo digitado + estes.
 */
const MEDICAL_SYNONYMS: Record<string, string[]> = {
  urologista: ["urologia"],
  cardiologista: ["cardiologia"],
  oftalmologista: ["oftalmologia"],
  ginecologista: ["ginecologia"],
  ortopedista: ["ortopedia"],
  "clinico geral": ["clinica geral", "consulta"],
  clinico: ["clinica geral", "consulta"],
};

/** Se o termo digitado bater com uma categoria, também filtra por ela (procedure.category é enum — não dá pra usar "contains"). */
const CATEGORY_SYNONYMS: Record<string, ProcedureCategory> = {
  consulta: ProcedureCategory.CONSULTATION,
  consultas: ProcedureCategory.CONSULTATION,
  exame: ProcedureCategory.EXAM,
  exames: ProcedureCategory.EXAM,
  cirurgia: ProcedureCategory.SURGERY,
  cirurgias: ProcedureCategory.SURGERY,
  procedimento: ProcedureCategory.SURGERY,
  procedimentos: ProcedureCategory.SURGERY,
};

function buildQueryConditions(query: string): Prisma.ClinicProcedureWhereInput {
  const normalized = stripAccents(query.trim().toLowerCase());
  const terms = new Set<string>([query.trim()]);
  for (const extra of MEDICAL_SYNONYMS[normalized] ?? []) terms.add(extra);

  const termConditions: Prisma.ClinicProcedureWhereInput[] = Array.from(terms).flatMap((term) => [
    { procedure: { name: { contains: term, mode: "insensitive" as const } } },
    { procedure: { description: { contains: term, mode: "insensitive" as const } } },
    { procedure: { specialty: { name: { contains: term, mode: "insensitive" as const } } } },
    { clinic: { name: { contains: term, mode: "insensitive" as const } } },
    { clinic: { tradeName: { contains: term, mode: "insensitive" as const } } },
    { clinic: { neighborhood: { contains: term, mode: "insensitive" as const } } },
  ]);

  const matchedCategory = CATEGORY_SYNONYMS[normalized];
  if (matchedCategory) {
    termConditions.push({ procedure: { category: matchedCategory } });
  }

  return { OR: termConditions };
}

export type SearchFilters = {
  query?: string;
  neighborhood?: string;
  city?: string;
  clinicId?: string;
  clinicName?: string;
  category?: ProcedureCategory;
  appointmentType?: AppointmentType;
  maxPrice?: number;
  minRating?: number;
  sort?: "price_asc" | "price_desc" | "rating_desc";
};

export async function searchClinicProcedures(filters: SearchFilters) {
  const { query, neighborhood, city, clinicId, clinicName, category, appointmentType, maxPrice, minRating, sort } = filters;

  const where: Prisma.ClinicProcedureWhereInput = {
    clinic: {
      active: true,
      listedInMarketplace: true,
      ...(clinicId ? { id: clinicId } : {}),
      ...(clinicName ? { tradeName: { contains: clinicName, mode: "insensitive" } } : {}),
      ...(minRating ? { rating: { gte: minRating } } : {}),
      ...(neighborhood ? { neighborhood: { contains: neighborhood, mode: "insensitive" } } : {}),
      ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
    },
    ...(category ? { procedure: { category } } : {}),
    ...(appointmentType ? { appointmentType } : {}),
    ...(maxPrice ? { price: { lte: maxPrice } } : {}),
    ...(query ? buildQueryConditions(query) : {}),
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

/** Número de clínicas credenciadas disponíveis por especialidade e por procedimento. */
export async function getSpecialtyClinicCounts() {
  const rows = await prisma.clinicProcedure.findMany({
    where: { clinic: { active: true, listedInMarketplace: true } },
    select: {
      clinicId: true,
      procedure: { select: { name: true, specialty: { select: { name: true } } } },
    },
  });

  const clinicSets = new Map<string, Set<string>>();
  for (const row of rows) {
    const keys = [row.procedure.name, row.procedure.specialty?.name].filter(
      (key): key is string => Boolean(key)
    );
    for (const key of keys) {
      if (!clinicSets.has(key)) clinicSets.set(key, new Set());
      clinicSets.get(key)!.add(row.clinicId);
    }
  }

  const result: Record<string, number> = {};
  for (const [key, set] of clinicSets.entries()) {
    result[key] = set.size;
  }
  return result;
}

/** Menor preço credenciado por especialidade e por procedimento — usado pro
 * selo "a partir de R$X" na home. Antes a home so tinha a contagem de clínicas
 * aqui em cima e nenhum preço de verdade era buscado, apesar do card prometer
 * "valores transparentes". price = 0 significa "clínica ainda não cadastrou
 * o valor" (convenção já usada em outras partes do sistema), não "grátis" —
 * essas linhas são ignoradas aqui pra não mostrar "a partir de R$0,00". */
export async function getSpecialtyStartingPrices() {
  const rows = await prisma.clinicProcedure.findMany({
    where: { clinic: { active: true, listedInMarketplace: true }, price: { gt: 0 } },
    select: {
      price: true,
      procedure: { select: { name: true, specialty: { select: { name: true } } } },
    },
  });

  const result: Record<string, number> = {};
  for (const row of rows) {
    const price = Number(row.price);
    const keys = [row.procedure.name, row.procedure.specialty?.name].filter(
      (key): key is string => Boolean(key)
    );
    for (const key of keys) {
      if (result[key] === undefined || price < result[key]) {
        result[key] = price;
      }
    }
  }
  return result;
}

export async function getFeaturedClinics(limit = 12) {
  return prisma.clinic.findMany({
    where: { active: true, listedInMarketplace: true },
    orderBy: { rating: "desc" },
    take: limit,
    select: {
      id: true,
      tradeName: true,
      neighborhood: true,
      city: true,
      address: true,
      phone: true,
      rating: true,
      reviewCount: true,
      clinicProcedures: {
        take: 6,
        orderBy: { procedure: { name: "asc" } },
        select: { price: true, procedure: { select: { name: true, category: true } } },
      },
    },
  });
}

export async function getAllClinics(city?: string, neighborhood?: string) {
  return prisma.clinic.findMany({
    where: {
      active: true,
      listedInMarketplace: true,
      ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
      ...(neighborhood ? { neighborhood: { contains: neighborhood, mode: "insensitive" } } : {}),
    },
    orderBy: { rating: "desc" },
    select: {
      id: true,
      tradeName: true,
      neighborhood: true,
      city: true,
      address: true,
      phone: true,
      rating: true,
      reviewCount: true,
      clinicProcedures: {
        take: 6,
        orderBy: { procedure: { name: "asc" } },
        select: { procedure: { select: { name: true, category: true } } },
      },
    },
  });
}
