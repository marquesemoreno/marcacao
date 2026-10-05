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
      replied: 2,
      replyRate: 67,
      scheduled: 1,
    });
  });

  it("sem envios, taxa 0", () => {
    expect(computeCampaignStats([recipients[3]], []).replyRate).toBe(0);
  });
});
