/**
 * Classifica a intenção (Jev) das conversas abertas cuja última mensagem é do paciente
 * (as que estão esperando resposta) — os selos da fila só aparecem pra mensagens novas
 * depois do deploy; isto preenche as que já estavam na fila. Só grava patientIntent*.
 *
 *   npx tsx --env-file=.env scripts/backfill-patient-intent.ts            (só conta)
 *   npx tsx --env-file=.env scripts/backfill-patient-intent.ts --apply    (grava)
 */
import { PrismaClient } from "@prisma/client";
import { askJevChoice } from "../src/lib/jev";
import { intentFromJevAnswer, visibleIntent, PATIENT_INTENT_QUESTION, PATIENT_INTENTS } from "../src/lib/patient-intent";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

async function main() {
  const convs = await prisma.conversation.findMany({
    where: { status: { not: "RESOLVED" }, patientIntentAt: null },
    select: { id: true, messages: { where: { type: { not: "INTERNAL_NOTE" } }, orderBy: { createdAt: "desc" }, take: 1, select: { direction: true } } },
  });
  const waiting = convs.filter((c) => c.messages[0]?.direction === "INBOUND");
  const counts: Record<string, number> = {};
  let classified = 0, shown = 0;
  for (const c of waiting) {
    const recent = await prisma.message.findMany({
      where: { conversationId: c.id, direction: "INBOUND", type: "TEXT", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { content: true },
    });
    if (recent.length === 0) continue;
    const result = intentFromJevAnswer(await askJevChoice({ mensagens: recent.reverse().map((m) => m.content.slice(0, 500)) }, PATIENT_INTENT_QUESTION));
    if (!result) continue;
    classified++;
    const v = visibleIntent(result.intent, result.confidence);
    if (v) { shown++; counts[PATIENT_INTENTS[v]] = (counts[PATIENT_INTENTS[v]] ?? 0) + 1; }
    if (APPLY) {
      await prisma.conversation.update({
        where: { id: c.id },
        data: { patientIntent: result.intent, patientIntentConfidence: result.confidence, patientIntentAt: new Date() },
      });
    }
  }
  console.log(APPLY ? "GRAVADO" : "SIMULAÇÃO", { abertasEsperando: waiting.length, classificadas: classified, comSelo: shown, porIntencao: counts });
}
main().finally(() => prisma.$disconnect());
