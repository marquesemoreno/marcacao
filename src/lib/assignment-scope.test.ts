import { describe, it, expect } from "vitest";
import { canAssignTo, maskForeignAssignee } from "./assignment-scope";

describe("canAssignTo", () => {
  it("atendente só pode receber conversa da própria clínica", () => {
    expect(canAssignTo({ role: "CLINIC", clinicId: "santa-clara" }, "santa-clara")).toBe(true);
    expect(canAssignTo({ role: "CLINIC", clinicId: "urolaser" }, "santa-clara")).toBe(false);
  });

  it("usuário sem clínica (e que não é admin) nunca recebe", () => {
    expect(canAssignTo({ role: "CLINIC", clinicId: null }, "santa-clara")).toBe(false);
  });

  it("admin pode assumir conversa de qualquer clínica", () => {
    expect(canAssignTo({ role: "ADMIN", clinicId: null }, "santa-clara")).toBe(true);
  });

  it("destino inexistente não é permitido", () => {
    expect(canAssignTo(null, "santa-clara")).toBe(false);
  });
});

describe("maskForeignAssignee", () => {
  const base = { id: "c1", clinicId: "santa-clara", assignedUserId: "u1" };

  it("responsável de outra clínica some: a conversa aparece sem dono e o nome não vaza", () => {
    const out = maskForeignAssignee(
      { ...base, assignedUser: { id: "u1", name: "Rebeca Trindade Lima", role: "CLINIC", clinicId: "urolaser" } },
      "santa-clara"
    );
    expect(out.assignedUser).toBeNull();
    expect(out.assignedUserId).toBeNull();
  });

  it("responsável da própria clínica fica como está", () => {
    const conv = { ...base, assignedUser: { id: "u1", name: "Jamile", role: "CLINIC", clinicId: "santa-clara" } };
    expect(maskForeignAssignee(conv, "santa-clara")).toEqual(conv);
  });

  it("admin como responsável fica visível", () => {
    const conv = { ...base, assignedUser: { id: "u1", name: "Administrador", role: "ADMIN", clinicId: null } };
    expect(maskForeignAssignee(conv, "santa-clara")).toEqual(conv);
  });

  it("sem responsável, nada muda", () => {
    const conv = { id: "c1", clinicId: "santa-clara", assignedUserId: null, assignedUser: null };
    expect(maskForeignAssignee(conv, "santa-clara")).toEqual(conv);
  });
});
