import { describe, expect, it } from "vitest";
import { doctorDelayMin, matchTicketAppointment, nextTicket, phoneTail, ticketCode, ticketSpoken, ticketsAhead, type QueueTicketLite } from "./queue-ticket";

const t = (id: string, type: "N" | "P", min: number, status: QueueTicketLite["status"] = "WAITING"): QueueTicketLite => ({
  id,
  type,
  status,
  createdAt: new Date(Date.UTC(2026, 10, 3, 12, min)),
});

describe("ticketCode", () => {
  it("letra + 3 dígitos", () => {
    expect(ticketCode("N", 7)).toBe("N007");
    expect(ticketCode("P", 123)).toBe("P123");
    expect(ticketCode("N", 1000)).toBe("N1000");
  });
});

describe("ticketSpoken", () => {
  it("fala a letra e o número sem zeros à esquerda", () => {
    expect(ticketSpoken("N007")).toBe("Senha N, 7");
    expect(ticketSpoken("P012")).toBe("Senha preferencial P, 12");
  });
});

describe("nextTicket", () => {
  it("preferencial esperando passa na frente, a mais antiga primeiro", () => {
    expect(nextTicket([t("n1", "N", 0), t("p2", "P", 5), t("p1", "P", 3)])?.id).toBe("p1");
  });
  it("sem preferencial, a normal mais antiga", () => {
    expect(nextTicket([t("n2", "N", 4), t("n1", "N", 1)])?.id).toBe("n1");
  });
  it("ignora chamadas/concluídas; null se ninguém espera", () => {
    expect(nextTicket([t("p1", "P", 0, "CALLED"), t("n1", "N", 1, "DONE")])).toBeNull();
  });
});

describe("ticketsAhead", () => {
  const list = [t("n1", "N", 0), t("n2", "N", 2), t("p1", "P", 3), t("n3", "N", 4), t("p2", "P", 5), t("x", "N", 1, "CALLED")];
  it("normal: todas as preferenciais esperando + normais anteriores", () => {
    expect(ticketsAhead(list, "n2")).toBe(3); // n1, p1, p2
    expect(ticketsAhead(list, "n1")).toBe(2); // p1, p2
  });
  it("preferencial: só preferenciais anteriores", () => {
    expect(ticketsAhead(list, "p1")).toBe(0);
    expect(ticketsAhead(list, "p2")).toBe(1);
  });
  it("senha que não está esperando: 0", () => {
    expect(ticketsAhead(list, "x")).toBe(0);
    expect(ticketsAhead(list, "nada")).toBe(0);
  });
});

describe("phoneTail", () => {
  it("últimos 8 dígitos (ignora DDI, DDD e o 9º dígito)", () => {
    expect(phoneTail("+55 (77) 99970-8403")).toBe("99708403");
    expect(phoneTail("7799708403")).toBe("99708403");
    expect(phoneTail("123")).toBeNull();
    expect(phoneTail(null)).toBeNull();
  });
});

describe("matchTicketAppointment", () => {
  const items = [
    { key: "a", phone: "5577999708403", time: "14:30", status: "CONFIRMED" },
    { key: "b", phone: "77999708403", time: "09:00", status: "COMPLETED" },
    { key: "c", phone: "77999708403", time: "16:00", status: "PENDING" },
    { key: "d", phone: "71988887777", time: "10:00", status: "CANCELLED" },
  ];
  it("casa pelo final do telefone, ignora atendidos/cancelados, pega o horário mais cedo", () => {
    expect(matchTicketAppointment(items, ["77 9 9970-8403"])?.key).toBe("a");
  });
  it("cancelado não conta", () => {
    expect(matchTicketAppointment(items, ["71988887777"])).toBeNull();
  });
  it("vários telefones (CPF → telefones do cadastro)", () => {
    expect(matchTicketAppointment(items, ["11111111111", "7799708403"])?.key).toBe("a");
  });
  it("sem telefone válido: null", () => {
    expect(matchTicketAppointment(items, [])).toBeNull();
  });
});

describe("doctorDelayMin", () => {
  const list = [
    { doctor: "Dr. João", appointmentTime: "14:00", status: "WAITING" },
    { doctor: "DR JOÃO", appointmentTime: "13:30", status: "WAITING" },
    { doctor: "Dr. João", appointmentTime: "13:00", status: "DONE" },
    { doctor: "Dra Ana", appointmentTime: "12:00", status: "WAITING" },
  ];
  it("minutos que o próximo da fila do médico já passou do horário marcado", () => {
    expect(doctorDelayMin(list, "dr joão", 14 * 60 + 5)).toBe(35);
  });
  it("ninguém atrasado: 0; sem médico: null", () => {
    expect(doctorDelayMin(list, "Dr. João", 13 * 60)).toBe(0);
    expect(doctorDelayMin(list, null, 900)).toBeNull();
    expect(doctorDelayMin(list, "Dr. Pedro", 900)).toBeNull();
  });
});
