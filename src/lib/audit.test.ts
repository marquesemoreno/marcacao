import { describe, expect, it } from "vitest";
import { auditDiff } from "./audit";

describe("auditDiff", () => {
  it("só os campos que mudaram, com antes e depois", () => {
    expect(auditDiff({ status: "CONFIRMED", nome: "Ana" }, { status: "NO_SHOW", nome: "Ana" })).toEqual({
      status: { from: "CONFIRMED", to: "NO_SHOW" },
    });
  });
  it("campo criado ou removido", () => {
    expect(auditDiff(null, { status: "CANCELLED" })).toEqual({ status: { from: null, to: "CANCELLED" } });
    expect(auditDiff({ status: "CANCELLED" }, null)).toEqual({ status: { from: "CANCELLED", to: null } });
  });
  it("campos sensíveis não vão em claro pro log", () => {
    expect(auditDiff({ cpf: "111" }, { cpf: "222" })).toEqual({ cpf: { from: "[alterado]", to: "[alterado]" } });
  });
  it("nada mudou = vazio", () => {
    expect(auditDiff({ a: 1 }, { a: 1 })).toEqual({});
  });
});
