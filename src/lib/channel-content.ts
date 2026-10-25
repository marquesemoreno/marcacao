import { applyBroadcastVariables } from "@/lib/broadcast-csv";
import { smsCredits } from "@/lib/broadcast-channel";

/** Monta o conteúdo final de SMS e e-mail. Mesma regra do WhatsApp (buildBroadcastMessage):
 * variáveis do CSV, linha do responsável técnico (CFM) e forma de sair da lista (LGPD) em
 * toda mensagem de marketing. Funções puras: nada de banco nem env aqui. */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailContent = {
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
};

export function buildEmailContent(input: {
  subject: string;
  template: string;
  variables: Record<string, string>;
  technicalDirector: string | null;
  unsubscribeUrl: string;
}): EmailContent {
  const { variables, unsubscribeUrl } = input;
  // Quebra de linha no assunto abriria brecha para injetar cabeçalhos.
  const subject = applyBroadcastVariables(input.subject, variables).replace(/[\r\n]+/g, " ").trim();
  const body = applyBroadcastVariables(input.template, variables);
  const rt = input.technicalDirector ? `Responsável técnico: ${input.technicalDirector}` : null;

  const text = [body, rt, `Para não receber mais e-mails desta clínica: ${unsubscribeUrl}`].filter(Boolean).join("\n\n");
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222">${escapeHtml(body).replace(/\n/g, "<br>")}</div>` +
    `<hr style="border:none;border-top:1px solid #ddd;margin:24px 0">` +
    `<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#666">` +
    (rt ? `${escapeHtml(rt)}<br>` : "") +
    `<a href="${escapeHtml(unsubscribeUrl)}">Não quero mais receber e-mails desta clínica</a></p>`;

  return {
    subject,
    text,
    html,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

export function buildSmsContent(input: {
  template: string;
  variables: Record<string, string>;
  technicalDirector: string | null;
  unsubscribeUrl: string;
}): { text: string; credits: number } {
  const body = applyBroadcastVariables(input.template, input.variables);
  const parts = [body];
  if (input.technicalDirector) parts.push(`RT: ${input.technicalDirector}`);
  if (!body.includes(input.unsubscribeUrl)) parts.push(`Sair: ${input.unsubscribeUrl}`);
  const text = parts.join("\n");
  return { text, credits: smsCredits(text) };
}
