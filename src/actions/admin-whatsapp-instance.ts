"use server";

import { revalidatePath } from "next/cache";
import type { WhatsappInstanceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import {
  createEvolutionInstance,
  setEvolutionWebhook,
  getEvolutionQrCode,
  getEvolutionConnectionState,
  restartEvolutionInstance,
  logoutEvolutionInstance,
  type EvolutionInstanceConfig,
} from "@/lib/evolution-admin";

function maskApiKey(apiKey: string): string {
  const visible = apiKey.slice(-4);
  return `••••${visible}`;
}

/** Config exclusiva da clínica (ou null se ela ainda usa só a instância global). API Key sempre mascarada. */
export async function getWhatsappInstance(clinicId: string) {
  await requireAdminSession();
  const instance = await prisma.whatsappInstance.findUnique({ where: { clinicId } });
  if (!instance) return null;
  return {
    apiUrl: instance.apiUrl,
    apiKeyMasked: maskApiKey(instance.apiKey),
    instanceName: instance.instanceName,
    status: instance.status,
    lastCheckedAt: instance.lastCheckedAt,
  };
}

/** Salva/atualiza as credenciais, cria a instância na Evolution API e configura o webhook. */
export async function saveWhatsappInstanceConfig(
  clinicId: string,
  input: { apiUrl: string; apiKey: string; instanceName: string }
) {
  await requireAdminSession();

  const apiUrl = input.apiUrl.trim().replace(/\/$/, "");
  const instanceName = input.instanceName.trim();
  const existing = await prisma.whatsappInstance.findUnique({ where: { clinicId } });
  // A API Key nunca volta inteira pro client (só mascarada) — se o campo vier vazio numa
  // edição, mantém a que já estava salva em vez de forçar reenvio dela toda vez.
  const apiKey = input.apiKey.trim() || existing?.apiKey || "";
  if (!apiUrl || !apiKey || !instanceName) {
    throw new Error("Preencha URL, API Key e nome da instância.");
  }

  const config: EvolutionInstanceConfig = { apiUrl, apiKey, instanceName };

  await prisma.whatsappInstance.upsert({
    where: { clinicId },
    update: { apiUrl, apiKey, instanceName, status: "DISCONNECTED" },
    create: { clinicId, apiUrl, apiKey, instanceName, status: "DISCONNECTED" },
  });

  const created = await createEvolutionInstance(config);
  const webhook = await setEvolutionWebhook(config);

  revalidatePath("/admin/clinicas");

  if (!created.success) {
    return { success: false, error: `Falha ao criar instância na Evolution API: ${created.error}` };
  }
  if (!webhook.success) {
    return { success: false, error: `Instância criada, mas falhou ao configurar o webhook: ${webhook.error}` };
  }
  return { success: true };
}

async function getInstanceConfigOrThrow(clinicId: string): Promise<EvolutionInstanceConfig> {
  const instance = await prisma.whatsappInstance.findUnique({ where: { clinicId } });
  if (!instance) throw new Error("Nenhuma instância cadastrada para esta clínica.");
  return { apiUrl: instance.apiUrl, apiKey: instance.apiKey, instanceName: instance.instanceName };
}

/** Gera (ou renova) o QR Code atual pra pareamento no celular. */
export async function getQrCodeForInstance(clinicId: string) {
  await requireAdminSession();
  const config = await getInstanceConfigOrThrow(clinicId);
  await prisma.whatsappInstance.update({ where: { clinicId }, data: { status: "CONNECTING" } });
  const result = await getEvolutionQrCode(config);
  if (!result.success) {
    return { success: false as const, error: result.error };
  }
  return { success: true as const, base64: result.data.base64 ?? null, pairingCode: result.data.pairingCode ?? null };
}

/** Consulta o estado real da conexão na Evolution API e sincroniza o status salvo. */
export async function testConnection(clinicId: string) {
  await requireAdminSession();
  const config = await getInstanceConfigOrThrow(clinicId);
  const result = await getEvolutionConnectionState(config);
  if (!result.success) {
    return { success: false as const, error: result.error };
  }
  const state = result.data.instance?.state;
  const status: WhatsappInstanceStatus =
    state === "open" ? "CONNECTED" : state === "connecting" ? "CONNECTING" : "DISCONNECTED";
  await prisma.whatsappInstance.update({
    where: { clinicId },
    data: { status, lastCheckedAt: new Date() },
  });
  revalidatePath("/admin/clinicas");
  return { success: true as const, status };
}

export async function restartInstance(clinicId: string) {
  await requireAdminSession();
  const config = await getInstanceConfigOrThrow(clinicId);
  const result = await restartEvolutionInstance(config);
  if (!result.success) {
    return { success: false as const, error: result.error };
  }
  await prisma.whatsappInstance.update({ where: { clinicId }, data: { status: "CONNECTING" } });
  revalidatePath("/admin/clinicas");
  return { success: true as const };
}

export async function disconnectInstance(clinicId: string) {
  await requireAdminSession();
  const config = await getInstanceConfigOrThrow(clinicId);
  const result = await logoutEvolutionInstance(config);
  if (!result.success) {
    return { success: false as const, error: result.error };
  }
  await prisma.whatsappInstance.update({ where: { clinicId }, data: { status: "DISCONNECTED" } });
  revalidatePath("/admin/clinicas");
  return { success: true as const };
}
