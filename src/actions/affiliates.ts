"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { AFFILIATE_SESSION_COOKIE, AFFILIATE_SESSION_MAX_AGE, maskPatientName } from "@/lib/affiliate";
import {
  registerAffiliateSchema,
  loginAffiliateSchema,
  type RegisterAffiliateInput,
  type LoginAffiliateInput,
} from "@/lib/schemas/affiliate";

function generateAffiliateCode() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `MARC-${digits}`;
}

async function generateUniqueAffiliateCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateAffiliateCode();
    const existing = await prisma.affiliate.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("Não foi possível gerar um código de marcador único. Tente novamente.");
}

/** Cadastro público em /afiliados — sem autenticação, mesmo padrão do PartnerLead. */
export async function registerAffiliate(input: RegisterAffiliateInput) {
  const data = registerAffiliateSchema.parse(input);
  const code = await generateUniqueAffiliateCode();

  const affiliate = await prisma.affiliate.create({
    data: { ...data, code },
  });

  // Retorno enxuto e serializável: o registro do Prisma tem `totalEarned`
  // como Decimal, que não cruza a fronteira Server->Client (mesma razão de
  // toPlainAppointment em src/lib/serialize.ts) — e o form nem usa o resto.
  return { id: affiliate.id, code: affiliate.code };
}

/** "Login simples" do painel do marcador: WhatsApp + código, sem senha. */
export async function loginAffiliateAction(input: LoginAffiliateInput) {
  const data = loginAffiliateSchema.parse(input);

  const affiliate = await prisma.affiliate.findFirst({
    where: { phone: data.phone, code: data.code },
  });

  if (!affiliate) {
    throw new Error("WhatsApp ou código de marcador inválido.");
  }

  const cookieStore = await cookies();
  cookieStore.set(AFFILIATE_SESSION_COOKIE, affiliate.id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: AFFILIATE_SESSION_MAX_AGE,
    path: "/",
  });

  return { id: affiliate.id };
}

export async function logoutAffiliateAction() {
  const cookieStore = await cookies();
  cookieStore.delete(AFFILIATE_SESSION_COOKIE);
}

export async function getAffiliateSession() {
  const cookieStore = await cookies();
  const affiliateId = cookieStore.get(AFFILIATE_SESSION_COOKIE)?.value;
  if (!affiliateId) return null;
  return prisma.affiliate.findUnique({ where: { id: affiliateId } });
}

/** Métricas + histórico (nomes mascarados) exibidos no painel do marcador. */
export async function getAffiliateDashboard(affiliateId: string) {
  const affiliate = await prisma.affiliate.findUniqueOrThrow({ where: { id: affiliateId } });

  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const appointments = await prisma.appointment.findMany({
    where: { affiliateId },
    orderBy: { createdAt: "desc" },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });

  const referralsThisMonth = appointments.filter(
    (appointment) => appointment.createdAt >= startOfMonth
  ).length;
  const confirmedCount = appointments.filter(
    (appointment) => appointment.status === "CONFIRMED" || appointment.status === "COMPLETED"
  ).length;

  const history = appointments.slice(0, 20).map((appointment) => ({
    id: appointment.id,
    patientName: maskPatientName(appointment.patientName),
    procedureName: appointment.clinicProcedure.procedure.name,
    clinicName: appointment.clinicProcedure.clinic.tradeName,
    status: appointment.status,
    date: appointment.date.toISOString(),
    commission: appointment.affiliateCommission ? Number(appointment.affiliateCommission) : 0,
  }));

  return {
    affiliate: {
      id: affiliate.id,
      name: affiliate.name,
      code: affiliate.code,
      city: affiliate.city,
      status: affiliate.status,
      totalEarned: Number(affiliate.totalEarned),
    },
    referralsThisMonth,
    confirmedCount,
    history,
  };
}

/** Painel de gestão do admin — lista todos os marcadores com receita gerada e chave PIX. */
export async function getAffiliates() {
  await requireAdminSession();
  return prisma.affiliate.findMany({ orderBy: { totalEarned: "desc" } });
}
