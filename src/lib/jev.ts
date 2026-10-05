/** Jev (TypeSafe AI — docs.typesafe.ai): modelo que devolve decisões tipadas com
 * confiança, em vez de texto. Usado nas classificações que não conversam com o
 * paciente; o que gera texto continua na OpenAI. Chave em JEVAI_API_KEY (só servidor). */

import type { AppointmentReplyAction } from "./appointment-reply-ai";

const JEV_URL = "https://api.typesafe.ai/v1/systemone";

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
export async function classifyReplyWithJev(resposta: string, lembrete?: string | null): Promise<AppointmentReplyAction | null> {
  const apiKey = process.env.JEVAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(JEV_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "jev-latest",
        state: { lembrete: lembrete ?? "Lembrete de consulta pedindo confirmação.", resposta },
        questions: { acao: REPLY_QUESTION },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error("Jev respondeu", res.status);
      return null;
    }
    const json = (await res.json()) as { answers?: Record<string, JevChoiceAnswer> };
    return actionFromJevAnswer(json.answers?.acao);
  } catch (error) {
    console.error("Falha ao classificar resposta via Jev:", error);
    return null;
  }
}
