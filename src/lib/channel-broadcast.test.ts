import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { prismaMock, sendEmail, sendSms } = vi.hoisted(() => ({
  prismaMock: {
    broadcastCampaign: { findMany: vi.fn(), update: vi.fn() },
    broadcastRecipient: { findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
    channelConsent: { findUnique: vi.fn() },
  },
  sendEmail: vi.fn(),
  sendSms: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/resend", () => ({ sendEmailViaResend: sendEmail }));
vi.mock("@/lib/comtele", () => ({ sendSmsViaComtele: sendSms }));
vi.mock("@/lib/format", () => ({ getBaseUrl: () => "https://exemplo.com.br" }));

import { dispatchNextChannelBatch } from "./channel-broadcast";
import { verifyUnsubscribeToken } from "./unsubscribe-token";

const TUESDAY_NOON = new Date("2026-10-27T15:00:00Z"); // terça 12h em Brasília: dentro da janela
const SATURDAY_NOON = new Date("2026-10-24T15:00:00Z");
const SMS_ENV = { COMTELE_API_KEY: "key", COMTELE_ROUTE: "17", UNSUBSCRIBE_SECRET: "segredo-de-teste-longo-o-bastante" };
const EMAIL_ENV = { RESEND_API_KEY: "re_x", BROADCAST_EMAIL_FROM: "Clínica <avisos@clinica.com.br>", UNSUBSCRIBE_SECRET: "segredo-de-teste-longo-o-bastante" };

function campaign(over: Record<string, unknown> = {}) {
  return {
    id: "camp1",
    clinicId: "clinic1",
    channel: "SMS",
    status: "RUNNING",
    subject: null,
    messageTemplate: "Oi {{nome}}, seu retorno está liberado.",
    messageVariants: [],
    clinic: { technicalDirectorName: "Dr. Fulano", technicalDirectorCrm: "CRM-BA 12345" },
    ...over,
  };
}
const recipient = (over: Record<string, unknown> = {}) => ({ id: "rec1", phone: "5577999991234", variables: { nome: "Maria" }, ...over });
const consent = (over: Record<string, unknown> = {}) => ({ id: "consent1", consentAt: new Date("2026-10-01T10:00:00Z"), revokedAt: null, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.broadcastCampaign.findMany.mockResolvedValue([campaign()]);
  prismaMock.broadcastRecipient.findMany.mockResolvedValue([recipient()]);
  prismaMock.broadcastRecipient.count.mockResolvedValue(1);
  prismaMock.channelConsent.findUnique.mockResolvedValue(consent());
  sendSms.mockResolvedValue({ success: true });
  sendEmail.mockResolvedValue({ success: true, id: "email1" });
});

describe("dispatchNextChannelBatch", () => {
  it("fora do horário de marketing (sábado) não envia nada", async () => {
    const out = await dispatchNextChannelBatch({ now: SATURDAY_NOON, env: SMS_ENV });
    expect(out.processed).toBe(0);
    expect(sendSms).not.toHaveBeenCalled();
    expect(prismaMock.broadcastRecipient.findMany).not.toHaveBeenCalled();
  });

  it("só pega campanhas SMS e e-mail em andamento", async () => {
    await dispatchNextChannelBatch({ now: TUESDAY_NOON, env: SMS_ENV });
    expect(prismaMock.broadcastCampaign.findMany.mock.calls[0][0].where).toMatchObject({ status: "RUNNING", channel: { in: ["SMS", "EMAIL"] } });
  });

  it("SMS com consentimento: envia ao número, com link de descadastro assinado e RT", async () => {
    await dispatchNextChannelBatch({ now: TUESDAY_NOON, env: SMS_ENV });
    expect(sendSms).toHaveBeenCalledTimes(1);
    const arg = sendSms.mock.calls[0][0];
    expect(arg).toMatchObject({ apiKey: "key", route: 17, number: "5577999991234" });
    expect(arg.message).toContain("Oi Maria, seu retorno está liberado.");
    expect(arg.message).toContain("RT: Dr. Fulano — CRM-BA 12345");
    const url = arg.message.match(/Sair: (https:\/\/exemplo\.com\.br\/api\/u\/\S+)/)?.[1];
    expect(url).toBeTruthy();
    expect(verifyUnsubscribeToken(url!.split("/api/u/")[1], SMS_ENV.UNSUBSCRIBE_SECRET)).toBe("consent1");
    expect(prismaMock.broadcastRecipient.update).toHaveBeenCalledWith({
      where: { id: "rec1" },
      data: expect.objectContaining({ status: "SENT", variantIndex: 0 }),
    });
  });

  it("consentimento é procurado pela clínica, canal e endereço do destinatário", async () => {
    await dispatchNextChannelBatch({ now: TUESDAY_NOON, env: SMS_ENV });
    expect(prismaMock.channelConsent.findUnique).toHaveBeenCalledWith({
      where: { clinicId_channel_address: { clinicId: "clinic1", channel: "SMS", address: "5577999991234" } },
      select: { id: true, consentAt: true, revokedAt: true },
    });
  });

  it("e-mail com consentimento: assunto com variável, cabeçalhos de descadastro e idempotência", async () => {
    prismaMock.broadcastCampaign.findMany.mockResolvedValue([campaign({ channel: "EMAIL", subject: "Olá {{nome}}" })]);
    prismaMock.broadcastRecipient.findMany.mockResolvedValue([recipient({ phone: "maria@x.com" })]);
    await dispatchNextChannelBatch({ now: TUESDAY_NOON, env: EMAIL_ENV });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const arg = sendEmail.mock.calls[0][0];
    expect(arg).toMatchObject({ apiKey: "re_x", from: EMAIL_ENV.BROADCAST_EMAIL_FROM, to: "maria@x.com", subject: "Olá Maria", idempotencyKey: "rec1" });
    expect(arg.headers["List-Unsubscribe"]).toMatch(/^<https:\/\/exemplo\.com\.br\/api\/u\//);
    expect(arg.text).toContain("Responsável técnico: Dr. Fulano — CRM-BA 12345");
  });

  it("sem consentimento: pula, registra o motivo e NÃO envia", async () => {
    prismaMock.channelConsent.findUnique.mockResolvedValue(null);
    await dispatchNextChannelBatch({ now: TUESDAY_NOON, env: SMS_ENV });
    expect(sendSms).not.toHaveBeenCalled();
    expect(prismaMock.broadcastRecipient.update).toHaveBeenCalledWith({
      where: { id: "rec1" },
      data: { status: "SKIPPED_OPT_OUT", errorMessage: "Sem consentimento para este canal" },
    });
  });

  it("quem pediu para sair não recebe", async () => {
    prismaMock.channelConsent.findUnique.mockResolvedValue(consent({ revokedAt: new Date("2026-10-20T10:00:00Z") }));
    await dispatchNextChannelBatch({ now: TUESDAY_NOON, env: SMS_ENV });
    expect(sendSms).not.toHaveBeenCalled();
    expect(prismaMock.broadcastRecipient.update).toHaveBeenCalledWith({
      where: { id: "rec1" },
      data: { status: "SKIPPED_OPT_OUT", errorMessage: "Pediu para não receber" },
    });
  });

  it("erro do provedor marca o destinatário como FAILED com o motivo", async () => {
    sendSms.mockResolvedValue({ success: false, error: "Saldo insuficiente" });
    await dispatchNextChannelBatch({ now: TUESDAY_NOON, env: SMS_ENV });
    expect(prismaMock.broadcastRecipient.update).toHaveBeenCalledWith({
      where: { id: "rec1" },
      data: { status: "FAILED", errorMessage: "Saldo insuficiente" },
    });
  });

  it("provedor sem configuração: não envia e deixa todo mundo pendente", async () => {
    const out = await dispatchNextChannelBatch({ now: TUESDAY_NOON, env: {} });
    expect(out.processed).toBe(0);
    expect(sendSms).not.toHaveBeenCalled();
    expect(prismaMock.broadcastRecipient.update).not.toHaveBeenCalled();
  });

  it("respeita o tamanho do lote por minuto", async () => {
    await dispatchNextChannelBatch({ now: TUESDAY_NOON, env: { ...SMS_ENV, CHANNEL_BATCH_SIZE: "4" } });
    expect(prismaMock.broadcastRecipient.findMany.mock.calls[0][0]).toMatchObject({ take: 4, where: { campaignId: "camp1", status: "PENDING" } });
  });

  it("sem pendentes depois do lote, a campanha vira COMPLETED", async () => {
    prismaMock.broadcastRecipient.count.mockResolvedValue(0);
    await dispatchNextChannelBatch({ now: TUESDAY_NOON, env: SMS_ENV });
    expect(prismaMock.broadcastCampaign.update).toHaveBeenCalledWith({ where: { id: "camp1" }, data: { status: "COMPLETED" } });
  });

  it("ainda com pendentes, a campanha continua RUNNING", async () => {
    await dispatchNextChannelBatch({ now: TUESDAY_NOON, env: SMS_ENV });
    expect(prismaMock.broadcastCampaign.update).not.toHaveBeenCalled();
  });
});
