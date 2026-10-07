"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import {
  exchangeEmbeddedSignupCode,
  getPhoneNumberInfo,
  requestCoexistenceSync,
  sendCloudTemplate,
  subscribeAppToWaba,
} from "@/lib/whatsapp-cloud";

export type CloudAccountRow = {
  clinicId: string;
  clinicName: string;
  account: {
    wabaId: string;
    phoneNumberId: string;
    displayPhoneNumber: string | null;
    coexistence: boolean;
    active: boolean;
    connectedAt: string;
  } | null;
};

/** Clínicas e a conta da API oficial de cada uma (tela /admin/whatsapp). O token nunca sai
 * do servidor. */
export async function listCloudAccounts(): Promise<CloudAccountRow[]> {
  await requireAdminSession();
  const clinics = await prisma.clinic.findMany({
    orderBy: { tradeName: "asc" },
    select: {
      id: true,
      tradeName: true,
      whatsappCloudAccount: {
        select: { wabaId: true, phoneNumberId: true, displayPhoneNumber: true, coexistence: true, active: true, createdAt: true },
      },
    },
  });
  return clinics.map((c) => ({
    clinicId: c.id,
    clinicName: c.tradeName,
    account: c.whatsappCloudAccount
      ? {
          wabaId: c.whatsappCloudAccount.wabaId,
          phoneNumberId: c.whatsappCloudAccount.phoneNumberId,
          displayPhoneNumber: c.whatsappCloudAccount.displayPhoneNumber,
          coexistence: c.whatsappCloudAccount.coexistence,
          active: c.whatsappCloudAccount.active,
          connectedAt: c.whatsappCloudAccount.createdAt.toISOString(),
        }
      : null,
  }));
}

/** Fim do Embedded Signup: troca o código pelo token, assina o webhook na WABA, lê o número
 * e salva a conta (desligada — `active` só liga depois de testado). Em coexistência, pede a
 * sincronização de contatos e histórico (prazo de 24 h da Meta). */
export async function connectWhatsappCloud(input: {
  clinicId: string;
  code: string;
  wabaId: string;
  phoneNumberId: string;
  coexistence: boolean;
}): Promise<{ success: true; displayPhoneNumber: string | null; warnings: string[] } | { success: false; error: string }> {
  await requireAdminSession();
  if (!input.code || !input.wabaId || !input.phoneNumberId) {
    return { success: false, error: "A Meta não devolveu a conta ou o número. Tente conectar de novo." };
  }

  const exchange = await exchangeEmbeddedSignupCode(input.code);
  if (!exchange.success) return { success: false, error: `Falha ao gerar o token: ${exchange.error}` };
  const token = exchange.data.access_token;

  const warnings: string[] = [];
  const sub = await subscribeAppToWaba(input.wabaId, token);
  if (!sub.success) warnings.push(`Webhook não assinado na conta (${sub.error}) — as mensagens não vão chegar até resolver.`);

  const info = await getPhoneNumberInfo(input.phoneNumberId, token);
  const displayPhoneNumber = info.success ? (info.data.display_phone_number ?? null) : null;

  const existingForNumber = await prisma.whatsappCloudAccount.findUnique({ where: { phoneNumberId: input.phoneNumberId } });
  if (existingForNumber && existingForNumber.clinicId !== input.clinicId) {
    return { success: false, error: "Esse número já está conectado a outra clínica." };
  }

  await prisma.whatsappCloudAccount.upsert({
    where: { clinicId: input.clinicId },
    update: { wabaId: input.wabaId, phoneNumberId: input.phoneNumberId, displayPhoneNumber, accessToken: token, coexistence: input.coexistence },
    create: {
      clinicId: input.clinicId,
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      displayPhoneNumber,
      accessToken: token,
      coexistence: input.coexistence,
      active: false,
    },
  });

  if (input.coexistence) {
    for (const type of ["smb_app_state_sync", "history"] as const) {
      const r = await requestCoexistenceSync(input.phoneNumberId, token, type);
      if (!r.success) warnings.push(`Sincronização "${type}" não iniciada (${r.error}).`);
    }
  }

  revalidatePath("/admin/whatsapp");
  return { success: true, displayPhoneNumber, warnings };
}

/** Teste rápido da conexão: manda o modelo "hello_world" (existe em toda conta nova da Meta)
 * pra um número. Não depende da janela de 24 h. */
export async function sendCloudTestMessage(clinicId: string, to: string): Promise<{ success: boolean; error?: string }> {
  await requireAdminSession();
  const account = await prisma.whatsappCloudAccount.findUnique({ where: { clinicId } });
  if (!account) return { success: false, error: "Clínica sem conta da API oficial." };
  const digits = to.replace(/\D/g, "");
  if (digits.length < 12) return { success: false, error: "Informe o número com DDI e DDD (ex: 5577999998888)." };
  const r = await sendCloudTemplate(account.phoneNumberId, account.accessToken, digits, { name: "hello_world", language: "en_US" });
  return r.success ? { success: true } : { success: false, error: r.error };
}

/** Desconecta no nosso lado (apaga a conta e o token). A desconexão na Meta, em coexistência,
 * é feita pela própria clínica no app: Configurações > Conta > Plataforma Business. */
export async function disconnectWhatsappCloud(clinicId: string): Promise<{ success: boolean }> {
  await requireAdminSession();
  await prisma.whatsappCloudAccount.deleteMany({ where: { clinicId } });
  revalidatePath("/admin/whatsapp");
  return { success: true };
}
