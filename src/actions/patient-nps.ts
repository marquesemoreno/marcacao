"use server";

import { prisma } from "@/lib/prisma";
import { resolvePatientToken, consumePatientToken } from "@/lib/patient-token-server";
import { parseNpsScore } from "@/lib/nps";
import { encryptFormAnswers } from "@/lib/patient-form-server";

/** Pesquisa de satisfação pelo link do passo "Satisfação" da régua (/p/[token], sem login).
 * O token é a credencial; uma resposta por link. */
export async function loadNpsSurvey(raw: string) {
  const { state, token } = await resolvePatientToken(raw, "NPS");
  if (!token || state === "NOT_FOUND") return { state: "NOT_FOUND" as const };
  if (state === "USED") return { state: "ANSWERED" as const };
  if (state !== "VALID") return { state };
  const clinic = await prisma.clinic.findUnique({ where: { id: token.clinicId }, select: { tradeName: true, name: true } });
  return { state: "VALID" as const, clinicName: clinic?.tradeName || clinic?.name || "a clínica" };
}

export async function submitNps(raw: string, score: unknown, comment: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const n = parseNpsScore(score);
  if (n === null) return { ok: false, error: "Escolha uma nota de 0 a 10." };
  const { state, token } = await resolvePatientToken(raw, "NPS");
  if (!token) return { ok: false, error: "Link não encontrado." };
  if (state === "USED") return { ok: true }; // toque duplo
  if (state !== "VALID" || !(await consumePatientToken(token.id))) return { ok: false, error: "Este link não vale mais." };
  const text = comment.trim().slice(0, 1000);
  await prisma.npsResponse.create({
    data: {
      clinicId: token.clinicId,
      tokenId: token.id,
      phone: token.phone,
      score: n,
      commentEncrypted: text ? encryptFormAnswers({ comment: text }) : null,
    },
  });
  return { ok: true };
}
