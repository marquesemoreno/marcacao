import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { deletePatientRelatedData, removeConversationMedia } from "./lgpd-server";
import { phoneVariants } from "./lgpd";

/** Auditoria de segurança 16/11/2026 (M8): a exclusão a pedido do titular deixava para trás
 * Tarefas, inscrições de automação, ficha prévia, senhas, NPS, lista de espera… */
const MODELS = [
  "receptionTask",
  "tagAutomationEnrollment",
  "conversationStageChange",
  "bookingRequest",
  "adClick",
  "patientFormResponse",
  "consentAcceptance",
  "patientToken",
  "npsResponse",
  "queueTicket",
  "waitlistEntry",
  "channelConsent",
  "agendaMark",
  "bridgeReminderLog",
  "slotOffer",
  "broadcastRecipient",
] as const;

function fakeTx() {
  const tx: Record<string, { deleteMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> }> = {};
  for (const m of MODELS) tx[m] = { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
  return tx;
}

const target = { clinicId: "clinic-a", conversationId: "conv1", contactId: "contact1", phone: "5577999990000" };

describe("phoneVariants", () => {
  it("cobre com e sem 55 e com e sem o 9º dígito", () => {
    expect(phoneVariants("5577999990000").sort()).toEqual(["557799990000", "5577999990000", "7799990000", "77999990000"].sort());
  });
  it("sem telefone: lista vazia", () => {
    expect(phoneVariants(null)).toEqual([]);
  });
});

describe("deletePatientRelatedData", () => {
  let tx: ReturnType<typeof fakeTx>;
  beforeEach(() => {
    tx = fakeTx();
  });

  it("apaga Tarefas e inscrições de automação da conversa", async () => {
    await deletePatientRelatedData(tx as never, target);
    expect(tx.receptionTask.deleteMany).toHaveBeenCalledWith({ where: { clinicId: "clinic-a", conversationId: "conv1" } });
    expect(tx.tagAutomationEnrollment.deleteMany).toHaveBeenCalledWith({ where: { conversationId: "conv1" } });
    expect(tx.bookingRequest.deleteMany).toHaveBeenCalledWith({ where: { conversationId: "conv1" } });
    expect(tx.conversationStageChange.deleteMany).toHaveBeenCalledWith({ where: { conversationId: "conv1" } });
    expect(tx.adClick.deleteMany).toHaveBeenCalledWith({ where: { conversationId: "conv1" } });
  });

  it("apaga ficha prévia, aceite do termo, links, NPS, senhas e lista de espera — só desta clínica", async () => {
    await deletePatientRelatedData(tx as never, target);
    const phones = phoneVariants(target.phone);
    const byPhoneOrContact = { clinicId: "clinic-a", OR: [{ phone: { in: phones } }, { contactId: "contact1" }] };
    expect(tx.patientFormResponse.deleteMany).toHaveBeenCalledWith({ where: byPhoneOrContact });
    expect(tx.consentAcceptance.deleteMany).toHaveBeenCalledWith({ where: byPhoneOrContact });
    expect(tx.patientToken.deleteMany).toHaveBeenCalledWith({ where: byPhoneOrContact });
    for (const m of ["npsResponse", "queueTicket", "waitlistEntry"] as const) {
      expect(tx[m].deleteMany).toHaveBeenCalledWith({ where: { clinicId: "clinic-a", phone: { in: phones } } });
    }
  });

  it("tira o telefone do que alimenta relatório, sem apagar a linha", async () => {
    await deletePatientRelatedData(tx as never, target);
    const phones = phoneVariants(target.phone);
    for (const m of ["agendaMark", "bridgeReminderLog", "slotOffer"] as const) {
      expect(tx[m].updateMany).toHaveBeenCalledWith({ where: { clinicId: "clinic-a", phone: { in: phones } }, data: { phone: null } });
      expect(tx[m].deleteMany).not.toHaveBeenCalled();
    }
  });

  it("campanhas: quem ainda ia receber deixa de receber, e telefone e variáveis somem", async () => {
    await deletePatientRelatedData(tx as never, target);
    const where = { phone: { in: phoneVariants(target.phone) }, campaign: { clinicId: "clinic-a" } };
    expect(tx.broadcastRecipient.updateMany).toHaveBeenNthCalledWith(1, { where: { ...where, status: "PENDING" }, data: { status: "SKIPPED_OPT_OUT", errorMessage: "Dados excluídos a pedido do titular" } });
    expect(tx.broadcastRecipient.updateMany).toHaveBeenNthCalledWith(2, { where, data: { phone: "excluido-conv1", variables: {} } });
  });

  it("aceite de SMS some; quem pediu para sair continua na lista de bloqueio", async () => {
    await deletePatientRelatedData(tx as never, target);
    expect(tx.channelConsent.deleteMany).toHaveBeenCalledWith({ where: { clinicId: "clinic-a", channel: "SMS", address: { in: phoneVariants(target.phone) }, revokedAt: null } });
  });

  it("paciente só de Instagram (sem telefone): apaga pelo vínculo da conversa e do contato", async () => {
    await deletePatientRelatedData(tx as never, { ...target, phone: null });
    expect(tx.receptionTask.deleteMany).toHaveBeenCalled();
    expect(tx.patientFormResponse.deleteMany).toHaveBeenCalledWith({ where: { clinicId: "clinic-a", OR: [{ contactId: "contact1" }] } });
    expect(tx.queueTicket.deleteMany).not.toHaveBeenCalled();
    expect(tx.broadcastRecipient.updateMany).not.toHaveBeenCalled();
  });

  it("devolve quantos registros saíram", async () => {
    const r = await deletePatientRelatedData(tx as never, target);
    expect(r).toMatchObject({ tasks: 1, automationEnrollments: 1, formResponses: 1, queueTickets: 1 });
  });
});

describe("removeConversationMedia", () => {
  it("apaga todas as páginas da pasta da conversa, não só os primeiros 1000", async () => {
    const page = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `f${i}.jpg` }));
    const list = vi.fn().mockResolvedValueOnce({ data: page(1000) }).mockResolvedValueOnce({ data: page(1000) }).mockResolvedValueOnce({ data: page(3) }).mockResolvedValue({ data: [] });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const supabase = { storage: { from: () => ({ list, remove }) } };
    const n = await removeConversationMedia(supabase as never, "conv1");
    expect(n).toBe(2003);
    expect(remove).toHaveBeenCalledTimes(3);
    expect(remove.mock.calls[2][0]).toEqual(["conv1/f0.jpg", "conv1/f1.jpg", "conv1/f2.jpg"]);
  });

  it("para se a remoção falhar (não fica em laço)", async () => {
    const list = vi.fn().mockResolvedValue({ data: [{ name: "a.jpg" }] });
    const remove = vi.fn().mockResolvedValue({ error: { message: "x" } });
    const n = await removeConversationMedia({ storage: { from: () => ({ list, remove }) } } as never, "conv1");
    expect(n).toBe(0);
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
