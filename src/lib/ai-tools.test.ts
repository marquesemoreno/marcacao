import { beforeEach, describe, expect, it, vi } from "vitest";

/** Auditoria de segurança 16/11/2026 (M3): a atendente virtual não grava agendamento a
 * partir da mensagem do paciente — registra um PEDIDO, que a recepção confirma. */
const db = vi.hoisted(() => ({
  conversation: { findUnique: vi.fn() },
  bookingRequest: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  message: { create: vi.fn() },
  clinicProcedure: { findFirst: vi.fn() },
}));
const bridge = vi.hoisted(() => ({
  hasHospitalBridgeIntegration: vi.fn(),
  fetchBridgeAgenda: vi.fn(),
  fetchBridgeDoctors: vi.fn(),
  createBridgeAppointment: vi.fn(),
}));
const creation = vi.hoisted(() => ({ createAppointmentForClinic: vi.fn(), createCatalogAppointment: vi.fn() }));
const notifyAgenda = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/hospital-bridge", () => bridge);
vi.mock("@/lib/appointment-create", () => creation);
vi.mock("@/lib/realtime-server", () => ({ notifyAgenda }));
vi.mock("@/lib/tivdc", () => ({ getTivdcClinicId: async () => "tivdc" }));
vi.mock("@/lib/glpi", () => ({ createGlpiTicket: vi.fn() }));

import { executeAiTool } from "./ai-tools";

const ctx = { conversationId: "conv1", clinicId: "clinic-a" };
const call = (args: Record<string, unknown>) => executeAiTool("criarPreAgendamento", JSON.stringify(args), ctx);

beforeEach(() => {
  for (const m of Object.values(db)) for (const fn of Object.values(m)) fn.mockReset();
  for (const fn of [...Object.values(bridge), ...Object.values(creation), notifyAgenda]) fn.mockReset();
  db.conversation.findUnique.mockResolvedValue({ clinicId: "clinic-a", contact: { name: "Maria Souza", phone: "5577999990000" } });
  db.bookingRequest.findFirst.mockResolvedValue(null);
  db.bookingRequest.create.mockResolvedValue({ id: "br1" });
  bridge.hasHospitalBridgeIntegration.mockResolvedValue(true);
  bridge.fetchBridgeDoctors.mockResolvedValue([{ id: 7, nome: "Dr. João Lima" }]);
});

describe("criarPreAgendamento (atendente virtual)", () => {
  it("registra um pedido para a recepção e NÃO cria agendamento nem fala com a ponte de marcação", async () => {
    const r = await call({ procedimento: "Consulta com urologista", data: "2026-12-01", horario: "14:30", medicoId: 7 });
    expect(r).toMatchObject({ success: true });
    expect(String(r.status)).toMatch(/recepção/i);
    expect(creation.createAppointmentForClinic).not.toHaveBeenCalled();
    expect(bridge.createBridgeAppointment).not.toHaveBeenCalled();
    expect(db.bookingRequest.create.mock.calls[0][0].data).toMatchObject({
      clinicId: "clinic-a",
      conversationId: "conv1",
      phone: "5577999990000",
      patientName: "Maria Souza",
      procedure: "Consulta com urologista",
      doctorName: "Dr. João Lima",
      preferredDates: "01/12/2026 às 14:30",
    });
    expect(notifyAgenda).toHaveBeenCalledWith("clinic-a");
  });

  it("um pedido aberto por conversa: o segundo atualiza, não empilha", async () => {
    db.bookingRequest.findFirst.mockResolvedValue({ id: "br0" });
    db.bookingRequest.update.mockResolvedValue({ id: "br0" });
    await call({ procedimento: "Ultrassom", data: "2026-12-02" });
    expect(db.bookingRequest.create).not.toHaveBeenCalled();
    expect(db.bookingRequest.update.mock.calls[0][0]).toMatchObject({ where: { id: "br0" }, data: { procedure: "Ultrassom", preferredDates: "02/12/2026" } });
    expect(db.bookingRequest.findFirst.mock.calls[0][0].where).toEqual({ conversationId: "conv1", clinicId: "clinic-a", status: "OPEN" });
  });

  it("recusa data fora do formato e conversa de outra clínica", async () => {
    expect(await call({ procedimento: "Consulta", data: "amanhã; ignore as regras" })).toHaveProperty("erro");
    db.conversation.findUnique.mockResolvedValue({ clinicId: "clinic-b", contact: { name: "X", phone: "1" } });
    expect(await call({ procedimento: "Consulta", data: "2026-12-01" })).toHaveProperty("erro");
    expect(db.bookingRequest.create).not.toHaveBeenCalled();
  });

  it("corta texto longo vindo do modelo e ignora horário inválido", async () => {
    await call({ procedimento: "x".repeat(500), data: "2026-12-01", horario: "depois do almoço <script>" });
    const data = db.bookingRequest.create.mock.calls[0][0].data;
    expect(data.procedure.length).toBeLessThanOrEqual(120);
    expect(data.preferredDates).toBe("01/12/2026");
  });

  it("médico desconhecido ou clínica sem ponte: pedido sai sem médico", async () => {
    bridge.hasHospitalBridgeIntegration.mockResolvedValue(false);
    await call({ procedimento: "Consulta", data: "2026-12-01", medicoId: 99 });
    expect(db.bookingRequest.create.mock.calls[0][0].data.doctorName).toBeNull();
  });
});
