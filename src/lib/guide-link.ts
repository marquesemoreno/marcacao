import { createHmac, timingSafeEqual } from "crypto";

/** Link público da guia (/acompanhar/<x>) e do comprovante (/comprovante/<x>).
 * Auditoria de segurança 16/11/2026, M11: o link era o próprio id do agendamento — não foi
 * feito para ser segredo e nunca expirava. Agora é "<id>.<assinatura>": a assinatura é um
 * HMAC do id com NEXTAUTH_SECRET, então só quem recebeu o link do nosso servidor consegue
 * montá-lo. Vale até GUIDE_LINK_DAYS_AFTER dias depois da data da consulta.
 * Sem tabela nova: nada para migrar e nada a guardar. */
export const GUIDE_LINK_DAYS_AFTER = 7;

function signature(appointmentId: string, secret: string): string {
  return createHmac("sha256", secret).update(`guide:${appointmentId}`).digest("base64url").slice(0, 22);
}

export function signGuideId(appointmentId: string, secret: string): string {
  return `${appointmentId}.${signature(appointmentId, secret)}`;
}

/** Id do agendamento se o link é nosso; null se é o id puro (link antigo) ou foi alterado. */
export function verifyGuideId(param: string, secret: string): string | null {
  const m = /^([a-z0-9]{10,40})\.([A-Za-z0-9_-]{22})$/.exec(decodeURIComponent(param ?? ""));
  if (!m) return null;
  const expected = Buffer.from(signature(m[1], secret));
  const given = Buffer.from(m[2]);
  return expected.length === given.length && timingSafeEqual(expected, given) ? m[1] : null;
}

/** A consulta foi há mais de GUIDE_LINK_DAYS_AFTER dias? (`date` = dia da consulta, 00:00 UTC). */
export function guideLinkExpired(date: Date | string, now: Date = new Date()): boolean {
  const day = new Date(date).getTime();
  return now.getTime() > day + (GUIDE_LINK_DAYS_AFTER + 1) * 86_400_000;
}

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET não configurada (assina o link da guia).");
  return s;
}

/** Para uso no servidor: "<id>.<assinatura>". */
export function guideLinkId(appointmentId: string): string {
  return signGuideId(appointmentId, secret());
}

export function readGuideLinkId(param: string): string | null {
  return verifyGuideId(param, secret());
}
