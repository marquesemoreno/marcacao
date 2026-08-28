"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";

function maskApiToken(apiToken: string): string {
  const visible = apiToken.slice(-4);
  return `••••${visible}`;
}

/** Config da integração hospitalar da clínica (ou null se ainda não configurada). Token sempre mascarado. */
export async function getHospitalIntegration(clinicId: string) {
  await requireAdminSession();
  const integration = await prisma.hospitalIntegration.findUnique({ where: { clinicId } });
  if (!integration) return null;
  return {
    apiUrl: integration.apiUrl,
    apiTokenMasked: maskApiToken(integration.apiToken),
    active: integration.active,
    lastCheckedAt: integration.lastCheckedAt,
    lastCheckOk: integration.lastCheckOk,
  };
}

/** Salva/atualiza as credenciais da integração hospitalar dessa clínica. */
export async function saveHospitalIntegrationConfig(clinicId: string, input: { apiUrl: string; apiToken: string }) {
  await requireAdminSession();

  const apiUrl = input.apiUrl.trim().replace(/\/$/, "");
  const existing = await prisma.hospitalIntegration.findUnique({ where: { clinicId } });
  // O token nunca volta inteiro pro client (só mascarado) — se o campo vier vazio numa
  // edição, mantém o que já estava salvo em vez de forçar reenvio dele toda vez.
  const apiToken = input.apiToken.trim() || existing?.apiToken || "";
  if (!apiUrl || !apiToken) {
    throw new Error("Preencha a URL e o token da integração.");
  }

  await prisma.hospitalIntegration.upsert({
    where: { clinicId },
    update: { apiUrl, apiToken },
    create: { clinicId, apiUrl, apiToken },
  });

  revalidatePath("/admin/clinicas");
  return { success: true as const };
}

/** Liga/desliga a integração sem apagar as credenciais salvas (ex: bridge fora do ar). */
export async function toggleHospitalIntegrationActive(clinicId: string, active: boolean) {
  await requireAdminSession();
  await prisma.hospitalIntegration.update({ where: { clinicId }, data: { active } });
  revalidatePath("/admin/clinicas");
  return { success: true as const };
}

/** Testa a conexão batendo no endpoint de procedimentos do bridge (não existe healthcheck dedicado). */
export async function testHospitalIntegrationConnection(clinicId: string) {
  await requireAdminSession();
  const integration = await prisma.hospitalIntegration.findUnique({ where: { clinicId } });
  if (!integration) throw new Error("Nenhuma integração cadastrada para esta clínica.");

  // Testa direto contra a URL/token salvos, sem depender de `active` — o admin pode
  // querer testar antes de reativar uma integração que estava desligada.
  const ok = await fetch(`${integration.apiUrl.replace(/\/$/, "")}/api/procedimentos`, {
    headers: { "x-api-token": integration.apiToken },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  })
    .then((res) => res.ok)
    .catch(() => false);

  await prisma.hospitalIntegration.update({
    where: { clinicId },
    data: { lastCheckedAt: new Date(), lastCheckOk: ok },
  });

  revalidatePath("/admin/clinicas");
  return { success: ok as boolean };
}
