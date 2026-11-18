/** Relatório de campanhas de disparo (/clinic/relatorio): progresso e retorno de cada
 * campanha. Função pura — a busca no banco fica em getClinicCampaignReport. */

import { NO_CONSENT_MESSAGE } from "./marketing-consent";

const REPLY_WINDOW_MS = 7 * 86_400_000;

/** Chave do telefone sem o 9º dígito — o mesmo paciente pode estar salvo com ou sem
 * o 9 no contato e na lista da campanha (ver toggleNinthDigit em whatsapp.ts). */
export function phoneKey(phone: string): string {
  if (phone.startsWith("55") && phone.length === 13 && phone[4] === "9") return phone.slice(0, 4) + phone.slice(5);
  return phone;
}

export type CampaignRecipientRow = {
  phone: string;
  status: "PENDING" | "SENT" | "FAILED" | "SKIPPED_OPT_OUT";
  sentAt: Date | null;
  /** Motivo do pulo — NO_CONSENT_MESSAGE = sem consentimento (não pediu para sair). */
  errorMessage?: string | null;
  /** Texto/modelo que o destinatário recebeu (0 = principal; null = principal). */
  variantIndex?: number | null;
};

/** Retorno de cada texto/modelo sorteado na campanha (teste A/B/C). */
export type CampaignVariantStats = { sent: number; replied: number; replyRate: number; optedOut: number; scheduled: number };

export type CampaignContactRow = {
  phone: string;
  /** Mensagens recebidas do paciente (qualquer conversa da clínica). */
  inboundAt: Date[];
  optedOutAt: Date | null;
  /** Conversa da clínica na etapa "Agendado" do CRM. */
  scheduled: boolean;
};

export type CampaignStats = {
  total: number;
  sent: number;
  pending: number;
  failed: number;
  /** Já descadastrados antes (pulados) + quem pediu pra sair depois de receber. */
  optedOut: number;
  /** Pulados por não terem consentido receber campanhas (LGPD). */
  noConsent: number;
  /** Mandou mensagem em até 7 dias depois de receber. */
  replied: number;
  replyRate: number;
  /** Entre as que responderam, quantas estão em "Agendado" no CRM. */
  scheduled: number;
  /** Por variação (índice 0 = principal) — só quando a campanha tem mais de um texto/modelo. */
  byVariant: CampaignVariantStats[] | null;
};

export function computeCampaignStats(recipients: CampaignRecipientRow[], contacts: CampaignContactRow[], variantCount = 1): CampaignStats {
  const byKey = new Map(contacts.map((c) => [phoneKey(c.phone), c]));
  const byVariant: CampaignVariantStats[] | null =
    variantCount > 1 ? Array.from({ length: variantCount }, () => ({ sent: 0, replied: 0, replyRate: 0, optedOut: 0, scheduled: 0 })) : null;
  const stats: CampaignStats = { total: recipients.length, sent: 0, pending: 0, failed: 0, optedOut: 0, noConsent: 0, replied: 0, replyRate: 0, scheduled: 0, byVariant };

  for (const r of recipients) {
    if (r.status === "PENDING") stats.pending++;
    else if (r.status === "FAILED") stats.failed++;
    else if (r.status === "SKIPPED_OPT_OUT") {
      if (r.errorMessage === NO_CONSENT_MESSAGE) stats.noConsent++;
      else stats.optedOut++;
    }
    if (r.status !== "SENT" || !r.sentAt) continue;
    stats.sent++;
    const v = byVariant?.[r.variantIndex ?? 0] ?? null;
    if (v) v.sent++;
    const contact = byKey.get(phoneKey(r.phone));
    if (!contact) continue;
    const sentMs = r.sentAt.getTime();
    if (contact.optedOutAt && contact.optedOutAt.getTime() >= sentMs) {
      stats.optedOut++;
      if (v) v.optedOut++;
    }
    const replied = contact.inboundAt.some((at) => at.getTime() > sentMs && at.getTime() <= sentMs + REPLY_WINDOW_MS);
    if (replied) {
      stats.replied++;
      if (v) v.replied++;
      if (contact.scheduled) {
        stats.scheduled++;
        if (v) v.scheduled++;
      }
    }
  }
  stats.replyRate = stats.sent > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0;
  for (const v of byVariant ?? []) v.replyRate = v.sent > 0 ? Math.round((v.replied / v.sent) * 100) : 0;
  return stats;
}
