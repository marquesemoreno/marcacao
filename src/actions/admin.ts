"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { updateClinicSchema, createClinicSchema } from "@/lib/schemas/admin";

export async function listClinics() {
  await requireAdminSession();
  const clinics = await prisma.clinic.findMany({
    orderBy: { tradeName: "asc" },
    include: {
      _count: {
        select: {
          clinicProcedures: true,
          users: true,
        },
      },
    },
  });

  return clinics.map((c) => ({
    ...c,
    commissionRate: Number(c.commissionRate),
  }));
}

export async function updateClinicCommission(clinicId: string, commissionRate: number) {
  await requireAdminSession();
  const rate = Math.max(0, Math.min(100, Number(commissionRate) || 0));
  await prisma.clinic.update({
    where: { id: clinicId },
    data: { commissionRate: rate },
  });
  revalidatePath("/admin/clinicas");
  return { success: true, message: `Taxa de comissão atualizada para ${rate}%` };
}

export async function toggleClinicActive(clinicId: string, active: boolean) {
  await requireAdminSession();
  await prisma.clinic.update({
    where: { id: clinicId },
    data: { active },
  });
  revalidatePath("/admin/clinicas");
  return { success: true };
}

export async function getClinicProceduresAdmin(clinicId: string) {
  await requireAdminSession();
  const procedures = await prisma.clinicProcedure.findMany({
    where: { clinicId },
    include: {
      procedure: {
        include: { specialty: true },
      },
    },
    orderBy: { procedure: { name: "asc" } },
  });

  return procedures.map((p) => ({
    ...p,
    price: Number(p.price),
    promotionalPrice: p.promotionalPrice ? Number(p.promotionalPrice) : null,
  }));
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

export async function createTeamMember(formData: FormData) {
  await requireAdminSession();

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const clinicId = String(formData.get("clinicId") || "");
  const maxConcurrentChats = Number(formData.get("maxConcurrentChats")) || 5;

  if (!name || !email || !password || !clinicId) {
    throw new Error("Preencha todos os campos obrigatórios.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("Já existe um usuário cadastrado com este e-mail.");
  }

  const bcrypt = (await import("bcryptjs")).default;
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "CLINIC",
      clinicId,
      maxConcurrentChats: Math.max(1, Math.min(50, maxConcurrentChats)),
    },
  });

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "CLINIC",
      clinicId,
      maxConcurrentChats: Math.max(1, Math.min(50, maxConcurrentChats)),
    },
  });

  revalidatePath("/admin/clinicas");
  revalidatePath("/admin/inbox");
}

export async function getAttendantPerformanceReport() {
  await requireAdminSession();

  const attendants = await prisma.user.findMany({
    where: { role: { in: ["CLINIC", "ADMIN"] } },
    select: {
      id: true,
      name: true,
      email: true,
      maxConcurrentChats: true,
      clinic: { select: { tradeName: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  const conversations = await prisma.conversation.findMany({
    where: { assignedUserId: { not: null } },
    select: {
      id: true,
      assignedUserId: true,
      status: true,
      resolutionReason: true,
      createdAt: true,
      resolvedAt: true,
    },
  });

  const attendantStats = attendants
    .map((attendant) => {
      const userConvs = conversations.filter((c) => c.assignedUserId === attendant.id);
      const assignedCount = userConvs.length;
      const openCount = userConvs.filter((c) => c.status === "OPEN").length;
      const resolvedConvs = userConvs.filter((c) => c.status === "RESOLVED");
      const resolvedCount = resolvedConvs.length;

      const reasonsCount = {
        AGENDAMENTO_CONCLUIDO: resolvedConvs.filter((c) => c.resolutionReason === "AGENDAMENTO_CONCLUIDO").length,
        DUVIDA_ESCLARECIDA: resolvedConvs.filter((c) => c.resolutionReason === "DUVIDA_ESCLARECIDA").length,
        ORCAMENTO_ENVIADO: resolvedConvs.filter((c) => c.resolutionReason === "ORCAMENTO_ENVIADO").length,
        SEM_RESPOSTA: resolvedConvs.filter((c) => c.resolutionReason === "SEM_RESPOSTA").length,
        CANCELAMENTO: resolvedConvs.filter((c) => c.resolutionReason === "CANCELAMENTO").length,
        ENCAMINHADO: resolvedConvs.filter((c) => c.resolutionReason === "ENCAMINHADO").length,
      };

      const conversionRate = resolvedCount > 0 ? (reasonsCount.AGENDAMENTO_CONCLUIDO / resolvedCount) * 100 : 0;

      return {
        id: attendant.id,
        name: attendant.name,
        email: attendant.email,
        clinicName: attendant.clinic?.tradeName || attendant.clinic?.name || "Plataforma",
        maxConcurrentChats: attendant.maxConcurrentChats ?? 5,
        assignedCount,
        openCount,
        resolvedCount,
        reasonsCount,
        conversionRate: Math.round(conversionRate * 10) / 10,
      };
    })
    .sort((a, b) => b.conversionRate - a.conversionRate || b.resolvedCount - a.resolvedCount);

  const totalResolved = conversations.filter((c) => c.status === "RESOLVED").length;
  const totalAgendados = conversations.filter((c) => c.resolutionReason === "AGENDAMENTO_CONCLUIDO").length;
  const totalCancelados = conversations.filter((c) => c.resolutionReason === "CANCELAMENTO").length;
  const globalConversionRate = totalResolved > 0 ? Math.round((totalAgendados / totalResolved) * 1000) / 10 : 0;

  const resolvedWithTimestamps = conversations.filter((c) => c.resolvedAt && c.createdAt);
  const avgMinutes =
    resolvedWithTimestamps.length > 0
      ? Math.round(
          resolvedWithTimestamps.reduce(
            (acc, c) => acc + (c.resolvedAt!.getTime() - c.createdAt.getTime()) / 60000,
            0
          ) / resolvedWithTimestamps.length
        )
      : 4;

  return {
    attendantStats,
    overview: {
      totalAssigned: conversations.length,
      totalResolved,
      totalAgendados,
      totalCancelados,
      globalConversionRate,
      tmrMinutes: avgMinutes,
      topAttendant: attendantStats[0]?.name || "Nenhum",
    },
  };
}
