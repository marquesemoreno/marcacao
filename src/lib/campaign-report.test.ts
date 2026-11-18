import { describe, expect, it } from "vitest";
import { computeCampaignStats, phoneKey } from "./campaign-report";

const d = (s: string) => new Date(s);

describe("phoneKey", () => {
  it("trata número com e sem o 9 como o mesmo", () => {
    expect(phoneKey("5577999311841")).toBe(phoneKey("557799311841"));
  });
});

describe("computeCampaignStats", () => {
  const recipients = [
    { phone: "5577911110001", status: "SENT" as const, sentAt: d("2026-10-05T13:00:00Z") },
    { phone: "5577911110002", status: "SENT" as const, sentAt: d("2026-10-05T13:00:00Z") },
    { phone: "5577911110003", status: "SENT" as const, sentAt: d("2026-10-05T13:00:00Z") },
    { phone: "5577911110004", status: "PENDING" as const, sentAt: null },
    { phone: "5577911110005", status: "FAILED" as const, sentAt: null },
    { phone: "5577911110006", status: "SKIPPED_OPT_OUT" as const, sentAt: null },
  ];

  it("conta progresso, respostas em até 7 dias, descadastros e agendados", () => {
    const contacts = [
      // respondeu (contato salvo sem o 9) e foi agendada
      { phone: "557711110001", inboundAt: [d("2026-10-05T14:00:00Z")], optedOutAt: null, scheduled: true },
      // mensagem só ANTES do envio e depois de 7 dias: não conta como resposta
      { phone: "5577911110002", inboundAt: [d("2026-10-01T10:00:00Z"), d("2026-10-13T13:00:01Z")], optedOutAt: null, scheduled: false },
      // pediu pra sair depois do envio (também respondeu)
      { phone: "5577911110003", inboundAt: [d("2026-10-05T15:00:00Z")], optedOutAt: d("2026-10-05T15:00:00Z"), scheduled: false },
    ];
    expect(computeCampaignStats(recipients, contacts)).toEqual({
      total: 6,
      sent: 3,
      pending: 1,
      failed: 1,
      optedOut: 2,
      noConsent: 0,
      replied: 2,
      replyRate: 67,
      scheduled: 1,
      byVariant: null,
    });
  });

  it("sem envios, taxa 0", () => {
    expect(computeCampaignStats([recipients[3]], []).replyRate).toBe(0);
  });
});

describe("sem consentimento separado de 'pediram para sair'", () => {
  it("SKIPPED_OPT_OUT com o motivo de consentimento conta em noConsent, não em optedOut", () => {
    const stats = computeCampaignStats(
      [
        { phone: "5577911110007", status: "SKIPPED_OPT_OUT", sentAt: null, errorMessage: "Sem consentimento para campanhas" },
        { phone: "5577911110008", status: "SKIPPED_OPT_OUT", sentAt: null, errorMessage: null },
      ],
      []
    );
    expect(stats.noConsent).toBe(1);
    expect(stats.optedOut).toBe(1);
  });
});

describe("computeCampaignStats por modelo/variação", () => {
  const at = d("2026-11-20T13:00:00Z");
  const recipients = [
    { phone: "5577911110001", status: "SENT" as const, sentAt: at, variantIndex: 0 },
    { phone: "5577911110002", status: "SENT" as const, sentAt: at, variantIndex: 1 },
    { phone: "5577911110003", status: "SENT" as const, sentAt: at, variantIndex: 1 },
    { phone: "5577911110004", status: "SENT" as const, sentAt: at, variantIndex: 2 },
    { phone: "5577911110005", status: "SENT" as const, sentAt: at, variantIndex: null },
    { phone: "5577911110006", status: "PENDING" as const, sentAt: null, variantIndex: null },
  ];
  const contacts = [
    { phone: "5577911110002", inboundAt: [d("2026-11-20T14:00:00Z")], optedOutAt: null, scheduled: true },
    { phone: "5577911110003", inboundAt: [d("2026-11-20T14:00:00Z")], optedOutAt: d("2026-11-20T14:00:00Z"), scheduled: false },
    { phone: "5577911110004", inboundAt: [d("2026-11-21T14:00:00Z")], optedOutAt: null, scheduled: false },
  ];

  it("separa enviadas, respostas, saídas e agendados por variação (sem índice = principal)", () => {
    const s = computeCampaignStats(recipients, contacts, 3);
    expect(s.byVariant).toEqual([
      { sent: 2, replied: 0, replyRate: 0, optedOut: 0, scheduled: 0 },
      { sent: 2, replied: 2, replyRate: 100, optedOut: 1, scheduled: 1 },
      { sent: 1, replied: 1, replyRate: 100, optedOut: 0, scheduled: 0 },
    ]);
    expect(s.replied).toBe(3);
  });

  it("campanha com um texto só não traz a divisão", () => {
    expect(computeCampaignStats(recipients, contacts).byVariant).toBeNull();
  });
});
