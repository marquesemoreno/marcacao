"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { updateClinicSchema, createClinicSchema } from "@/lib/schemas/admin";

export async function listClinics() {
  await requireAdminSession();
  return prisma.clinic.findMany({ orderBy: { tradeName: "asc" } });
}

export async function updateClinic(clinicId: string, formData: FormData) {
  await requireAdminSession();
  const data = updateClinicSchema.parse({
    commissionRate: formData.get("commissionRate"),
    active: formData.get("active"),
  });
  await prisma.clinic.update({ where: { id: clinicId }, data });
  revalidatePath("/admin/clinicas");
}

export async function createClinic(formData: FormData) {
  await requireAdminSession();
  const data = createClinicSchema.parse({
    name: formData.get("name"),
    tradeName: formData.get("tradeName"),
    cnpj: formData.get("cnpj"),
    phone: formData.get("phone"),
    whatsapp: formData.get("whatsapp"),
    address: formData.get("address"),
    neighborhood: formData.get("neighborhood"),
    city: formData.get("city"),
    commissionRate: formData.get("commissionRate"),
  });
  await prisma.clinic.create({ data });
  revalidatePath("/admin/clinicas");
}

export async function updateUserMaxConcurrentChats(userId: string, maxConcurrentChats: number) {
  await requireAdminSession();
  const limit = Math.max(1, Math.min(50, Number(maxConcurrentChats) || 5));
  await prisma.user.update({
    where: { id: userId },
    data: { maxConcurrentChats: limit },
  });
  revalidatePath("/admin/clinicas");
  revalidatePath("/admin/inbox");
  revalidatePath("/clinic/inbox");
}

export async function getFinancialReport() {
  await requireAdminSession();

  const clinics = await prisma.clinic.findMany({ orderBy: { tradeName: "asc" } });
  const appointments = await prisma.appointment.findMany({
    include: {
      clinicProcedure: { select: { clinicId: true, price: true, promotionalPrice: true } },
    },
  });

  return clinics.map((clinic) => {
    const clinicAppointments = appointments.filter(
      (appointment) => appointment.clinicProcedure.clinicId === clinic.id
    );
    const completed = clinicAppointments.filter((appointment) => appointment.status === "COMPLETED");
    const revenue = completed.reduce(
      (sum, appointment) =>
        sum + Number(appointment.clinicProcedure.promotionalPrice ?? appointment.clinicProcedure.price),
      0
    );
    const commission = revenue * (Number(clinic.commissionRate) / 100);

    return {
      id: clinic.id,
      tradeName: clinic.tradeName,
      active: clinic.active,
      totalAppointments: clinicAppointments.length,
      completedCount: completed.length,
      revenue,
      commission,
      commissionRate: Number(clinic.commissionRate),
    };
  });
}

export async function getKpis() {
  await requireAdminSession();

  const [totalOrders, convertedOrders, totalAffiliates, topProceduresRaw] = await Promise.all([
    prisma.appointment.count(),
    prisma.appointment.count({ where: { status: { in: ["CONFIRMED", "COMPLETED"] } } }),
    prisma.affiliate.count(),
    prisma.appointment.groupBy({
      by: ["clinicProcedureId"],
      _count: { clinicProcedureId: true },
      orderBy: { _count: { clinicProcedureId: "desc" } },
      take: 5,
    }),
  ]);

  const clinicProcedures = await prisma.clinicProcedure.findMany({
    where: { id: { in: topProceduresRaw.map((item) => item.clinicProcedureId) } },
    include: { procedure: { include: { specialty: true } } },
  });

  const topProcedures = topProceduresRaw.map((item) => {
    const clinicProcedure = clinicProcedures.find((cp) => cp.id === item.clinicProcedureId);
    return {
      name: clinicProcedure?.procedure.name ?? "—",
      specialty: clinicProcedure?.procedure.specialty?.name ?? "Geral",
      count: item._count.clinicProcedureId,
    };
  });

  const conversionRate = totalOrders > 0 ? (convertedOrders / totalOrders) * 100 : 0;

  return { totalOrders, conversionRate, totalAffiliates, topProcedures };
}
