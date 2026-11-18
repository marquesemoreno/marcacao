import { describe, it, expect } from "vitest";
import { decideQueueReturn, groupWaitingBoard, QUEUE_RETURN_NOTE_PREFIX, queueReturnNote, waitingSince, type QueueReturnMessage } from "./queue-return";

/** Hora de Brasília (UTC-3) numa quarta-feira, 18/11/2026. */
function br(hhmm: string, day = "2026-11-18"): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h + 3, min));
}

const patient = (at: Date, content = "Oi, quero marcar"): QueueReturnMessage => ({
  direction: "INBOUND", type: "TEXT", senderUserId: null, sentFromDevice: false, content, createdAt: at,
});
const human = (at: Date): QueueReturnMessage => ({
  direction: "OUTBOUND", type: "TEXT", senderUserId: "u1", sentFromDevice: false, content: "Olá!", createdAt: at,
});
const robot = (at: Date): QueueReturnMessage => ({
  direction: "OUTBOUND", type: "TEXT", senderUserId: null, sentFromDevice: false, content: "Lembrete", createdAt: at,
});
const note = (at: Date, content: string): QueueReturnMessage => ({
  direction: "OUTBOUND", type: "INTERNAL_NOTE", senderUserId: "u1", sentFromDevice: false, content, createdAt: at,
});

const base = {
  returnMinutes: 30,
  assignedUserId: "u1",
  assignedAt: br("09:00"),
  status: "OPEN",
  aiEnabled: false,
  archivedAt: null,
};

describe("decideQueueReturn", () => {
  it("devolve quando o paciente espera mais que o prazo em horário comercial", () => {
    const r = decideQueueReturn({ ...base, now: br("10:31"), messages: [patient(br("10:00"))] });
    expect(r).toEqual({ return: true, waitingMinutes: 31 });
  });

  it("não devolve antes do prazo", () => {
    expect(decideQueueReturn({ ...base, now: br("10:29"), messages: [patient(br("10:00"))] }).return).toBe(false);
  });

  it("o prazo começa na atribuição, se ela veio depois da mensagem do paciente", () => {
    const r = decideQueueReturn({ ...base, assignedAt: br("10:20"), now: br("10:40"), messages: [patient(br("10:00"))] });
    expect(r.return).toBe(false);
  });

  it("fora do horário comercial o relógio não anda", () => {
    // paciente escreveu às 17:50, agora são 07:00 do dia seguinte: só 10 min úteis
    const r = decideQueueReturn({ ...base, assignedAt: br("09:00"), now: br("07:00", "2026-11-19"), messages: [patient(br("17:50"))] });
    expect(r.return).toBe(false);
  });

  it("última mensagem de alguém da equipe → não devolve", () => {
    const r = decideQueueReturn({ ...base, now: br("12:00"), messages: [patient(br("10:00")), human(br("10:05"))] });
    expect(r.return).toBe(false);
  });

  it("resposta pelo celular da clínica conta como resposta", () => {
    const fromPhone: QueueReturnMessage = { ...robot(br("10:05")), sentFromDevice: true };
    expect(decideQueueReturn({ ...base, now: br("12:00"), messages: [patient(br("10:00")), fromPhone] }).return).toBe(false);
  });

  it("mensagem automática (lembrete, aviso) não conta como resposta", () => {
    const r = decideQueueReturn({ ...base, now: br("10:40"), messages: [patient(br("10:00")), robot(br("10:01"))] });
    expect(r.return).toBe(true);
  });

  it("nota interna não conta como resposta", () => {
    const r = decideQueueReturn({ ...base, now: br("10:40"), messages: [patient(br("10:00")), note(br("10:05"), "vou ver isso")] });
    expect(r.return).toBe(true);
  });

  it("conta a espera desde a PRIMEIRA mensagem sem resposta", () => {
    const r = decideQueueReturn({
      ...base,
      now: br("10:35"),
      messages: [human(br("09:30")), patient(br("10:00")), patient(br("10:30"))],
    });
    expect(r).toEqual({ return: true, waitingMinutes: 35 });
  });

  it("no máximo 2 devoluções desde a última resposta humana", () => {
    const messages = [
      patient(br("09:00")),
      note(br("09:40"), queueReturnNote("Ana", 40)),
      note(br("10:20"), queueReturnNote("Bia", 30)),
    ];
    expect(decideQueueReturn({ ...base, assignedAt: br("10:30"), now: br("11:30"), messages }).return).toBe(false);
  });

  it("depois de uma resposta humana, as devoluções antigas não contam mais", () => {
    const messages = [
      patient(br("08:00")),
      note(br("08:40"), queueReturnNote("Ana", 40)),
      note(br("09:20"), queueReturnNote("Bia", 30)),
      human(br("09:30")),
      patient(br("10:00")),
    ];
    expect(decideQueueReturn({ ...base, assignedAt: br("09:30"), now: br("10:40"), messages }).return).toBe(true);
  });

  it("não devolve: desligado, sem dono, finalizada, arquivada ou com a IA atendendo", () => {
    const input = { ...base, now: br("12:00"), messages: [patient(br("10:00"))] };
    expect(decideQueueReturn({ ...input, returnMinutes: null }).return).toBe(false);
    expect(decideQueueReturn({ ...input, returnMinutes: 0 }).return).toBe(false);
    expect(decideQueueReturn({ ...input, assignedUserId: null }).return).toBe(false);
    expect(decideQueueReturn({ ...input, status: "RESOLVED" }).return).toBe(false);
    expect(decideQueueReturn({ ...input, archivedAt: br("11:00") }).return).toBe(false);
    expect(decideQueueReturn({ ...input, aiEnabled: true }).return).toBe(false);
  });

  it("sem mensagem do paciente → não devolve", () => {
    expect(decideQueueReturn({ ...base, now: br("12:00"), messages: [human(br("10:00"))] }).return).toBe(false);
    expect(decideQueueReturn({ ...base, now: br("12:00"), messages: [] }).return).toBe(false);
  });
});

describe("queueReturnNote", () => {
  it("diz quem não respondeu e há quanto tempo, com o prefixo reconhecível", () => {
    const text = queueReturnNote("Ana Souza", 45);
    expect(text.startsWith(QUEUE_RETURN_NOTE_PREFIX)).toBe(true);
    expect(text).toContain("Ana Souza");
    expect(text).toContain("45 min");
  });
});

describe("waitingSince (painel Esperando)", () => {
  it("primeira mensagem do paciente depois da última resposta humana", () => {
    expect(waitingSince([human(br("09:00")), patient(br("09:10")), robot(br("09:11")), patient(br("09:20"))])).toEqual(br("09:10"));
  });
  it("null quando a equipe respondeu por último ou não há mensagem do paciente", () => {
    expect(waitingSince([patient(br("09:00")), human(br("09:05"))])).toBeNull();
    expect(waitingSince([])).toBeNull();
  });
});

describe("groupWaitingBoard", () => {
  it("separa quem espera (mais antigo primeiro) de quem está em atendimento", () => {
    const board = groupWaitingBoard([
      { id: "a", assignedUserId: "u1", waitingSince: br("10:00") },
      { id: "b", assignedUserId: "u1", waitingSince: null },
      { id: "c", assignedUserId: null, waitingSince: br("09:00") },
      { id: "d", assignedUserId: null, waitingSince: null },
    ]);
    expect(board.waiting.map((c) => c.id)).toEqual(["c", "a"]);
    expect(board.inService.map((c) => c.id)).toEqual(["b"]);
  });
});
