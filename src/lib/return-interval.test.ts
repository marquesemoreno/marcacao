import { describe, expect, it } from "vitest";
import { resolveReturnDays, validateReturnDays, returnDueDate, type ReturnInterval } from "./return-interval";

const intervals: ReturnInterval[] = [
  { kind: "DOCTOR", key: "12", label: "Dr. João Silva", days: 90 },
  { kind: "DOCTOR", key: "7", label: "Dra. Ana", days: 365 },
  { kind: "PROCEDURE", key: "cp_vasec", label: "Vasectomia", days: 30 },
];

describe("resolveReturnDays", () => {
  it("procedimento ganha do médico", () => {
    expect(resolveReturnDays({ procedureId: "cp_vasec", doctorCode: "12" }, intervals, 180)).toBe(30);
  });
  it("sem procedimento configurado, vale o médico pelo código", () => {
    expect(resolveReturnDays({ procedureId: "outro", doctorCode: " 12 " }, intervals, 180)).toBe(90);
  });
  it("médico pelo nome (agenda), sem acento/caixa", () => {
    expect(resolveReturnDays({ doctorName: "DR. JOAO SILVA" }, intervals, 180)).toBe(90);
  });
  it("nada configurado → padrão", () => {
    expect(resolveReturnDays({ doctorCode: "99", doctorName: "Fulano" }, intervals, 180)).toBe(180);
    expect(resolveReturnDays({}, [], 180)).toBe(180);
  });
});

describe("validateReturnDays", () => {
  it("aceita 7 a 1095 dias inteiros", () => {
    expect(validateReturnDays(7)).toBeNull();
    expect(validateReturnDays(1095)).toBeNull();
  });
  it("recusa fora da faixa e fração", () => {
    expect(validateReturnDays(6)).not.toBeNull();
    expect(validateReturnDays(1096)).not.toBeNull();
    expect(validateReturnDays(30.5)).not.toBeNull();
  });
});

describe("returnDueDate", () => {
  it("soma os dias à data da consulta", () => {
    expect(returnDueDate("2026-11-02", 90)).toBe("2027-01-31");
  });
});
