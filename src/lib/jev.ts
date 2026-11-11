/** Jev (TypeSafe AI — docs.typesafe.ai): modelo que devolve decisões tipadas com
 * confiança, em vez de texto. Usado nas classificações que não conversam com o
 * paciente; o que gera texto continua na OpenAI. Chave em JEVAI_API_KEY (só servidor). */

import { errorSummary } from "@/lib/safe-error";
import type { AppointmentReplyAction } from "./appointment-reply-ai";
import { aiJev, type AiCallContext } from "./ai-gateway";

/** Contexto opcional para a barreira LGPD (clínica, nomes conhecidos do paciente). */
export type JevPrivacy = Omit<AiCallContext, "feature">;

/** Abaixo disso a ação NÃO é executada (vira UNCLEAR → recepção). A resposta ao
 * lembrete confirma/cancela consulta de verdade, então o corte é alto. Testado com
 * frases reais: claras ~0,95–1,0; ambíguas ("ok", "meu marido vai no meu lugar") ~0,5. */
export const JEV_MIN_CONFIDENCE = 0.85;

const ACTIONS: AppointmentReplyAction[] = ["CONFIRMED", "CANCELLED", "RESCHEDULE", "UNCLEAR"];

export type JevChoiceAnswer = { type: string; choice?: string; confidence?: number };

export function actionFromJevAnswer(answer: JevChoiceAnswer | undefined): AppointmentReplyAction | null {
  if (!answer || answer.type !== "choice" || !ACTIONS.includes(answer.choice as AppointmentReplyAction)) return null;
  if ((answer.confidence ?? 0) < JEV_MIN_CONFIDENCE) return "UNCLEAR";
  return answer.choice as AppointmentReplyAction;
}

const REPLY_QUESTION = {
  type: "choice",
  instructions:
    "A clínica mandou pelo WhatsApp um lembrete pedindo para o paciente confirmar a consulta marcada (`lembrete`). Qual é a intenção do paciente na `resposta`?",
  criteria: {
    CONFIRMED: "Vai comparecer no horário marcado (inclusive confirmando junto com uma pergunta ou um pequeno atraso).",
    CANCELLED: "Não vai comparecer e quer cancelar, sem pedir outra data.",
    RESCHEDULE: "Quer mudar a data ou o horário da consulta.",
    UNCLEAR: "Não dá para saber, é dúvida sobre outro assunto ou não tem relação com a confirmação.",
  },
};

/** Classifica a resposta ao lembrete. `null` = Jev indisponível (sem chave, erro,
 * timeout) — o chamador usa o fallback. Nunca lança. */
export async function classifyReplyWithJev(
  resposta: string,
  lembrete?: string | null,
  privacy: JevPrivacy = {},
): Promise<AppointmentReplyAction | null> {
  try {
    const json = await aiJev(
      { feature: "lembrete", ...privacy },
      {
        model: "jev-latest",
        state: { lembrete: lembrete ?? "Lembrete de consulta pedindo confirmação.", resposta },
        questions: { acao: REPLY_QUESTION },
      },
    );
    if (!json) return null;
    return actionFromJevAnswer(json.answers?.acao);
  } catch (error) {
    console.error("Falha ao classificar resposta via Jev:", errorSummary(error));
    return null;
  }
}

/** Pergunta de escolha genérica ao Jev. `undefined` = indisponível (sem chave, erro,
 * timeout). Nunca lança. */
export async function askJevChoice(
  state: unknown,
  question: object,
  privacy: JevPrivacy & { feature?: AiCallContext["feature"] } = {},
): Promise<JevChoiceAnswer | undefined> {
  try {
    const json = await aiJev(
      { feature: "intencao", ...privacy },
      { model: "jev-latest", state, questions: { q: question } },
    );
    return json?.answers?.q;
  } catch (error) {
    console.error("Falha ao consultar o Jev:", errorSummary(error));
    return undefined;
  }
}
