import "server-only";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import type { PartnerLead } from "@prisma/client";

const OUTREACH_STATE_ID = "singleton";

let client: OpenAI | null = null;
function getOpenAiClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

/** Rascunho de primeiro contato pro lead de parceria — mesmo tom que um admin
 * mandaria na mão pelo botão "Chamar no WhatsApp" (ver admin/leads/page.tsx),
 * só que personalizado com os dados do cadastro. Sempre com saída fácil
 * ("responda sair") — contato não solicitado precisa disso (mesmo espírito do
 * opt-out já usado em disparo em massa, ver isBroadcastOptOutReply). */
async function generateOutreachMessage(lead: PartnerLead): Promise<string | null> {
  const openai = getOpenAiClient();
  if (!openai) return null;

  const prompt = `Escreva uma mensagem curta de WhatsApp (3-5 frases) pra um primeiro contato comercial com uma clínica/profissional interessado em virar parceiro credenciado da Conecta Saúde (marketplace de agendamento de consultas e exames).

Dados do lead:
- Clínica/consultório: ${lead.clinicName}
${lead.contactName ? `- Contato: ${lead.contactName}` : "- Contato: não informado, não é uma pessoa específica ainda — trate como \"vocês\"/\"a clínica\", não invente um nome."}
- Bairro/região: ${lead.neighborhood}
- Especialidades/exames: ${lead.specialties}
${lead.notes ? `- Observações: ${lead.notes}` : ""}

Regras:
- Tom cordial, direto, sem parecer robô nem "copiar e colar" genérico — mencione a especialidade ou região dele de forma natural.
- Explique em 1 frase o que é a Conecta Saúde (marketplace que traz pacientes via WhatsApp, sem mensalidade).
- Termine perguntando se pode conversar melhor.
- Última linha, sempre: "Se preferir não receber mais contato, é só responder *sair*."
- Não invente número, preço ou prazo. Não use markdown além de *negrito* pontual (formatação nativa do WhatsApp).`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("Falha ao gerar mensagem de outreach:", error);
    return null;
  }
}

async function getTivdcClinicId(): Promise<string | null> {
  const clinic = await prisma.clinic.findFirst({ where: { tradeName: "TIVDC" }, select: { id: true } });
  return clinic?.id ?? null;
}

/** Próximo intervalo até o disparo seguinte — "por volta de 5 minutos", nunca
 * cravado (não quer parecer robótico/detectável como automação em massa). */
function nextJitteredDelayMs(): number {
  const minutes = 4 + Math.random() * 2; // 4–6 min
  return Math.round(minutes * 60 * 1000);
}

export type OutreachTickResult =
  | { sent: false; reason: "disabled" | "not_due" | "no_leads" | "ai_unavailable" | "clinic_not_found" | "send_failed" }
  | { sent: true; leadId: string };

/** Chamado 1x por minuto pelo Vercel Cron (ver /api/cron/lead-outreach). Manda no
 * MÁXIMO 1 mensagem por chamada — o espaçamento de verdade vem do `nextRunAt`
 * (ver nextJitteredDelayMs), não da frequência do cron em si. */
export async function runLeadOutreachTick(): Promise<OutreachTickResult> {
  const state = await prisma.aiOutreachState.upsert({
    where: { id: OUTREACH_STATE_ID },
    update: {},
    create: { id: OUTREACH_STATE_ID },
  });

  if (!state.enabled) return { sent: false, reason: "disabled" };
  if (state.nextRunAt.getTime() > Date.now()) return { sent: false, reason: "not_due" };

  const lead = await prisma.partnerLead.findFirst({
    where: { status: "NEW" },
    orderBy: { createdAt: "asc" },
  });
  if (!lead) return { sent: false, reason: "no_leads" };

  const clinicId = await getTivdcClinicId();
  if (!clinicId) return { sent: false, reason: "clinic_not_found" };

  const message = await generateOutreachMessage(lead);
  if (!message) return { sent: false, reason: "ai_unavailable" };

  const result = await sendWhatsAppMessage(lead.phone, message, "ai_outreach.sent", clinicId);
  if (!result.success) return { sent: false, reason: "send_failed" };

  const sentNote = `[Contato automático via IA, ${new Date().toLocaleString("pt-BR", { timeZone: "America/Bahia" })}]:\n${message}`;
  await prisma.$transaction([
    prisma.partnerLead.update({
      where: { id: lead.id },
      data: {
        status: "CONTACTED",
        notes: lead.notes ? `${lead.notes}\n\n${sentNote}` : sentNote,
      },
    }),
    prisma.aiOutreachState.update({
      where: { id: OUTREACH_STATE_ID },
      data: { nextRunAt: new Date(Date.now() + nextJitteredDelayMs()) },
    }),
  ]);

  return { sent: true, leadId: lead.id };
}

export type GenerateOutreachDraftResult =
  | { success: true; message: string }
  | { success: false; reason: "lead_not_found" | "ai_unavailable" };

/** Só gera o texto (ver botão "Enviar agora" em admin/leads) — separado do envio pra
 * o admin poder ler/editar antes de mandar de verdade pelo WhatsApp. */
export async function generateOutreachDraft(leadId: string): Promise<GenerateOutreachDraftResult> {
  const lead = await prisma.partnerLead.findUnique({ where: { id: leadId } });
  if (!lead) return { success: false, reason: "lead_not_found" };

  const message = await generateOutreachMessage(lead);
  if (!message) return { success: false, reason: "ai_unavailable" };

  return { success: true, message };
}

export type SendOutreachNowResult =
  | { success: true }
  | { success: false; reason: "lead_not_found" | "clinic_not_found" | "send_failed" };

/** Disparo manual, fora do ciclo automático (ver AiOutreachControl / botão "Enviar
 * agora" em admin/leads) — recebe o texto já revisado (e possivelmente editado) pelo
 * admin em vez de gerar de novo (ver generateOutreachDraft), pra não mandar um texto
 * diferente do que foi aprovado na prévia. Retorna um resultado tipado em vez de
 * lançar erro: Server Actions em produção escondem a mensagem de erros lançados (só
 * chega um "digest" genérico no cliente), então o motivo real só chega no toast se
 * vier no valor de retorno. */
export async function sendOutreachMessageNow(leadId: string, message: string): Promise<SendOutreachNowResult> {
  const lead = await prisma.partnerLead.findUnique({ where: { id: leadId } });
  if (!lead) return { success: false, reason: "lead_not_found" };

  const clinicId = await getTivdcClinicId();
  if (!clinicId) return { success: false, reason: "clinic_not_found" };

  const result = await sendWhatsAppMessage(lead.phone, message, "ai_outreach.sent", clinicId);
  if (!result.success) return { success: false, reason: "send_failed" };

  const sentNote = `[Contato via IA (manual), ${new Date().toLocaleString("pt-BR", { timeZone: "America/Bahia" })}]:\n${message}`;
  await prisma.partnerLead.update({
    where: { id: lead.id },
    data: {
      status: lead.status === "NEW" ? "CONTACTED" : lead.status,
      notes: lead.notes ? `${lead.notes}\n\n${sentNote}` : sentNote,
    },
  });

  return { success: true };
}
