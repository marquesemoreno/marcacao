import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

/** Link "não quero mais receber" de SMS e e-mail (LGPD). Pública (fora do middleware, como os
 * webhooks). GET só mostra a confirmação: programas de segurança de e-mail e prévias de SMS
 * abrem links sozinhos e não podem descadastrar ninguém. POST grava a saída — também é o
 * "um clique" que Gmail/Outlook exigem via cabeçalho List-Unsubscribe-Post. */
type Ctx = { params: Promise<{ token: string }> };

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function page(status: number, title: string, body: string): Response {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title></head><body style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:48px auto;padding:0 20px;color:#222"><h1 style="font-size:20px">${escapeHtml(title)}</h1>${body}</body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

const invalid = () => page(404, "Link inválido", "<p>Este link não é válido ou já expirou. Se quiser parar de receber mensagens, avise a clínica.</p>");

async function loadConsent(token: string) {
  const consentId = verifyUnsubscribeToken(token, process.env.UNSUBSCRIBE_SECRET ?? "");
  if (!consentId) return null;
  return prisma.channelConsent.findUnique({
    where: { id: consentId },
    select: { id: true, channel: true, clinic: { select: { name: true } } },
  });
}

export async function GET(_request: Request, { params }: Ctx) {
  const consent = await loadConsent((await params).token);
  if (!consent) return invalid();
  const what = consent.channel === "EMAIL" ? "e-mails" : "SMS";
  return page(
    200,
    "Deixar de receber mensagens",
    `<p>Você quer parar de receber ${what} de <strong>${escapeHtml(consent.clinic.name)}</strong>?</p><form method="POST"><button type="submit" style="padding:12px 20px;font-size:16px;border:0;border-radius:6px;background:#0f766e;color:#fff;cursor:pointer">Sim, parar de receber</button></form>`
  );
}

export async function POST(_request: Request, { params }: Ctx) {
  const consent = await loadConsent((await params).token);
  if (!consent) return invalid();
  await prisma.channelConsent.update({ where: { id: consent.id }, data: { revokedAt: new Date() } });
  return page(200, "Pronto", `<p>Você não vai mais receber mensagens de <strong>${escapeHtml(consent.clinic.name)}</strong> por este canal.</p>`);
}
