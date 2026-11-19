import { describe, expect, it } from "vitest";
import { availableMinutes, computeOccupancy, parseRoomHours, roomForItem, type RoomConfig } from "./room-occupancy";

const weekdays = (start: string, end: string) => [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start, end }));

const c1: RoomConfig = { id: "c1", name: "Consultório 1", kind: "CONSULTORIO", hours: weekdays("08:00", "12:00"), procedureKeywords: [], slotMinutes: 10 };
const c2: RoomConfig = { id: "c2", name: "Consultório 2", kind: "CONSULTORIO", hours: weekdays("08:00", "12:00"), procedureKeywords: [], slotMinutes: 10 };
const ex: RoomConfig = { id: "ex", name: "Sala de exames", kind: "PROCEDIMENTO", hours: weekdays("08:00", "10:00"), procedureKeywords: ["cistoscopia", "ultrassom"], slotMinutes: 10 };
const rooms = [c1, c2, ex];
const doctorRooms = new Map([["dr alan", "consultorio 1"], ["dra ione", "Consultório 2"]]);

const item = (over: Partial<{ date: string; time: string | null; doctor: string | null; procedure: string | null; status: string }>) => ({
  date: "2026-11-16",
  time: "08:00",
  doctor: "Dr Alan",
  procedure: "Consulta",
  status: "CONFIRMED",
  ...over,
});

describe("parseRoomHours", () => {
  it("lê os horários guardados e descarta faixas inválidas", () => {
    expect(
      parseRoomHours([
        { weekday: 1, start: "08:00", end: "12:00" },
        { weekday: 9, start: "08:00", end: "12:00" },
        { weekday: 2, start: "12:00", end: "08:00" },
        { weekday: 3, start: "8h", end: "12:00" },
        null,
      ]),
    ).toEqual([{ weekday: 1, start: "08:00", end: "12:00" }]);
    expect(parseRoomHours("x")).toEqual([]);
  });
});

describe("availableMinutes", () => {
  it("soma o horário de funcionamento nos dias do período, sem feriados", () => {
    // 16/11/2026 é segunda; 20/11 sexta (Consciência Negra, feriado nacional); 21 e 22 fim de semana.
    const days = ["2026-11-16", "2026-11-17", "2026-11-20", "2026-11-21", "2026-11-22"];
    expect(availableMinutes(c1, days)).toBe(2 * 240);
  });
});

describe("roomForItem", () => {
  it("procedimento da sala de exames vai para ela; o resto vai para a sala do médico", () => {
    expect(roomForItem(item({ procedure: "CISTOSCOPIA FLEXÍVEL" }), rooms, doctorRooms)?.id).toBe("ex");
    expect(roomForItem(item({}), rooms, doctorRooms)?.id).toBe("c1");
    expect(roomForItem(item({ doctor: "Dra. Ione" }), rooms, doctorRooms)?.id).toBe("c2");
    expect(roomForItem(item({ doctor: "Dr Fulano" }), rooms, doctorRooms)).toBeNull();
  });
});

describe("computeOccupancy", () => {
  const days = ["2026-11-16", "2026-11-17"];
  const items = [
    item({ time: "08:00" }),
    item({ time: "08:10", status: "COMPLETED" }),
    item({ time: "08:20", status: "NO_SHOW" }),
    item({ time: "08:30", status: "CANCELLED" }),
    item({ time: null }), // ordem de chegada: conta tempo, não entra no mapa por hora
    item({ date: "2026-11-17", time: "09:00", procedure: "Ultrassom de próstata" }),
    item({ time: "10:00", doctor: "Dr Fulano" }),
  ];
  const r = computeOccupancy(items, rooms, doctorRooms, days);

  it("taxa por sala: marcado (sem cancelados) e efetivo (sem cancelados e faltas)", () => {
    const s1 = r.rooms.find((x) => x.id === "c1")!;
    expect(s1.availableMin).toBe(480);
    expect(s1.bookedMin).toBe(40);
    expect(s1.lostMin).toBe(20);
    expect(s1.effectiveMin).toBe(30);
    expect(s1.rate).toBe(8); // 40/480 = 8,3%
    expect(s1.effectiveRate).toBe(6);
    expect(s1.byDoctor).toEqual([{ doctor: "Dr Alan", bookedMin: 40 }]);
    const sx = r.rooms.find((x) => x.id === "ex")!;
    expect(sx.availableMin).toBe(240);
    expect(sx.bookedMin).toBe(10);
  });

  it("mapa por dia da semana × hora", () => {
    const s1 = r.rooms.find((x) => x.id === "c1")!;
    // segunda (1), 8h: 3 marcações não canceladas com horário = 30 min de 60 disponíveis (1 segunda no período)
    expect(s1.heat[1][8]).toEqual({ bookedMin: 30, availableMin: 60 });
    expect(s1.heat[2][8]).toEqual({ bookedMin: 0, availableMin: 60 });
    expect(s1.heat[1][13]).toEqual({ bookedMin: 0, availableMin: 0 });
  });

  it("marcações sem sala ficam à parte, com os médicos para vincular", () => {
    expect(r.unassigned).toEqual({ count: 1, doctors: ["Dr Fulano"] });
  });
});
