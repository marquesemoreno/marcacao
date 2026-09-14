import "server-only";
import { prisma } from "@/lib/prisma";

const CATEGORY_LABELS: Record<string, string> = {
  CORPO_CLINICO: "Corpo clínico",
  HORARIO_ATENDIMENTO: "Horário de atendimento",
  CONVENIOS: "Convênios aceitos",
  VALORES: "Valores particulares",
  REGRAS_RETORNO: "Regras de retorno",
  PREPARO_EXAME: "Preparo de exames",
  OUTRO: "Outras informações",
};

/** Monta o bloco de contexto pro prompt da IA (atendente autônomo e Copilot) a
 * partir da base de conhecimento cadastrada pela clínica (ver
 * ClinicKnowledgeEntry, admin/clinicas → "Base de Conhecimento"). Escala
 * pequena de propósito — cabe inteira no prompt, sem precisar de busca
 * vetorial/RAG de verdade (ver nota no schema.prisma).
 *
 * String vazia quando a clínica não cadastrou nada ainda — quem monta o
 * prompt final decide se omite a seção inteira nesse caso. */
export async function buildClinicKnowledgeContext(clinicId: string): Promise<string> {
  const entries = await prisma.clinicKnowledgeEntry.findMany({
    where: { clinicId, active: true },
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });
  if (entries.length === 0) return "";

  const byCategory = new Map<string, typeof entries>();
  for (const entry of entries) {
    const list = byCategory.get(entry.category) ?? [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }

  const sections = Array.from(byCategory.entries()).map(([category, items]) => {
    const label = CATEGORY_LABELS[category] ?? category;
    const lines = items.map((item) => `- ${item.title}: ${item.content}`);
    return `${label}:\n${lines.join("\n")}`;
  });

  return sections.join("\n\n");
}
