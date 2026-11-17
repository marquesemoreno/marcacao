"use server";

import type { WhatsappInstanceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/token-crypto";
import { requireClinicManager } from "@/lib/session";
import {
  getEvolutionConnectionState,
  getEvolutionQrCode,
  restartEvolutionInstance,
  type EvolutionInstanceConfig,
} from "@/lib/evolution-admin";

/** Conexão por QR (Evolution, API não oficial) vista pela gestão da própria clínica, na tela
 * Configurações › WhatsApp, ao lado da API oficial (16/11/2026). Só status, QR e reiniciar:
 * URL, chave e nome da instância continuam só no /admin. */

async function clinicInstance(): Promise<{ clinicId: string; config: EvolutionInstanceConfig } | null> {
  const { clinicId } = await requireClinicManager();
  const i = await prisma.whatsappInstance.findUnique({ where: { clinicId } });
  if (!i) return null;
  return { clinicId, config: { apiUrl: i.apiUrl, apiKey: decryptToken(i.apiKey), instanceName: i.instanceName } };
}

function toStatus(state: string | undefined): WhatsappInstanceStatus {
  return state === "open" ? "CONNECTED" : state === "connecting" ? "CONNECTING" : "DISCONNECTED";
}

/** Estado real na Evolution (e sincroniza o salvo). `configured: false` = clínica sem
 * instância própria — conexão gerenciada pelo suporte. */
export async function getClinicQrStatus(): Promise<
  { configured: false } | { configured: true; status: WhatsappInstanceStatus; error?: string }
> {
  const inst = await clinicInstance();
  if (!inst) return { configured: false };
  const result = await getEvolutionConnectionState(inst.config);
  if (!result.success) {
    const saved = await prisma.whatsappInstance.findUnique({ where: { clinicId: inst.clinicId }, select: { status: true } });
    return { configured: true, status: saved?.status ?? "DISCONNECTED", error: "Não foi possível consultar a conexão agora." };
  }
  const status = toStatus(result.data.instance?.state);
  await prisma.whatsappInstance.update({ where: { clinicId: inst.clinicId }, data: { status, lastCheckedAt: new Date() } });
  return { configured: true, status };
}

export async function getClinicQrCode(): Promise<{ success: true; base64: string } | { success: false; error: string }> {
  const inst = await clinicInstance();
  if (!inst) return { success: false, error: "Esta clínica não tem conexão por QR própria. Fale com o suporte." };
  const result = await getEvolutionQrCode(inst.config);
  if (!result.success) return { success: false, error: "Não foi possível gerar o QR agora. Tente reiniciar a conexão." };
  if (!result.data.base64) return { success: false, error: "O número parece já estar conectado, ou o QR não veio. Tente reiniciar a conexão." };
  await prisma.whatsappInstance.update({ where: { clinicId: inst.clinicId }, data: { status: "CONNECTING" } });
  return { success: true, base64: result.data.base64 };
}

export async function restartClinicQrConnection(): Promise<{ success: boolean; error?: string }> {
  const inst = await clinicInstance();
  if (!inst) return { success: false, error: "Esta clínica não tem conexão por QR própria. Fale com o suporte." };
  const result = await restartEvolutionInstance(inst.config);
  if (!result.success) return { success: false, error: "Não foi possível reiniciar a conexão agora." };
  await prisma.whatsappInstance.update({ where: { clinicId: inst.clinicId }, data: { status: "CONNECTING" } });
  return { success: true };
}
