import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, session } = vi.hoisted(() => ({
  prismaMock: {
    broadcastCampaign: { create: vi.fn() },
    channelConsent: { findMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  },
  session: { requireClinicSession: vi.fn(), requireClinicManager: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/session", () => session);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createClinicChannelCampaign, registerChannelConsents } from "./clinic-channel-broadcast";

beforeEach(() => {
  vi.clearAllMocks();
  session.requireClinicSession.mockResolvedValue({ clinicId: "clinic1", userId: "user1" });
  session.requireClinicManager.mockResolvedValue({ clinicId: "clinic1", userId: "user1" });
  prismaMock.channelConsent.findMany.mockResolvedValue([]);
  prismaMock.broadcastCampaign.create.mockResolvedValue({ id: "camp1" });
});

const base = { channel: "EMAIL" as const, name: "Retorno", subject: "Olá {{nome}}", messageTemplate: "Oi {{nome}}", extraVariants: [] as string[], csv: "email,nome\na@x.com,Ana\nb@x.com,Bia\nruim,Cris" };

describe("createClinicChannelCampaign", () => {
  it("e-mail sem assunto é recusado", async () => {
    const out = await createClinicChannelCampaign({ ...base, subject: "  " });
    expect(out).toMatchObject({ success: false });
    expect(prismaMock.broadcastCampaign.create).not.toHaveBeenCalled();
  });

  it("nome ou texto em branco são recusados", async () => {
    expect(await createClinicChannelCampaign({ ...base, name: " " })).toMatchObject({ success: false });
    expect(await createClinicChannelCampaign({ ...base, messageTemplate: "" })).toMatchObject({ success: false });
  });

  it("canal WhatsApp não passa por aqui", async () => {
    expect(await createClinicChannelCampaign({ ...base, channel: "WHATSAPP" as never })).toMatchObject({ success: false });
  });

  it("CSV sem coluna de e-mail dá erro legível, sem estourar", async () => {
    const out = await createClinicChannelCampaign({ ...base, csv: "nome,telefone\nAna,77999991234" });
    expect(out).toMatchObject({ success: false });
    expect((out as { error: string }).error).toMatch(/e-mail/i);
  });

  it("lista sem nenhum endereço válido é recusada", async () => {
    expect(await createClinicChannelCampaign({ ...base, csv: "email\nruim\nlixo" })).toMatchObject({ success: false });
  });

  it("cria a campanha como rascunho no canal certo, com o endereço em phone", async () => {
    const out = await createClinicChannelCampaign(base);
    expect(out).toMatchObject({ success: true, campaignId: "camp1", total: 2, invalid: 1, duplicates: 0 });
    const data = prismaMock.broadcastCampaign.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ clinicId: "clinic1", channel: "EMAIL", subject: "Olá {{nome}}", createdByUserId: "user1" });
    expect(data.status).toBeUndefined(); // default DRAFT
    expect(data.recipients.create).toEqual([
      { phone: "a@x.com", variables: { nome: "Ana" }, status: "PENDING" },
      { phone: "b@x.com", variables: { nome: "Bia" }, status: "PENDING" },
    ]);
  });

  it("informa quantos já têm consentimento ativo", async () => {
    prismaMock.channelConsent.findMany.mockResolvedValue([
      { address: "a@x.com", consentAt: new Date("2026-10-01T10:00:00Z"), revokedAt: null },
      { address: "b@x.com", consentAt: new Date("2026-10-01T10:00:00Z"), revokedAt: new Date("2026-10-05T10:00:00Z") },
    ]);
    const out = await createClinicChannelCampaign(base);
    expect(out).toMatchObject({ success: true, withConsent: 1 });
  });

  it("SMS ignora o assunto e não grava subject", async () => {
    await createClinicChannelCampaign({ ...base, channel: "SMS", subject: "", csv: "telefone,nome\n77999991234,Ana" });
    const data = prismaMock.broadcastCampaign.create.mock.calls[0][0].data;
    expect(data.channel).toBe("SMS");
    expect(data.subject).toBeNull();
    expect(data.recipients.create[0].phone).toBe("5577999991234");
  });
});

describe("registerChannelConsents", () => {
  it("exige a origem do aceite (é a prova do consentimento)", async () => {
    const out = await registerChannelConsents("EMAIL", "a@x.com", "  ");
    expect(out).toMatchObject({ success: false });
    expect(prismaMock.channelConsent.createMany).not.toHaveBeenCalled();
  });

  it("só gestão registra (usa requireClinicManager)", async () => {
    session.requireClinicManager.mockRejectedValue(new Error("Acesso restrito à gestão"));
    await expect(registerChannelConsents("EMAIL", "a@x.com", "ficha")).rejects.toThrow(/gestão/i);
    expect(prismaMock.channelConsent.createMany).not.toHaveBeenCalled();
  });

  it("cria os novos, renova quem saiu e não toca em quem já está ativo", async () => {
    prismaMock.channelConsent.findMany.mockResolvedValue([
      { address: "ativo@x.com", consentAt: new Date("2026-10-01T10:00:00Z"), revokedAt: null },
      { address: "saiu@x.com", consentAt: new Date("2026-10-01T10:00:00Z"), revokedAt: new Date("2026-10-05T10:00:00Z") },
    ]);
    const out = await registerChannelConsents("EMAIL", "novo@x.com\nativo@x.com\nsaiu@x.com\nlixo", "ficha de papel 10/2026");
    expect(out).toMatchObject({ success: true, created: 1, renewed: 1, already: 1, invalid: ["lixo"] });
    expect(prismaMock.channelConsent.createMany).toHaveBeenCalledWith({
      data: [{ clinicId: "clinic1", channel: "EMAIL", address: "novo@x.com", consentAt: expect.any(Date), source: "ficha de papel 10/2026" }],
    });
    expect(prismaMock.channelConsent.updateMany).toHaveBeenCalledWith({
      where: { clinicId: "clinic1", channel: "EMAIL", address: { in: ["saiu@x.com"] } },
      data: { consentAt: expect.any(Date), source: "ficha de papel 10/2026" },
    });
  });

  it("recusa lista gigante de uma vez", async () => {
    const huge = Array.from({ length: 5001 }, (_, i) => `u${i}@x.com`).join("\n");
    expect(await registerChannelConsents("EMAIL", huge, "ficha")).toMatchObject({ success: false });
  });
});
