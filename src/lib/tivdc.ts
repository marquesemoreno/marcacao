import "server-only";
import { prisma } from "@/lib/prisma";

/** Id da clínica/tenant interno da própria TIVDC (empresa de suporte de TI, não
 * uma clínica médica — mora na mesma tabela Clinic por reaproveitar a
 * infraestrutura multi-tenant já existente). Usado pra travar features
 * específicas da TIVDC (outreach de leads, chamado no GLPI) a esse tenant só,
 * nunca às clínicas médicas de verdade. */
export async function getTivdcClinicId(): Promise<string | null> {
  const clinic = await prisma.clinic.findFirst({ where: { tradeName: "TIVDC" }, select: { id: true } });
  return clinic?.id ?? null;
}
